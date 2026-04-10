import { randomUUID } from "node:crypto";
import { redis } from "./redis";
import { logger } from "./logger";

export type RateLimitResult = {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetSec: number;
};

/**
 * Atomic sliding-window limiter: one ZSET per key, score = request time (ms), member = unique id.
 * Evicts entries older than `windowMs` before counting. Matches prior in-memory behavior but shared across processes.
 */
const SLIDING_WINDOW_LUA = `
local key = KEYS[1]
local now = tonumber(ARGV[1])
local window = tonumber(ARGV[2])
local limit = tonumber(ARGV[3])
local member = ARGV[4]
local cutoff = now - window

redis.call('ZREMRANGEBYSCORE', key, '-inf', cutoff)
local n = redis.call('ZCARD', key)
if n >= limit then
  local oldest = redis.call('ZRANGE', key, 0, 0, 'WITHSCORES')
  local oldestTs = tonumber(oldest[2])
  return {0, 0, math.ceil((oldestTs + window) / 1000)}
end
redis.call('ZADD', key, now, member)
local ttl = math.ceil(window / 1000) + 120
redis.call('EXPIRE', key, ttl)
n = redis.call('ZCARD', key)
local oldest = redis.call('ZRANGE', key, 0, 0, 'WITHSCORES')
local oldestTs = tonumber(oldest[2])
return {1, limit - n, math.ceil((oldestTs + window) / 1000)}
`;

function redisKeyForComposite(compositeKey: string): string {
  return `rl:sw:${compositeKey}`;
}

/**
 * @param compositeKey Logical key, e.g. `auth:ip:127.0.0.1` (no Redis prefix).
 */
export async function slidingWindowRedisHit(
  compositeKey: string,
  limit: number,
  windowMs: number,
  nowMs: number = Date.now()
): Promise<RateLimitResult> {
  const key = redisKeyForComposite(compositeKey);
  const member = `${nowMs}:${randomUUID()}`;

  const raw = (await redis.eval(
    SLIDING_WINDOW_LUA,
    1,
    key,
    String(nowMs),
    String(windowMs),
    String(limit),
    member
  )) as unknown;

  if (!Array.isArray(raw) || raw.length < 3) {
    throw new Error("unexpected redis.eval response for rate limit");
  }

  const allowed = Number(raw[0]) === 1;
  const remaining = Number(raw[1]);
  const resetSec = Number(raw[2]);
  return { allowed, limit, remaining, resetSec };
}

/** On Redis failure: allow traffic but log (availability over strict limiting). */
export async function slidingWindowRedisHitOrFailOpen(
  compositeKey: string,
  limit: number,
  windowMs: number,
  nowMs: number = Date.now()
): Promise<RateLimitResult> {
  try {
    return await slidingWindowRedisHit(compositeKey, limit, windowMs, nowMs);
  } catch (err) {
    logger.warn({ err, compositeKey }, "redis rate limit failed; fail-open");
    return {
      allowed: true,
      limit,
      remaining: limit,
      resetSec: Math.ceil((nowMs + windowMs) / 1000),
    };
  }
}
