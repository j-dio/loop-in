import Redis from "ioredis";
import { requireEnv } from "../config/env";
import { logger } from "./logger";

/**
 * Shared Redis connection for trending sorted sets and (next) distributed rate limits.
 * One process → one client; ioredis multiplexes commands on a small connection pool.
 */
export const redis = new Redis(requireEnv("REDIS_URL"), {
  // Fail commands quickly if the server is unreachable instead of hanging forever.
  connectTimeout: 10_000,
  // Retry on disconnect; typical for Redis restarts / network blips.
  maxRetriesPerRequest: 3,
});

redis.on("error", (err) => {
  logger.error({ err }, "redis client error");
});
