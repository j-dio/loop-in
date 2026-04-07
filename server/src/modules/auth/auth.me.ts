import type { Request, Response } from "express";
import jwt from "jsonwebtoken";
import { requireEnv } from "../../config/env";

type AccessTokenClaims = {
  userId: string;
  email: string;
  name: string | null;
};

export function getMe(req: Request, res: Response) {
  const token = req.cookies?.access_token as string | undefined;
  if (!token) return res.json({ user: null });

  try {
    const decoded = jwt.verify(token, requireEnv("JWT_SECRET")) as AccessTokenClaims;

    return res.json({
      user: { id: decoded.userId, email: decoded.email, name: decoded.name },
    });
  } catch {
    return res.json({ user: null });
  }
}