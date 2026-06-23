import { afterEach, describe, expect, it } from "vitest";
import { inArray } from "drizzle-orm";
import { db } from "../../db";
import { posts, users, workspaces } from "../../db/schema";
import {
  moderatePost,
  updatePostBoardStatus,
  setPostPinned,
  softDeletePost,
} from "./posts.service";
import { listModerationEvents } from "./moderationEvents.service";

let _counter = 0;
function uid(prefix: string) {
  return `${prefix}-${Date.now()}-${++_counter}`;
}

const wsIds: string[] = [];
const userIds: string[] = [];

async function seedUser() {
  const [row] = await db
    .insert(users)
    .values({
      email: `${uid("u")}@test.invalid`,
      name: "Mod Tester",
      provider: "test",
      providerId: uid("pid"),
    })
    .returning();
  userIds.push(row!.id);
  return row!;
}

async function seedWorkspace() {
  const owner = await seedUser();
  const [row] = await db
    .insert(workspaces)
    .values({ ownerId: owner.id, name: uid("ws"), slug: uid("slug"), visibility: "public" })
    .returning();
  wsIds.push(row!.id);
  return { ...row!, ownerId: owner.id };
}

async function seedPost(workspaceId: string, moderationStatus: "pending" | "approved" = "approved") {
  const author = await seedUser();
  const [row] = await db
    .insert(posts)
    .values({
      workspaceId,
      authorId: author.id,
      title: uid("post"),
      category: "feature_request",
      moderationStatus,
      type: "feedback",
    })
    .returning();
  return row!;
}

afterEach(async () => {
  // Cascades clean moderation_events (post_id / workspace_id ON DELETE cascade).
  if (wsIds.length) {
    await db.delete(workspaces).where(inArray(workspaces.id, [...wsIds]));
    wsIds.length = 0;
  }
  if (userIds.length) {
    await db.delete(users).where(inArray(users.id, [...userIds]));
    userIds.length = 0;
  }
});

describe.skipIf(!process.env.DATABASE_URL)("moderation audit trail", () => {
  it("records a moderation_status change with actor + from/to", async () => {
    const ws = await seedWorkspace();
    const post = await seedPost(ws.id, "pending");

    const res = await moderatePost({
      workspaceId: ws.id,
      postId: post.id,
      moderationStatus: "approved",
      ctx: { userId: ws.ownerId, workspaceRole: "owner" },
    });
    expect(res).not.toBe("not_found");
    expect(res).not.toBe("no_change");

    const events = await listModerationEvents({ workspaceId: ws.id, postId: post.id, limit: 50 });
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      action: "moderation_status",
      fromValue: "pending",
      toValue: "approved",
    });
    expect(events[0]!.actor?.id).toBe(ws.ownerId);
  });

  it("records a board_status move, and writes nothing on a no-op move", async () => {
    const ws = await seedWorkspace();
    const post = await seedPost(ws.id, "approved"); // starts at board_status 'inbox'

    await updatePostBoardStatus({
      workspaceId: ws.id,
      postId: post.id,
      boardStatus: "planned",
      ctx: { userId: ws.ownerId, workspaceRole: "owner" },
    });
    // No-op: planned -> planned must not append a second row.
    await updatePostBoardStatus({
      workspaceId: ws.id,
      postId: post.id,
      boardStatus: "planned",
      ctx: { userId: ws.ownerId, workspaceRole: "owner" },
    });

    const events = await listModerationEvents({ workspaceId: ws.id, postId: post.id, limit: 50 });
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ action: "board_status", fromValue: "inbox", toValue: "planned" });
  });

  it("records pin then unpin as distinct actions, and ignores redundant toggles", async () => {
    const ws = await seedWorkspace();
    const post = await seedPost(ws.id, "approved");

    await setPostPinned({ workspaceId: ws.id, postId: post.id, pinned: true, actorId: ws.ownerId });
    await setPostPinned({ workspaceId: ws.id, postId: post.id, pinned: true, actorId: ws.ownerId }); // no-op
    await setPostPinned({ workspaceId: ws.id, postId: post.id, pinned: false, actorId: ws.ownerId });

    const events = await listModerationEvents({ workspaceId: ws.id, postId: post.id, limit: 50 });
    // newest first: unpin, then pin
    expect(events.map((e) => e.action)).toEqual(["unpin", "pin"]);
  });

  it("audits a staff delete but NOT an author self-delete", async () => {
    const ws = await seedWorkspace();

    // Staff (owner) deletes — audited.
    const staffPost = await seedPost(ws.id, "approved");
    await softDeletePost({
      workspaceId: ws.id,
      postId: staffPost.id,
      editorUserId: ws.ownerId,
      workspaceRole: "owner",
    });
    const staffEvents = await listModerationEvents({ workspaceId: ws.id, postId: staffPost.id, limit: 50 });
    expect(staffEvents.map((e) => e.action)).toEqual(["delete"]);
    expect(staffEvents[0]!.actor?.id).toBe(ws.ownerId);

    // Author deletes their own post — not a moderation action, no audit row.
    const ownPost = await seedPost(ws.id, "approved");
    await softDeletePost({
      workspaceId: ws.id,
      postId: ownPost.id,
      editorUserId: ownPost.authorId,
      workspaceRole: undefined,
    });
    const authorEvents = await listModerationEvents({ workspaceId: ws.id, postId: ownPost.id, limit: 50 });
    expect(authorEvents).toHaveLength(0);
  });
});
