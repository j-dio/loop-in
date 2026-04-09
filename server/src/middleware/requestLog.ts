import type { NextFunction, Request, Response } from "express";
import type { Logger } from "pino";

/**
 * Logs one structured line per request when the response finishes (status + latency known).
 * `user_id` / `workspace_id` appear when earlier middleware set `req.user` / `req.workspace`.
 */
export function requestCompletionLogger(logger: Logger) {
  return (req: Request, res: Response, next: NextFunction) => {
    const start = process.hrtime.bigint();
    res.on("finish", () => {
      const durationNs = process.hrtime.bigint() - start;
      const latencyMs = Math.round(Number(durationNs) / 1e6);
      const path = (req.originalUrl.split("?")[0] ?? req.originalUrl) || req.url;
      logger.info(
        {
          method: req.method,
          path,
          statusCode: res.statusCode,
          latencyMs,
          user_id: req.user?.id,
          workspace_id: req.workspace?.id,
        },
        "request completed"
      );
    });
    next();
  };
}
