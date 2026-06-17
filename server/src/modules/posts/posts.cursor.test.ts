import { describe, expect, it } from "vitest";
import { PostCursorSchema } from "./posts.schemas";

const ID = "abcdef12-1234-4abc-89ab-abcdef123456";

function encode(payload: unknown): string {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}
function decode(raw: string): unknown {
  return JSON.parse(Buffer.from(raw, "base64url").toString("utf8"));
}

describe("PostCursorSchema round-trip", () => {
  it("accepts a newest cursor", () => {
    const c = { v: 1, k: "newest", createdAt: new Date().toISOString(), id: ID };
    const parsed = PostCursorSchema.safeParse(decode(encode(c)));
    expect(parsed.success).toBe(true);
  });

  it("accepts a top cursor with upvoteCount", () => {
    const c = { v: 1, k: "top", upvoteCount: 42, createdAt: new Date().toISOString(), id: ID };
    const parsed = PostCursorSchema.safeParse(decode(encode(c)));
    expect(parsed.success).toBe(true);
  });

  it("accepts a trending cursor (id only)", () => {
    const parsed = PostCursorSchema.safeParse(decode(encode({ v: 1, k: "trending", id: ID })));
    expect(parsed.success).toBe(true);
  });

  it("rejects an unknown discriminator", () => {
    expect(PostCursorSchema.safeParse({ v: 1, k: "sideways", id: ID }).success).toBe(false);
  });

  it("rejects a non-uuid id", () => {
    expect(
      PostCursorSchema.safeParse({ v: 1, k: "newest", createdAt: new Date().toISOString(), id: "nope" }).success
    ).toBe(false);
  });

  it("rejects a top cursor missing upvoteCount", () => {
    expect(
      PostCursorSchema.safeParse({ v: 1, k: "top", createdAt: new Date().toISOString(), id: ID }).success
    ).toBe(false);
  });
});
