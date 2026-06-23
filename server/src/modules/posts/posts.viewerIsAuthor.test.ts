import { afterEach, describe, expect, it } from "vitest";
import { inArray } from "drizzle-orm";
import { db } from "../../db";
import { posts, users, workspaces } from "../../db/schema";
import { getPostById } from "./posts.service";

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
      name: "Anon Tester",
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

async function seedAnonPost(workspaceId: string, authorId: string) {
  const [row] = await db
    .insert(posts)
    .values({
      workspaceId,
      authorId,
      title: uid("post"),
      category: "feature_request",
      moderationStatus: "approved",
      type: "feedback",
      isAnonymous: true,
    })
    .returning();
  return row!;
}

afterEach(async () => {
  if (wsIds.length) {
    await db.delete(workspaces).where(inArray(workspaces.id, [...wsIds]));
    wsIds.length = 0;
  }
  if (userIds.length) {
    await db.delete(users).where(inArray(users.id, [...userIds]));
    userIds.length = 0;
  }
});

describe.skipIf(!process.env.DATABASE_URL)("viewerIsAuthor on anonymous posts", () => {
  it("marks the author as viewerIsAuthor while still masking their identity", async () => {
    const ws = await seedWorkspace();
    const author = await seedUser();
    const post = await seedAnonPost(ws.id, author.id);

    const res = await getPostById({
      workspaceId: ws.id,
      postId: post.id,
      ctx: { userId: author.id, workspaceRole: undefined },
    });
    expect(res).not.toBe("not_found");
    expect(res).not.toBe("forbidden");
    if (typeof res === "string") throw new Error("expected a post");

    // Author can act on their own post...
    expect(res.viewerIsAuthor).toBe(true);
    // ...but identity stays masked (anonymity preserved even to the author).
    expect(res.author.id).toBeUndefined();
    expect(res.author.name).toBe("Anonymous");
  });

  it("does not mark a different non-staff viewer as the author", async () => {
    const ws = await seedWorkspace();
    const author = await seedUser();
    const other = await seedUser();
    const post = await seedAnonPost(ws.id, author.id);

    const res = await getPostById({
      workspaceId: ws.id,
      postId: post.id,
      ctx: { userId: other.id, workspaceRole: undefined },
    });
    if (typeof res === "string") throw new Error("expected a post");

    expect(res.viewerIsAuthor).toBe(false);
    expect(res.author.id).toBeUndefined();
    expect(res.author.name).toBe("Anonymous");
  });

  it("masks identity from staff-less anon view yet exposes real author to staff", async () => {
    const ws = await seedWorkspace();
    const author = await seedUser();
    const post = await seedAnonPost(ws.id, author.id);

    // Owner (staff) sees the real identity and is not the author.
    const res = await getPostById({
      workspaceId: ws.id,
      postId: post.id,
      ctx: { userId: ws.ownerId, workspaceRole: "owner" },
    });
    if (typeof res === "string") throw new Error("expected a post");

    expect(res.viewerIsAuthor).toBe(false);
    expect(res.author.id).toBe(author.id);
  });
});
