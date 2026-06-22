import type { Request, Response } from "express";
import jwt from "jsonwebtoken";
import { eq } from "drizzle-orm";
import { requireEnv } from "../../config/env";
import { db } from "../../db";
import { users } from "../../db/schema";

type AccessTokenClaims = {
  userId: string;
  email: string;
  name: string | null;
};

export async function getMe(req: Request, res: Response) {
  const token = req.cookies?.access_token as string | undefined;
  if (!token) return res.json({ user: null });

  try {
    const decoded = jwt.verify(token, requireEnv("JWT_SECRET")) as AccessTokenClaims;

    // Read fresh from the DB so profile edits (avatar, name) reflect immediately,
    // without waiting for the 15-min access token to rotate.
    const [row] = await db
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
        avatarUrl: users.avatarUrl,
        onboardingCompletedAt: users.onboardingCompletedAt,
      })
      .from(users)
      .where(eq(users.id, decoded.userId))
      .limit(1);

    if (!row) return res.json({ user: null });
    return res.json({ user: row });
  } catch {
    return res.json({ user: null });
  }
}
