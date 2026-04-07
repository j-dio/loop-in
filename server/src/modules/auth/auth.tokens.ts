import jwt from "jsonwebtoken";
import crypto from "crypto";
import { requireEnv } from "../../config/env";

const JWT_SECRET = requireEnv("JWT_SECRET");

export type AccessTokenClaims = {
  userId: string;
  email: string;
  name: string | null;
};

export function signAccessToken(claims: AccessTokenClaims): string {
  return jwt.sign(claims, JWT_SECRET, { expiresIn: "15m" });
}

export function generateRefreshToken(): string {
  return crypto.randomBytes(32).toString("base64url");
}

export function hashRefreshToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function refreshTokenExpiryDate(): Date {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  return d;
}