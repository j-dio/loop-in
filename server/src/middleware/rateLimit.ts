import type { NextFunction, Request, Response } from "express";
import {
  slidingWindowRedisHitOrFailOpen,
  type RateLimitResult,
} from "../lib/rateLimitSlidingRedis";

export type { RateLimitResult } from "../lib/rateLimitSlidingRedis";

export type RateLimitBucket = "auth" | "createPost" | "upvote" | "comment" | "upload" | "default";

/**
 * Optional per-bucket env overrides: `RL_<BUCKET>_LIMIT` and `RL_<BUCKET>_WINDOW_MS`
 * (bucket upper-cased, e.g. `RL_CREATEPOST_LIMIT`, `RL_DEFAULT_LIMIT`). Lets dev/test loosen
 * limits — and prod tune them — without a code change. Falls back to the documented default
 * when unset or non-numeric. Read once at module load (env is loaded before this imports).
 */
function envLimit(
  bucket: string,
  defLimit: number,
  defWindowMs: number,
): { limit: number; windowMs: number } {
  const key = bucket.toUpperCase();
  const limit = Number(process.env[`RL_${key}_LIMIT`]);
  const windowMs = Number(process.env[`RL_${key}_WINDOW_MS`]);
  return {
    limit: Number.isFinite(limit) && limit > 0 ? limit : defLimit,
    windowMs: Number.isFinite(windowMs) && windowMs > 0 ? windowMs : defWindowMs,
  };
}

/** Per roadmap Step 7 / PRD — single source of truth for limits (env-overridable, see `envLimit`). */
export const RATE_LIMITS: Record<
  RateLimitBucket,
  { limit: number; windowMs: number }
> = {
  auth: envLimit("auth", 10, 60_000),
  // Per-user post cap. The real spam backstop is hold-for-mod (moderation_status=pending) +
  // the per-IP ceiling in PARTICIPANT_IP_LIMITS; this just blunts a single account.
  createPost: envLimit("createPost", 20, 3_600_000),
  upvote: envLimit("upvote", 30, 60_000),
  comment: envLimit("comment", 20, 60_000),
  // Presigned-upload minting: tighter than default so a user can't mint a flood of PUT URLs.
  upload: envLimit("upload", 20, 60_000),
  // Cheap public reads (explore GETs + workspace/notification GETs all classify here). A
  // read-heavy SPA fans out several parallel calls per page (×2 under React StrictMode in dev),
  // so this must be generous; 600/min still caps a scraper without 429-ing normal browsing.
  default: envLimit("default", 600, 60_000),
};

/**
 * Per-IP ceilings for participant writes (flag-5 MVP). Applied IN ADDITION to the
 * per-identity bucket in `createWorkspaceRateLimiter` so a single host can't flood a
 * public board by spinning up many accounts (every participant write requires auth, so
 * the per-identity key is always `u:<id>` — without this, N accounts on one IP = N×limit).
 *
 * Deliberately more generous than the per-user limit (same window, higher cap) to tolerate
 * NAT / shared office IPs where several legitimate users sit behind one address.
 *
 * Only the three named participant-write buckets are covered. Presign minting (`upload`)
 * already carries its own tight per-identity budget and is out of scope here.
 */
export const PARTICIPANT_IP_LIMITS: Partial<
  Record<RateLimitBucket, { limit: number; windowMs: number }>
> = {
  // createPost cap is generous (60/h) on purpose: many legit users share one IP behind NAT
  // / mobile carrier-grade NAT, and hold-for-mod (requireApproval) is the real spam backstop,
  // not this ceiling. It only exists to blunt a single-host many-account flood.
  createPost: { limit: 60, windowMs: 3_600_000 },
  upvote: { limit: 120, windowMs: 60_000 },
  comment: { limit: 80, windowMs: 60_000 },
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

/** Primary bucket for this response — we attach one set of headers (strictest bucket is the one we enforce). */
export function setRateLimitHeaders(res: Response, info: {
  limit: number;
  remaining: number;
  resetSec: number;
}): void {
  res.setHeader("X-RateLimit-Limit", String(info.limit));
  res.setHeader("X-RateLimit-Remaining", String(Math.max(0, info.remaining)));
  res.setHeader("X-RateLimit-Reset", String(info.resetSec));
}

function compositeKey(bucket: RateLimitBucket, identity: string): string {
  return `${bucket}:${identity}`;
}

/**
 * Key for the per-IP ceiling on participant writes. Namespaced with `-ip` so it never
 * collides with the per-identity key of an anonymous request (`${bucket}:ip:<ip>`), which
 * is a different counter even though both are keyed on the same address.
 */
function participantIpKey(bucket: RateLimitBucket, ip: string): string {
  return `${bucket}-ip:ip:${ip}`;
}

/**
 * Combine a per-identity result with an optional per-IP result. Allowed only when BOTH
 * allow; response headers reflect the strictest (fewest remaining) applicable bucket so
 * clients back off against whichever ceiling they are closest to. Pure — unit-tested.
 */
export function combineRateLimitDecision(
  identity: RateLimitResult,
  ip: RateLimitResult | null,
): { allowed: boolean; headers: { limit: number; remaining: number; resetSec: number } } {
  const allowed = identity.allowed && (ip ? ip.allowed : true);
  const strictest = ip && ip.remaining < identity.remaining ? ip : identity;
  return {
    allowed,
    headers: {
      limit: strictest.limit,
      remaining: strictest.remaining,
      resetSec: strictest.resetSec,
    },
  };
}

/** 10/min on all `/auth` routes; keyed by IP so OAuth redirects and refresh are not keyed on provider profiles. */
export function createAuthRateLimiter() {
  const { limit, windowMs } = RATE_LIMITS.auth;
  return async (req: Request, res: Response, next: NextFunction) => {
    const identity = `ip:${getClientIp(req)}`;
    const key = compositeKey("auth", identity);
    const result = await slidingWindowRedisHitOrFailOpen(key, limit, windowMs);
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
  if (method === "POST" && /^\/[^/]+\/uploads\/presign\/?$/.test(path)) return "upload";
  return "default";
}

/**
 * Rate limit for everything under `/api/workspaces`. Runs after `optionalAuth` so authenticated
 * requests use `user_id` when present. Backed by Redis (Phase 2) for multi-instance correctness.
 */
export function createWorkspaceRateLimiter() {
  return async (req: Request, res: Response, next: NextFunction) => {
    const bucket = classifyWorkspaceRequest(req.method, req.path);
    const { limit, windowMs } = RATE_LIMITS[bucket];
    const key = compositeKey(bucket, rateLimitIdentityKey(req));
    const result = await slidingWindowRedisHitOrFailOpen(key, limit, windowMs);

    // Participant writes also pass a per-IP ceiling (flag-5 MVP), enforced alongside the
    // per-identity bucket so one host can't flood via many accounts. Both must allow.
    const ipLimit = PARTICIPANT_IP_LIMITS[bucket];
    let ipResult: RateLimitResult | null = null;
    if (ipLimit) {
      const ipKey = participantIpKey(bucket, getClientIp(req));
      ipResult = await slidingWindowRedisHitOrFailOpen(ipKey, ipLimit.limit, ipLimit.windowMs);
    }

    const decision = combineRateLimitDecision(result, ipResult);
    setRateLimitHeaders(res, decision.headers);
    if (!decision.allowed) {
      return res.status(429).json({ error: "Too many requests" });
    }
    next();
  };
}

/**
 * Classify a request mounted on `/api/users` (path is e.g. `/me/avatar/presign`).
 * Presign minting reuses the tight `upload` budget; profile writes fall to `default`.
 */
export function classifyUsersRequest(method: string, path: string): RateLimitBucket {
  if (method === "POST" && /^\/me\/avatar\/presign\/?$/.test(path)) return "upload";
  return "default";
}

/**
 * Rate limit for everything under `/api/users`. Runs after `optionalAuth` so it keys by
 * `user_id` (these routes require auth). Mirrors `createWorkspaceRateLimiter`; closes the
 * same presign-flood vector as the workspace upload limiter.
 */
export function createUsersRateLimiter() {
  return async (req: Request, res: Response, next: NextFunction) => {
    const bucket = classifyUsersRequest(req.method, req.path);
    const { limit, windowMs } = RATE_LIMITS[bucket];
    const identity = rateLimitIdentityKey(req);
    const key = compositeKey(bucket, identity);
    const result = await slidingWindowRedisHitOrFailOpen(key, limit, windowMs);
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

/** Rate limit for everything under `/api/notifications`. All paths use the `default` bucket. */
export function createNotificationsRateLimiter() {
  return async (req: Request, res: Response, next: NextFunction) => {
    const { limit, windowMs } = RATE_LIMITS.default;
    const key = compositeKey("default", rateLimitIdentityKey(req));
    const result = await slidingWindowRedisHitOrFailOpen(key, limit, windowMs);
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
