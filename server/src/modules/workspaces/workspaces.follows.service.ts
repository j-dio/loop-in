import { and, eq, sql } from "drizzle-orm";
import { db } from "../../db";
import { follows, workspaces } from "../../db/schema";
import { logger } from "../../lib/logger";

/** Idempotent: a second follow is a no-op via the unique (user_id, workspace_id) constraint. */
export async function followWorkspace(input: {
  userId: string;
  workspaceId: string;
}): Promise<void> {
  await db
    .insert(follows)
    .values({ userId: input.userId, workspaceId: input.workspaceId })
    .onConflictDoNothing();
}

/** Idempotent: unfollowing when not following is a no-op. */
export async function unfollowWorkspace(input: {
  userId: string;
  workspaceId: string;
}): Promise<void> {
  await db
    .delete(follows)
    .where(and(eq(follows.userId, input.userId), eq(follows.workspaceId, input.workspaceId)));
}

export async function getFollowerCount(workspaceId: string): Promise<number> {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(follows)
    .where(eq(follows.workspaceId, workspaceId));
  return Number(row?.count ?? 0);
}

export async function isFollowing(input: {
  userId: string;
  workspaceId: string;
}): Promise<boolean> {
  const [row] = await db
    .select({ id: follows.id })
    .from(follows)
    .where(and(eq(follows.userId, input.userId), eq(follows.workspaceId, input.workspaceId)))
    .limit(1);
  return Boolean(row);
}

/**
 * Best-effort: follow the configured featured workspace so a brand-new user's
 * Following feed is never empty and the showcase app gets a first follower.
 * Never throws — onboarding must not break signup.
 */
export async function autoFollowFeaturedWorkspace(userId: string): Promise<void> {
  const slug = process.env.ONBOARDING_FEATURED_SLUG?.trim();
  if (!slug) return;
  try {
    const [ws] = await db
      .select({ id: workspaces.id })
      .from(workspaces)
      .where(eq(workspaces.slug, slug))
      .limit(1);
    if (!ws) return;
    await followWorkspace({ userId, workspaceId: ws.id });
  } catch (err) {
    logger.warn({ err, slug }, "auto-follow featured workspace failed");
  }
}
