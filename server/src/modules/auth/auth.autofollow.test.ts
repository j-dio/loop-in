import { describe, it, expect, beforeAll, afterEach } from "vitest";
import { inArray } from "drizzle-orm";
import { and, eq } from "drizzle-orm";
import { db } from "../../db";
import { follows, users, workspaces } from "../../db/schema";
import { autoFollowFeaturedWorkspace } from "../workspaces/workspaces.follows.service";

// ---------------------------------------------------------------------------
// Minimal DB seed helpers — only used by integration tests that require a DB.
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
      name: "T",
      provider: "test",
      providerId: uid("pid"),
    })
    .returning();
  return row!;
}

async function seedWorkspace(opts: { slug: string; visibility?: "public" | "invite_only" }) {
  const owner = await seedUser();
  const [row] = await db
    .insert(workspaces)
    .values({
      ownerId: owner.id,
      name: opts.slug,
      slug: opts.slug,
      visibility: opts.visibility ?? "public",
    })
    .returning();
  wsIds.push(row!.id);
  userIds.push(owner.id);
  return row!;
}

const wsIds: string[] = [];
const userIds: string[] = [];

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
// Integration tests — skipped when no DATABASE_URL is configured.
// ---------------------------------------------------------------------------

describe.skipIf(!process.env.DATABASE_URL)("autoFollowFeaturedWorkspace", () => {
  it("follows the featured workspace when the env slug matches", async () => {
    const ws = await seedWorkspace({ slug: uid("featured-app"), visibility: "public" });
    const user = await seedUser();
    userIds.push(user.id);
    process.env.ONBOARDING_FEATURED_SLUG = ws.slug;

    await autoFollowFeaturedWorkspace(user.id);

    const [row] = await db
      .select()
      .from(follows)
      .where(and(eq(follows.userId, user.id), eq(follows.workspaceId, ws.id)))
      .limit(1);
    expect(row).toBeTruthy();

    // cleanup
    delete process.env.ONBOARDING_FEATURED_SLUG;
  });

  it("is a silent no-op when the env slug is unset", async () => {
    const user = await seedUser();
    userIds.push(user.id);
    delete process.env.ONBOARDING_FEATURED_SLUG;
    await expect(autoFollowFeaturedWorkspace(user.id)).resolves.toBeUndefined();
  });

  it("is a silent no-op when the featured slug does not match any workspace", async () => {
    const user = await seedUser();
    userIds.push(user.id);
    process.env.ONBOARDING_FEATURED_SLUG = "nonexistent-workspace-slug-xyz";

    await expect(autoFollowFeaturedWorkspace(user.id)).resolves.toBeUndefined();

    // No follow row should exist
    const [row] = await db
      .select()
      .from(follows)
      .where(eq(follows.userId, user.id))
      .limit(1);
    expect(row).toBeUndefined();

    // cleanup
    delete process.env.ONBOARDING_FEATURED_SLUG;
  });
});
