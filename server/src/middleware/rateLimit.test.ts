import { describe, expect, it, vi } from "vitest";

// Avoid opening a real Redis connection when importing the middleware module.
vi.mock("../lib/rateLimitSlidingRedis", () => ({
  slidingWindowRedisHitOrFailOpen: vi.fn(),
}));

import { classifyWorkspaceRequest } from "./rateLimit";

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
