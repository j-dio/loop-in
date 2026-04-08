import express from "express";
import helmet from "helmet";
import cors from "cors";
import cookieParser from "cookie-parser";
import pino from "pino";
import "./config/env";
import { authRouter } from "./modules/auth/auth.routes";
import { workspacesRouter } from "./modules/workspaces/workspaces.routes";

const logger = pino({ level: process.env.LOG_LEVEL ?? "info" });
const app = express();

app.use(helmet());
app.use(
  cors({
    origin: process.env.CLIENT_URL ?? true,
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());

app.use((req, res, next) => {
  logger.info({ method: req.method, url: req.url }, "request");
  next();
});

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

const parsedPort = Number(process.env.PORT ?? 3001);
const port = Number.isFinite(parsedPort) ? parsedPort : 3001;

app.use("/auth", authRouter);
app.use("/api/workspaces", workspacesRouter);

app.use((err: unknown, req: express.Request, res: express.Response, _next: express.NextFunction) => {
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

app.listen(port, () => {
  logger.info({ port }, "server listening");
});