import { db } from "../../db";
import { pendingInvites, sessions, users, workspaceMembers } from "../../db/schema";
import { and, eq, gt, lt, sql } from "drizzle-orm";
import { logger } from "../../lib/logger";
import { generateRefreshToken, hashRefreshToken, refreshTokenExpiryDate } from "./auth.tokens";
import { autoFollowFeaturedWorkspace } from "../workspaces/workspaces.follows.service";

/**
 * Lazy cleanup of expired session rows (PRD §6.2). Fire-and-forget from POST /auth/refresh.
 * Do not await; failures must not affect the refresh response.
 */
export function deleteExpiredSessionsFireAndForget(): void {
  void db
    .delete(sessions)
    .where(lt(sessions.expiresAt, new Date()))
    .catch((err: unknown) => {
      logger.warn({ err }, "session cleanup failed");
    });
}

function pendingInviteRoleToMemberRole(role: string): "admin" | "member" {
  return role === "admin" ? "admin" : "member";
}

/**
 * After OAuth user is known: grant workspace access for any non-expired pending invites
 * matching this email. Skips insert if already a member; always removes the pending row.
 */
export async function consumePendingInvitesForUser(input: { userId: string; email: string }) {
  const normalizedEmail = input.email.trim().toLowerCase();

  await db.transaction(async (tx) => {
    const rows = await tx
      .select()
      .from(pendingInvites)
      .where(
        and(
          sql`lower(${pendingInvites.email}) = ${normalizedEmail}`,
          gt(pendingInvites.expiresAt, new Date())
        )
      );

    for (const inv of rows) {
      const memberRole = pendingInviteRoleToMemberRole(inv.role);

      const [existing] = await tx
        .select({ id: workspaceMembers.id })
        .from(workspaceMembers)
        .where(
          and(
            eq(workspaceMembers.workspaceId, inv.workspaceId),
            eq(workspaceMembers.userId, input.userId)
          )
        )
        .limit(1);

      if (!existing) {
        await tx.insert(workspaceMembers).values({
          workspaceId: inv.workspaceId,
          userId: input.userId,
          role: memberRole,
        });
      }

      await tx.delete(pendingInvites).where(eq(pendingInvites.id, inv.id));
    }
  });
}

export async function upsertOAuthUser(input: {
  provider: "google" | "github";
  providerId: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
}) {
  const providerId = String(input.providerId);

  let user: typeof users.$inferSelect;

  const [byProvider] = await db
    .select()
    .from(users)
    .where(and(eq(users.provider, input.provider), eq(users.providerId, providerId)))
    .limit(1);

  if (byProvider) {
    const [updated] = await db
      .update(users)
      .set({
        email: input.email,
        name: input.name,
        avatarUrl: input.avatarUrl,
      })
      .where(eq(users.id, byProvider.id))
      .returning();
    if (!updated) throw new Error("Failed to update user");
    user = updated;
  } else {
    // Same email as an existing row (e.g. Google then GitHub) would violate
    // users_email_unique on INSERT — treat as the same account for Phase 1.
    const [byEmail] = await db
      .select()
      .from(users)
      .where(eq(users.email, input.email))
      .limit(1);

    if (byEmail) {
      const [updated] = await db
        .update(users)
        .set({
          name: input.name ?? byEmail.name,
          avatarUrl: input.avatarUrl ?? byEmail.avatarUrl,
        })
        .where(eq(users.id, byEmail.id))
        .returning();
      if (!updated) throw new Error("Failed to update user");
      user = updated;
    } else {
      const [inserted] = await db
        .insert(users)
        .values({
          provider: input.provider,
          providerId,
          email: input.email,
          name: input.name,
          avatarUrl: input.avatarUrl,
        })
        .returning();

      if (!inserted) throw new Error("Failed to insert user");
      user = inserted;
      await autoFollowFeaturedWorkspace(user.id);
    }
  }

  await consumePendingInvitesForUser({ userId: user.id, email: user.email });

  return user;
}

export async function createSession(userId: string) {
  const refreshToken = generateRefreshToken();
  const refreshTokenHash = hashRefreshToken(refreshToken);
  const expiresAt = refreshTokenExpiryDate();

  const [session] = await db
    .insert(sessions)
    .values({ userId, refreshTokenHash, expiresAt })
    .returning();

  if (!session) throw new Error("Failed to create session");

  return { sessionId: session.id, refreshToken, expiresAt };
}


export async function findSessionByRefreshTokenHash(refreshTokenHash: string) {
  const [session] = await db
    .select()
    .from(sessions)
    .where(eq(sessions.refreshTokenHash, refreshTokenHash))
    .limit(1);
  return session ?? null;
}

export async function rotateSession(sessionId: string, newRefreshTokenHash: string, newExpiresAt: Date) {
  const [updated] = await db
    .update(sessions)
    .set({ refreshTokenHash: newRefreshTokenHash, expiresAt: newExpiresAt })
    .where(eq(sessions.id, sessionId))
    .returning();
  return updated ?? null;
}

export async function deleteSessionById(sessionId: string) {
  const [deleted] = await db.delete(sessions).where(eq(sessions.id, sessionId)).returning();
  return deleted ?? null;
}
