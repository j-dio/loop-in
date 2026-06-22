import { afterEach, describe, expect, it } from "vitest";
import { inArray } from "drizzle-orm";
import { db } from "../../db";
import { posts, users, workspaces } from "../../db/schema";
import { createAnnouncement, getPostById, listAnnouncementsForAdmin, listPosts } from "./posts.service";
import { listApprovedPostsForKanban, listPendingPostsForTriage } from "./posts.service";

// ---------------------------------------------------------------------------
// Seed helpers
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
  type?: "feedback" | "announcement";
  title?: string;
  upvoteCount?: number;
}) {
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
      type: overrides.type ?? "feedback",
      upvoteCount: overrides.upvoteCount ?? 0,
    })
    .returning();
  return row!;
}

const wsIds: string[] = [];
const userIds: string[] = [];

async function trackedSeedWorkspace(overrides?: { visibility?: "public" | "invite_only" }) {
  const ws = await seedWorkspace(overrides);
  wsIds.push(ws.id);
  userIds.push(ws._ownerId);
  return ws;
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

// ---------------------------------------------------------------------------
// Tests — require a live DATABASE_URL.
// ---------------------------------------------------------------------------

describe.skipIf(!process.env.DATABASE_URL)("createAnnouncement service", () => {
  it("creates an auto-approved announcement that is openable as a thread", async () => {
    const ws = await trackedSeedWorkspace({ visibility: "public" });
    const owner = await seedUser();
    userIds.push(owner.id);
    const a = await createAnnouncement({
      workspaceId: ws.id, authorId: owner.id, title: "v2 is live",
      description: "offline mode + faster sync", imageUrl: null,
      ctx: { userId: owner.id, workspaceRole: "owner" },
    });
    expect(a.type).toBe("announcement");
    expect(a.moderationStatus).toBe("approved");

    // openable as a normal thread (reuses getPostById — proves comments/upvotes will work)
    const fetched = await getPostById({ workspaceId: ws.id, postId: a.id, ctx: { userId: undefined, workspaceRole: undefined } });
    expect(fetched).not.toBe("not_found");
    expect(fetched).not.toBe("forbidden");
  });
});

describe.skipIf(!process.env.DATABASE_URL)("listAnnouncementsForAdmin", () => {
  it("returns only announcements, not feedback posts", async () => {
    const ws = await trackedSeedWorkspace({ visibility: "public" });
    const owner = await seedUser();
    userIds.push(owner.id);

    await seedPost({ workspaceId: ws.id, moderationStatus: "approved", type: "feedback", title: "a feedback post" });
    await createAnnouncement({
      workspaceId: ws.id, authorId: owner.id, title: "an announcement",
      description: null, imageUrl: null,
      ctx: { userId: owner.id, workspaceRole: "owner" },
    });

    const result = await listAnnouncementsForAdmin({
      workspaceId: ws.id,
      ctx: { userId: owner.id, workspaceRole: "owner" },
    });

    const titles = result.map((p) => p.title);
    expect(titles).toContain("an announcement");
    expect(titles).not.toContain("a feedback post");
    expect(result.every((p) => p.type === "announcement")).toBe(true);
  });
});

describe.skipIf(!process.env.DATABASE_URL)("announcements excluded from feedback surfaces", () => {
  it("the feedback board feed excludes announcements", async () => {
    const ws = await trackedSeedWorkspace({ visibility: "public" });
    await seedPost({ workspaceId: ws.id, moderationStatus: "approved", type: "feedback", title: "real feedback" });
    await seedPost({ workspaceId: ws.id, moderationStatus: "approved", type: "announcement", title: "v2 is live" });

    const { posts: result } = await listPosts({
      workspaceId: ws.id,
      sort: "newest",
      limit: 20,
      cursor: null,
      ctx: { userId: undefined, workspaceRole: undefined },
    });

    const titles = result.map((p) => p.title);
    expect(titles).toContain("real feedback");
    expect(titles).not.toContain("v2 is live");
  });

  it("the kanban board excludes announcements", async () => {
    const ws = await trackedSeedWorkspace({ visibility: "public" });
    await seedPost({ workspaceId: ws.id, moderationStatus: "approved", type: "feedback", title: "kanban feedback" });
    await seedPost({ workspaceId: ws.id, moderationStatus: "approved", type: "announcement", title: "kanban announcement" });

    const result = await listApprovedPostsForKanban({
      workspaceId: ws.id,
      limit: 20,
      ctx: { userId: undefined, workspaceRole: undefined },
    });

    const titles = result.map((p) => p.title);
    expect(titles).toContain("kanban feedback");
    expect(titles).not.toContain("kanban announcement");
  });

  it("the triage inbox excludes announcements", async () => {
    const ws = await trackedSeedWorkspace({ visibility: "public" });
    await seedPost({ workspaceId: ws.id, moderationStatus: "pending", type: "feedback", title: "triage feedback" });
    await seedPost({ workspaceId: ws.id, moderationStatus: "pending", type: "announcement", title: "triage announcement" });

    const result = await listPendingPostsForTriage({
      workspaceId: ws.id,
      limit: 20,
      ctx: { userId: undefined, workspaceRole: undefined },
    });

    const titles = result.map((p) => p.title);
    expect(titles).toContain("triage feedback");
    expect(titles).not.toContain("triage announcement");
  });
});
