import { afterEach, describe, expect, it } from "vitest";
import { inArray } from "drizzle-orm";
import { db } from "../../db";
import { follows, postUpdates, posts, users, workspaces } from "../../db/schema";
import { listFollowingFeed, FOLLOWING_TRENDING_MIN, listPublicPulse, mergeFollowingFeed, type FollowingFeedItem } from "./explore.service";

// ---------------------------------------------------------------------------
// DB seed helpers — used only by integration tests that require a real DB.
// ---------------------------------------------------------------------------

let _counter = 0;
function uid(prefix: string) {
  return `${prefix}-${Date.now()}-${++_counter}`;
}

async function seedUser() {
  const [row] = await db
    .insert(users)
    .values({
      email: `${uid("u")}@test.invalid`,
      name: "Test User",
      provider: "test",
      providerId: uid("pid"),
    })
    .returning();
  return row!;
}

async function seedWorkspace(overrides: { visibility?: "public" | "invite_only" } = {}) {
  const owner = await seedUser();
  const [row] = await db
    .insert(workspaces)
    .values({
      ownerId: owner.id,
      name: uid("ws"),
      slug: uid("slug"),
      visibility: overrides.visibility ?? "public",
    })
    .returning();
  return { ...row!, _ownerId: owner.id };
}

async function seedPost(overrides: {
  workspaceId: string;
  moderationStatus?: "pending" | "approved" | "spam" | "rejected";
  upvoteCount?: number;
  title?: string;
}) {
  const author = await seedUser();
  const [row] = await db
    .insert(posts)
    .values({
      workspaceId: overrides.workspaceId,
      authorId: author.id,
      title: overrides.title ?? uid("post"),
      category: "feature_request",
      moderationStatus: overrides.moderationStatus ?? "approved",
      upvoteCount: overrides.upvoteCount ?? 0,
    })
    .returning();
  return row!;
}

async function seedFollow(overrides: { userId: string; workspaceId: string }) {
  const [row] = await db
    .insert(follows)
    .values({ userId: overrides.userId, workspaceId: overrides.workspaceId })
    .returning();
  return row!;
}

async function seedUpdate(overrides: { postId: string; workspaceId: string; content: string }) {
  const author = await seedUser();
  const [row] = await db
    .insert(postUpdates)
    .values({
      postId: overrides.postId,
      workspaceId: overrides.workspaceId,
      authorId: author.id,
      content: overrides.content,
    })
    .returning();
  return row!;
}

// Workspace IDs seeded per test — deleted in afterEach; cascade removes posts + postUpdates.
// Owner users are also deleted (users.id is referenced by posts.authorId with ON DELETE RESTRICT,
// so delete workspaces first, then orphan users).
const wsIds: string[] = [];
const userIds: string[] = [];

// Wrap seedWorkspace to register IDs for cleanup.
async function trackedSeedWorkspace(overrides?: { visibility?: "public" | "invite_only" }) {
  const ws = await seedWorkspace(overrides);
  wsIds.push(ws.id);
  userIds.push(ws._ownerId);
  return ws;
}

// Wrap seedPost to register the author user for cleanup.
async function trackedSeedPost(overrides: {
  workspaceId: string;
  moderationStatus?: "pending" | "approved" | "spam" | "rejected";
  upvoteCount?: number;
  title?: string;
  type?: "feedback" | "announcement";
}) {
  // seedPost internally calls seedUser; we need the author id for cleanup.
  // Re-implement inline so we can capture the author.
  const author = await seedUser();
  userIds.push(author.id);
  const [row] = await db
    .insert(posts)
    .values({
      workspaceId: overrides.workspaceId,
      authorId: author.id,
      title: overrides.title ?? uid("post"),
      category: "feature_request",
      moderationStatus: overrides.moderationStatus ?? "approved",
      upvoteCount: overrides.upvoteCount ?? 0,
      type: overrides.type ?? "feedback",
    })
    .returning();
  return row!;
}

async function trackedSeedUpdate(overrides: { postId: string; workspaceId: string; content: string }) {
  const author = await seedUser();
  userIds.push(author.id);
  const [row] = await db
    .insert(postUpdates)
    .values({
      postId: overrides.postId,
      workspaceId: overrides.workspaceId,
      authorId: author.id,
      content: overrides.content,
    })
    .returning();
  return row!;
}

afterEach(async () => {
  // Delete workspaces (cascades to posts, post_updates). Do this before deleting users
  // because posts.authorId is ON DELETE RESTRICT.
  if (wsIds.length) {
    await db.delete(workspaces).where(inArray(workspaces.id, [...wsIds]));
    wsIds.length = 0;
  }
  // Now safe to delete the owner users (posts that referenced them are gone via cascade).
  if (userIds.length) {
    await db.delete(users).where(inArray(users.id, [...userIds]));
    userIds.length = 0;
  }
});

// ---------------------------------------------------------------------------
// Pure unit tests — no DB required.
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Integration tests — require a live DATABASE_URL.
// ---------------------------------------------------------------------------

describe.skipIf(!process.env.DATABASE_URL)("listPublicPulse", () => {
  it("returns only status updates from public workspaces, never raw posts", async () => {
    const pub = await trackedSeedWorkspace({ visibility: "public" });
    const inviteOnly = await trackedSeedWorkspace({ visibility: "invite_only" });
    const pubPost = await trackedSeedPost({ workspaceId: pub.id, moderationStatus: "approved" });
    const hiddenPost = await trackedSeedPost({ workspaceId: inviteOnly.id, moderationStatus: "approved" });
    await trackedSeedUpdate({ postId: pubPost.id, workspaceId: pub.id, content: "Shipped it" });
    await trackedSeedUpdate({ postId: hiddenPost.id, workspaceId: inviteOnly.id, content: "secret" });

    const { items } = await listPublicPulse({ limit: 10, cursor: null });

    expect(items.every((i) => i.type === "update" || i.type === "announcement")).toBe(true);
    expect(items.filter((i) => i.type === "update").map((i) => (i as { content: string }).content)).toContain("Shipped it");
    expect(items.filter((i) => i.type === "update").map((i) => (i as { content: string }).content)).not.toContain("secret");
  });
});

describe.skipIf(!process.env.DATABASE_URL)("listFollowingFeed — trending threshold", () => {
  it("following feed excludes feedback posts below the trending threshold but keeps updates", async () => {
    const ws = await trackedSeedWorkspace({ visibility: "public" });
    const viewer = await seedUser();
    userIds.push(viewer.id);
    await seedFollow({ userId: viewer.id, workspaceId: ws.id });
    const cold = await trackedSeedPost({ workspaceId: ws.id, moderationStatus: "approved", upvoteCount: 0, title: "cold idea" });
    await trackedSeedPost({ workspaceId: ws.id, moderationStatus: "approved", upvoteCount: FOLLOWING_TRENDING_MIN, title: "hot idea" });
    await trackedSeedUpdate({ postId: cold.id, workspaceId: ws.id, content: "update on cold" });

    const { items } = await listFollowingFeed({
      userId: viewer.id, limit: 20, cursor: null, minUpvotes: FOLLOWING_TRENDING_MIN,
    });

    const titles = items.filter((i) => i.type === "post").map((i) => (i as { title: string }).title);
    expect(titles).toContain("hot idea");
    expect(titles).not.toContain("cold idea");
    // the update still rides through even though its parent post is "cold"
    expect(items.some((i) => i.type === "update" && (i as { content: string }).content === "update on cold")).toBe(true);
  });
});

describe.skipIf(!process.env.DATABASE_URL)("listPublicPulse — announcements", () => {
  it("the public pulse includes announcements alongside status updates", async () => {
    const ws = await trackedSeedWorkspace({ visibility: "public" });
    const fb = await trackedSeedPost({ workspaceId: ws.id, moderationStatus: "approved", type: "feedback" });
    await trackedSeedUpdate({ postId: fb.id, workspaceId: ws.id, content: "shipped" });
    await trackedSeedPost({ workspaceId: ws.id, moderationStatus: "approved", type: "announcement", title: "v2 is live" });

    const { items } = await listPublicPulse({ limit: 20, cursor: null });
    expect(items.some((i) => i.type === "update" && (i as { content: string }).content === "shipped")).toBe(true);
    expect(items.some((i) => i.type === "announcement" && (i as { title: string }).title === "v2 is live")).toBe(true);
    // raw feedback posts never appear in the pulse (PulseItem is "update" | "announcement" only)
    expect(items.every((i) => i.type === "update" || i.type === "announcement")).toBe(true);
  });
});
