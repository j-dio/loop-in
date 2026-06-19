import { describe, expect, it, vi } from "vitest";

// Avoid opening a real Redis connection when importing the middleware module.
vi.mock("../lib/rateLimitSlidingRedis", () => ({
  slidingWindowRedisHitOrFailOpen: vi.fn(),
}));

import {
  PARTICIPANT_IP_LIMITS,
  RATE_LIMITS,
  classifyWorkspaceRequest,
  combineRateLimitDecision,
} from "./rateLimit";
import type { RateLimitResult } from "../lib/rateLimitSlidingRedis";

const ok = (remaining: number, limit = 100, resetSec = 10): RateLimitResult => ({
  allowed: true,
  limit,
  remaining,
  resetSec,
});
const denied = (limit = 100, resetSec = 10): RateLimitResult => ({
  allowed: false,
  limit,
  remaining: 0,
  resetSec,
});

describe("classifyWorkspaceRequest", () => {
  it("routes POST /:slug/posts to createPost", () => {
    expect(classifyWorkspaceRequest("POST", "/acme/posts")).toBe("createPost");
    expect(classifyWorkspaceRequest("POST", "/acme/posts/")).toBe("createPost");
  });

  it("routes POST upvote/comment correctly", () => {
    expect(classifyWorkspaceRequest("POST", "/acme/posts/123/upvote")).toBe("upvote");
    expect(classifyWorkspaceRequest("POST", "/acme/posts/123/comments")).toBe("comment");
  });

  it("routes POST presign to the upload bucket", () => {
    expect(classifyWorkspaceRequest("POST", "/acme/uploads/presign")).toBe("upload");
  });

  it("falls back to default for reads and unmatched paths", () => {
    expect(classifyWorkspaceRequest("GET", "/acme/posts")).toBe("default");
    expect(classifyWorkspaceRequest("POST", "/acme/members")).toBe("default");
    expect(classifyWorkspaceRequest("PATCH", "/acme/posts/123")).toBe("default");
  });

  it("does not misclassify a comment POST as createPost", () => {
    expect(classifyWorkspaceRequest("POST", "/acme/posts/123/comments")).not.toBe("createPost");
  });
});

describe("PARTICIPANT_IP_LIMITS", () => {
  it("covers exactly the three participant write buckets", () => {
    expect(Object.keys(PARTICIPANT_IP_LIMITS).sort()).toEqual(
      ["comment", "createPost", "upvote"],
    );
  });

  it("is at least as generous as the per-identity limit (tolerates NAT/shared IPs)", () => {
    for (const bucket of ["createPost", "upvote", "comment"] as const) {
      const ip = PARTICIPANT_IP_LIMITS[bucket]!;
      const user = RATE_LIMITS[bucket];
      expect(ip.windowMs).toBe(user.windowMs);
      expect(ip.limit).toBeGreaterThanOrEqual(user.limit);
    }
  });
});

describe("combineRateLimitDecision", () => {
  it("allows when both identity and IP allow", () => {
    const d = combineRateLimitDecision(ok(4), ok(10));
    expect(d.allowed).toBe(true);
  });

  it("denies when identity is exhausted even if IP has room", () => {
    const d = combineRateLimitDecision(denied(), ok(10));
    expect(d.allowed).toBe(false);
  });

  it("denies when IP is exhausted even if identity has room", () => {
    const d = combineRateLimitDecision(ok(4), denied());
    expect(d.allowed).toBe(false);
  });

  it("allows when there is no IP bucket and identity allows", () => {
    const d = combineRateLimitDecision(ok(4), null);
    expect(d.allowed).toBe(true);
  });

  it("reports headers from the strictest (fewest remaining) bucket", () => {
    const identity = ok(50, 100, 30);
    const ip = ok(3, 20, 99);
    const d = combineRateLimitDecision(identity, ip);
    expect(d.headers).toEqual({ limit: 20, remaining: 3, resetSec: 99 });
  });

  it("falls back to identity headers when no IP bucket applies", () => {
    const identity = ok(7, 30, 42);
    const d = combineRateLimitDecision(identity, null);
    expect(d.headers).toEqual({ limit: 30, remaining: 7, resetSec: 42 });
  });
});
