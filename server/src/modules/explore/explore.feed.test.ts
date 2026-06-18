import { describe, expect, it } from "vitest";
import { mergeFollowingFeed, type FollowingFeedItem } from "./explore.service";

function postItem(id: string, iso: string): FollowingFeedItem {
  return {
    type: "post",
    id,
    createdAt: new Date(iso),
    title: `post ${id}`,
    description: null,
    imageUrl: null,
    category: "feature_request",
    boardStatus: "inbox",
    upvoteCount: 0,
    author: { id: "u1", name: "U", avatarUrl: null },
    workspace: { name: "W", slug: "w", logoUrl: null },
  };
}
function updateItem(id: string, iso: string): FollowingFeedItem {
  return {
    type: "update",
    id,
    createdAt: new Date(iso),
    content: `update ${id}`,
    post: { id: "p1", title: "parent" },
    author: { id: "a1", name: "Admin", avatarUrl: null },
    workspace: { name: "W", slug: "w", logoUrl: null },
  };
}

function decode(raw: string): { v: number; createdAt: string; id: string } {
  return JSON.parse(Buffer.from(raw, "base64url").toString("utf8"));
}

describe("mergeFollowingFeed", () => {
  it("interleaves posts and updates by createdAt desc", () => {
    const posts = [postItem("p-a", "2026-06-18T10:00:00.000Z"), postItem("p-b", "2026-06-18T08:00:00.000Z")];
    const updates = [updateItem("u-a", "2026-06-18T09:00:00.000Z")];
    const { items, nextCursor } = mergeFollowingFeed(posts, updates, 10);
    expect(items.map((i) => i.id)).toEqual(["p-a", "u-a", "p-b"]);
    expect(nextCursor).toBeNull();
  });

  it("slices to the limit and returns a cursor from the last kept item", () => {
    const posts = [
      postItem("p1", "2026-06-18T10:00:00.000Z"),
      postItem("p2", "2026-06-18T09:00:00.000Z"),
      postItem("p3", "2026-06-18T08:00:00.000Z"),
    ];
    const { items, nextCursor } = mergeFollowingFeed(posts, [], 2);
    expect(items.map((i) => i.id)).toEqual(["p1", "p2"]);
    expect(nextCursor).not.toBeNull();
    const c = decode(nextCursor!);
    expect(c).toEqual({ v: 1, createdAt: "2026-06-18T09:00:00.000Z", id: "p2" });
  });

  it("breaks createdAt ties by id desc", () => {
    const t = "2026-06-18T10:00:00.000Z";
    const { items } = mergeFollowingFeed([postItem("aaa", t), postItem("ccc", t)], [updateItem("bbb", t)], 10);
    expect(items.map((i) => i.id)).toEqual(["ccc", "bbb", "aaa"]);
  });

  it("returns empty + null cursor for empty inputs", () => {
    expect(mergeFollowingFeed([], [], 10)).toEqual({ items: [], nextCursor: null });
  });

  it("returns no cursor when the merged total exactly equals the limit", () => {
    const posts = [postItem("p1", "2026-06-18T10:00:00.000Z"), postItem("p2", "2026-06-18T09:00:00.000Z")];
    const { nextCursor } = mergeFollowingFeed(posts, [], 2);
    expect(nextCursor).toBeNull();
  });
});
