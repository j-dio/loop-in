import { db } from "../../db";
import { sessions, users } from "../../db/schema";
import { lt, eq, and } from "drizzle-orm";
import { generateRefreshToken, hashRefreshToken, refreshTokenExpiryDate } from "./auth.tokens";

export async function upsertOAuthUser(input: {
  provider: "google" | "github";
  providerId: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
}) {
  const providerId = String(input.providerId);

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
    return updated;
  }

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
    return updated;
  }

  const [user] = await db
    .insert(users)
    .values({
      provider: input.provider,
      providerId,
      email: input.email,
      name: input.name,
      avatarUrl: input.avatarUrl,
    })
    .returning();

  if (!user) throw new Error("Failed to insert user");
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