import express from "express";
import helmet from "helmet";
import cors from "cors";
import cookieParser from "cookie-parser";
import pino from "pino";
import "./config/env";
import { authRouter } from "./modules/auth/auth.routes";

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

app.listen(port, () => {
  logger.info({ port }, "server listening");
});
