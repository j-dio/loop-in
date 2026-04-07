import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { requireEnv } from "../config/env";

type AccessTokenClaims = {
  userId: string;
  email: string;
  name: string | null;
  iat: number;
  exp: number;
};

function decodeAccessToken(req: Request): AccessTokenClaims | null {
  const token = req.cookies?.access_token as string | undefined;
  if (!token) return null;

  try {
    return jwt.verify(token, requireEnv("JWT_SECRET")) as AccessTokenClaims;
  } catch {
    return null;
  }
}

export function authenticate(req: Request, res: Response, next: NextFunction) {
  const claims = decodeAccessToken(req);
  if (!claims) return res.status(401).json({ error: "Unauthorized" });

  req.user = { id: claims.userId, email: claims.email, name: claims.name };
  return next();
}

export function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  const claims = decodeAccessToken(req);
  if (claims) req.user = { id: claims.userId, email: claims.email, name: claims.name };
  return next();
}

