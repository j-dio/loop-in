import { db } from "../../db";
import { sessions, users } from "../../db/schema";
import { eq, and } from "drizzle-orm";
import { generateRefreshToken, hashRefreshToken, refreshTokenExpiryDate } from "./auth.tokens";

export async function upsertOAuthUser(input: {
  provider: "google";
  providerId: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
}) {
  const [user] = await db
    .insert(users)
    .values({
      provider: input.provider,
      providerId: input.providerId,
      email: input.email,
      name: input.name,
      avatarUrl: input.avatarUrl,
    })
    .onConflictDoUpdate({
      target: [users.provider, users.providerId],
      set: {
        email: input.email,
        name: input.name,
        avatarUrl: input.avatarUrl,
      },
    })
    .returning();

  if (!user) throw new Error("Failed to upsert user");
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