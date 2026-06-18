import { eq } from "drizzle-orm";
import { db } from "../../db";
import { users } from "../../db/schema";

export type PublicUser = {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
};

/** Patch the signed-in user's profile. Returns the fresh public user, or null if missing. */
export async function updateUserProfile(
  userId: string,
  patch: { avatarUrl?: string | null; name?: string }
): Promise<PublicUser | null> {
  const set: Partial<{ avatarUrl: string | null; name: string }> = {};
  if (patch.avatarUrl !== undefined) set.avatarUrl = patch.avatarUrl;
  if (patch.name !== undefined) set.name = patch.name;

  const [row] = await db
    .update(users)
    .set(set)
    .where(eq(users.id, userId))
    .returning({
      id: users.id,
      email: users.email,
      name: users.name,
      avatarUrl: users.avatarUrl,
    });

  return row ?? null;
}
