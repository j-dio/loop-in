import type { NextFunction, Request, Response } from "express";

/** In-memory timestamps per composite key; sliding window prunes on each hit. Phase 2 moves this to Redis. */
const store = new Map<string, number[]>();

export type RateLimitBucket = "auth" | "createPost" | "upvote" | "comment" | "default";

/** Per roadmap Step 7 / PRD — single source of truth for limits. */
export const RATE_LIMITS: Record<
  RateLimitBucket,
  { limit: number; windowMs: number }
> = {
  auth: { limit: 10, windowMs: 60_000 },
  createPost: { limit: 5, windowMs: 3_600_000 },
  upvote: { limit: 30, windowMs: 60_000 },
  comment: { limit: 20, windowMs: 60_000 },
  default: { limit: 100, windowMs: 60_000 },
};

export type RateLimitResult = {
  allowed: boolean;
  limit: number;
  remaining: number;
  /** Unix timestamp in seconds when the oldest counted request in this window expires (sliding window). */
  resetSec: number;
};

/**
 * Client IP: use `req.ip` only when `trust proxy` is configured appropriately for your deployment
 * (e.g. `app.set("trust proxy", 1)` behind Nginx). Otherwise Express uses the socket address.
 * We do not read raw `X-Forwarded-For` here so spoofing is avoided unless trust proxy is enabled.
 */
export function getClientIp(req: Request): string {
  const ip = req.ip || req.socket.remoteAddress;
  return ip && ip.length > 0 ? ip : "unknown";
}

/**
 * Prefer stable app user id when the JWT optional/auth middleware has run; otherwise IP.
 * `/auth/*` uses IP-only middleware (see createAuthRateLimiter) because OAuth callbacks set
 * passport's `req.user` (provider profile), not our `{ id: userId }` shape.
 */
export function rateLimitIdentityKey(req: Request): string {
  const uid = req.user?.id;
  if (uid) return `u:${uid}`;
  return `ip:${getClientIp(req)}`;
}

function pruneTimestamps(timestamps: number[], cutoff: number): number[] {
  return timestamps.filter((t) => t > cutoff);
}

/**
 * Sliding window: keep request timestamps within `windowMs`; allow at most `limit` hits.
 */
export function slidingWindowHit(
  key: string,
  limit: number,
  windowMs: number,
  nowMs: number = Date.now()
): RateLimitResult {
  const cutoff = nowMs - windowMs;
  let stamps = pruneTimestamps(store.get(key) ?? [], cutoff);

  if (stamps.length >= limit) {
    const oldest = Math.min(...stamps);
    const resetSec = Math.ceil((oldest + windowMs) / 1000);
    store.set(key, stamps);
    return { allowed: false, limit, remaining: 0, resetSec };
  }

  stamps.push(nowMs);
  store.set(key, stamps);
  const oldest = Math.min(...stamps);
  const resetSec = Math.ceil((oldest + windowMs) / 1000);
  return {
    allowed: true,
    limit,
    remaining: limit - stamps.length,
    resetSec,
  };
}

/** Primary bucket for this response — we attach one set of headers (strictest bucket is the one we enforce). */
export function setRateLimitHeaders(res: Response, info: Omit<RateLimitResult, "allowed">): void {
  res.setHeader("X-RateLimit-Limit", String(info.limit));
  res.setHeader("X-RateLimit-Remaining", String(Math.max(0, info.remaining)));
  res.setHeader("X-RateLimit-Reset", String(info.resetSec));
}

function compositeKey(bucket: RateLimitBucket, identity: string): string {
  return `${bucket}:${identity}`;
}

/** 10/min on all `/auth` routes; keyed by IP so OAuth redirects and refresh are not keyed on provider profiles. */
export function createAuthRateLimiter() {
  const { limit, windowMs } = RATE_LIMITS.auth;
  return (req: Request, res: Response, next: NextFunction) => {
    const identity = `ip:${getClientIp(req)}`;
    const key = compositeKey("auth", identity);
    const result = slidingWindowHit(key, limit, windowMs);
    setRateLimitHeaders(res, {
      limit: result.limit,
      remaining: result.remaining,
      resetSec: result.resetSec,
    });
    if (!result.allowed) {
      return res.status(429).json({ error: "Too many requests" });
    }
    next();
  };
}

/**
 * Classify `req.path` as mounted on `/api/workspaces` (path is e.g. `/my-slug/posts/...`).
 * Single primary bucket per request; headers reflect that bucket only.
 */
export function classifyWorkspaceRequest(method: string, path: string): RateLimitBucket {
  if (method === "POST" && /^\/[^/]+\/posts\/?$/.test(path)) return "createPost";
  if (method === "POST" && /^\/[^/]+\/posts\/[^/]+\/upvote\/?$/.test(path)) return "upvote";
  if (method === "POST" && /^\/[^/]+\/posts\/[^/]+\/comments\/?$/.test(path)) return "comment";
  return "default";
}

/**
 * Rate limit for everything under `/api/workspaces`. Runs after `optionalAuth` so authenticated
 * requests use `user_id` when present.
 */
export function createWorkspaceRateLimiter() {
  return (req: Request, res: Response, next: NextFunction) => {
    const bucket = classifyWorkspaceRequest(req.method, req.path);
    const { limit, windowMs } = RATE_LIMITS[bucket];
    const identity = rateLimitIdentityKey(req);
    const key = compositeKey(bucket, identity);
    const result = slidingWindowHit(key, limit, windowMs);
    setRateLimitHeaders(res, {
      limit: result.limit,
      remaining: result.remaining,
      resetSec: result.resetSec,
    });
    if (!result.allowed) {
      return res.status(429).json({ error: "Too many requests" });
    }
    next();
  };
}

/** Health checks: no counting; still emit headers so load balancers see stable shape. */
export function setHealthRateLimitHeaders(res: Response): void {
  const resetSec = Math.ceil(Date.now() / 1000) + 86_400;
  setRateLimitHeaders(res, { limit: 1_000_000, remaining: 1_000_000, resetSec });
}
