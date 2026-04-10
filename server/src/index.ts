import "./config/env";
import "./instrument";
import { redis } from "./lib/redis";
import express from "express";
import * as Sentry from "@sentry/node";
import helmet from "helmet";
import cors from "cors";
import cookieParser from "cookie-parser";
import { authRouter } from "./modules/auth/auth.routes";
import { workspacesRouter } from "./modules/workspaces/workspaces.routes";
import {
  createAuthRateLimiter,
  RATE_LIMITS,
  setHealthRateLimitHeaders,
  setRateLimitHeaders,
} from "./middleware/rateLimit";
import { logger } from "./lib/logger";
import { requestCompletionLogger } from "./middleware/requestLog";
import { startTrendingRefreshScheduler } from "./jobs/trendingRefresh";

const app = express();

// When behind a trusted reverse proxy (e.g. Nginx), set TRUST_PROXY=1 so `req.ip` uses X-Forwarded-For safely.
if (process.env.TRUST_PROXY === "1") {
  app.set("trust proxy", 1);
}

app.use(helmet());
app.use(
  cors({
    origin: process.env.CLIENT_URL ?? true,
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());
app.use(requestCompletionLogger(logger));

app.get("/health", (_req, res) => {
  // Not counted against any bucket; headers are informational for observability only.
  setHealthRateLimitHeaders(res);
  res.json({ status: "ok" });
});

const parsedPort = Number(process.env.PORT ?? 3001);
const port = Number.isFinite(parsedPort) ? parsedPort : 3001;

app.use("/auth", createAuthRateLimiter(), authRouter);
app.use("/api/workspaces", workspacesRouter);

if (process.env.NODE_ENV !== "production") {
  app.get("/debug/sentry-test", (_req, _res, next) => {
    next(new Error("Sentry test error (intentional)"));
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

app.listen(port, async () => {
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
