import "./config/env";
import { validateEnv } from "./config/env";
import "./instrument";
import { redis } from "./lib/redis";
import { pool } from "./db";
import express from "express";
import path from "path";
import * as Sentry from "@sentry/node";
import helmet from "helmet";
import cors from "cors";
import cookieParser from "cookie-parser";
import { authRouter } from "./modules/auth/auth.routes";
import { workspacesRouter } from "./modules/workspaces/workspaces.routes";
import {
  RATE_LIMITS,
  setHealthRateLimitHeaders,
  setRateLimitHeaders,
} from "./middleware/rateLimit";
import { logger } from "./lib/logger";
import { requestCompletionLogger } from "./middleware/requestLog";
import { startTrendingRefreshScheduler } from "./jobs/trendingRefresh";
import { getBucketPublicBaseUrl } from "./modules/uploads/uploads.service";

// Fail fast on a misconfigured deploy before we bind a port.
validateEnv();

const app = express();

// When behind a trusted reverse proxy (e.g. Nginx), set TRUST_PROXY=1 so `req.ip` uses X-Forwarded-For safely.
if (process.env.TRUST_PROXY === "1") {
  app.set("trust proxy", 1);
}

// --- Content-Security-Policy --------------------------------------------------------------------
// In production the SPA is served from this same origin, so CSP headers apply to the app HTML.
// Helmet's default `img-src 'self' data:` would block S3 post images and OAuth avatars, so we set
// an explicit policy that allows our known image/connect/font sources.
const s3Base = getBucketPublicBaseUrl();
const s3Host = s3Base ? new URL(s3Base).origin : null;
const imgSrc = [
  "'self'",
  "data:",
  "blob:",
  "https://lh3.googleusercontent.com",
  "https://*.googleusercontent.com",
  "https://avatars.githubusercontent.com",
  ...(s3Host ? [s3Host] : []),
];
const isProd = process.env.NODE_ENV === "production";

app.use(
  helmet({
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        "default-src": ["'self'"],
        "script-src": ["'self'"],
        // Tailwind v4 + Framer Motion inject inline styles / style attributes at runtime.
        "style-src": ["'self'", "'unsafe-inline'"],
        "img-src": imgSrc,
        "font-src": ["'self'", "data:"],
        "connect-src": ["'self'"],
        "object-src": ["'none'"],
        "base-uri": ["'self'"],
        "frame-ancestors": ["'self'"],
        // Only force https upgrades in production (would break http://localhost in dev).
        ...(isProd ? {} : { "upgrade-insecure-requests": null }),
      },
    },
    // Allow cross-origin loading of our own static assets (images) by the browser.
    crossOriginResourcePolicy: { policy: "cross-origin" },
  })
);

// CORS: in production require an explicit CLIENT_URL (validated at startup); never reflect arbitrary
// origins with credentials. In dev, fall back to the common Vite origins.
const corsOrigin = process.env.CLIENT_URL
  ? [process.env.CLIENT_URL]
  : ["http://localhost:5173", "http://127.0.0.1:5173"];
app.use(
  cors({
    origin: corsOrigin,
    credentials: true,
  })
);
app.use(express.json({ limit: "100kb" }));
app.use(cookieParser());
app.use(requestCompletionLogger(logger));

app.get("/health", (_req, res) => {
  // Not counted against any bucket; headers are informational for observability only.
  setHealthRateLimitHeaders(res);
  res.json({ status: "ok" });
});

// Deep health: verifies DB + Redis connectivity for uptime monitors. Returns 503 if a dependency
// is down so a load balancer / monitor can react.
app.get("/health/deep", async (_req, res) => {
  setHealthRateLimitHeaders(res);
  const checks: { db: boolean; redis: boolean } = { db: false, redis: false };
  try {
    await pool.query("SELECT 1");
    checks.db = true;
  } catch (err) {
    logger.error({ err }, "health: db check failed");
  }
  try {
    await redis.ping();
    checks.redis = true;
  } catch (err) {
    logger.error({ err }, "health: redis check failed");
  }
  const ok = checks.db && checks.redis;
  res.status(ok ? 200 : 503).json({ status: ok ? "ok" : "degraded", checks });
});

const parsedPort = Number(process.env.PORT ?? 3001);
const port = Number.isFinite(parsedPort) ? parsedPort : 3001;

app.use("/auth", authRouter);
app.use("/api/workspaces", workspacesRouter);

if (process.env.NODE_ENV !== "production") {
  app.get("/debug/sentry-test", (_req, _res, next) => {
    next(new Error("Sentry test error (intentional)"));
  });
}

if (process.env.NODE_ENV === "production") {
  const clientDist = path.join(__dirname, "../../client/dist");
  app.use(express.static(clientDist));
  app.get(/.*/, (_req, res) => {
    res.sendFile(path.join(clientDist, "index.html"));
  });
}

if (process.env.SENTRY_DSN) {
  Sentry.setupExpressErrorHandler(app);
}

app.use((err: unknown, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (!res.headersSent && res.getHeader("X-RateLimit-Limit") === undefined) {
    const resetSec = Math.ceil(Date.now() / 1000) + Math.ceil(RATE_LIMITS.default.windowMs / 1000);
    setRateLimitHeaders(res, {
      limit: RATE_LIMITS.default.limit,
      remaining: RATE_LIMITS.default.limit,
      resetSec,
    });
  }
  // If JSON body parsing fails, Express throws a SyntaxError with status 400.
  // Surface it as a 400 so callers can fix their request body.
  if (
    err instanceof SyntaxError &&
    typeof (err as unknown as { status?: unknown }).status === "number" &&
    (err as unknown as { status: number }).status === 400
  ) {
    logger.warn({ err, method: req.method, url: req.url }, "invalid json");
    return res.status(400).json({ error: "Invalid JSON" });
  }

  logger.error({ err, method: req.method, url: req.url }, "unhandled error");
  res.status(500).json({ error: "Internal Server Error" });
});

const server = app.listen(port, async () => {
  logger.info({ port }, "server listening");
  try {
    const pong = await redis.ping();
    logger.info({ pong }, "redis ready");
    startTrendingRefreshScheduler();
  } catch (err) {
    logger.fatal({ err }, "redis ping failed — check REDIS_URL and that Redis is running");
    process.exit(1);
  }
});

// Graceful shutdown — Railway sends SIGTERM on redeploy. Stop accepting connections, then drain
// the DB pool and Redis so in-flight requests finish and connections aren't leaked.
let shuttingDown = false;
async function shutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info({ signal }, "shutting down");
  const forceExit = setTimeout(() => {
    logger.warn("forced exit after shutdown timeout");
    process.exit(1);
  }, 10_000);
  forceExit.unref();

  server.close(async () => {
    try {
      await pool.end();
    } catch (err) {
      logger.warn({ err }, "error closing db pool");
    }
    try {
      await redis.quit();
    } catch (err) {
      logger.warn({ err }, "error closing redis");
    }
    clearTimeout(forceExit);
    logger.info("shutdown complete");
    process.exit(0);
  });
}

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));
