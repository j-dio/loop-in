import { and, eq, sql } from "drizzle-orm";
import { db } from "../../db";
import { follows } from "../../db/schema";

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
