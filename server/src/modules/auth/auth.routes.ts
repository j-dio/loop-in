import { Router } from "express";
import passport from "passport";
import { configureGooglePassport, type GoogleVerifiedProfile } from "./google.strategy";
import {
  createSession,
  deleteExpiredSessionsFireAndForget,
  deleteSessionById,
  findSessionByRefreshTokenHash,
  rotateSession,
  upsertOAuthUser,
} from "./auth.service";
import {
  generateRefreshToken,
  hashRefreshToken,
  refreshTokenExpiryDate,
  signAccessToken,
} from "./auth.tokens";
import { clearAuthCookies, setAuthCookies } from "./auth.cookies";
import { requireEnv } from "../../config/env";
import { getMe } from "./auth.me";
import { configureGitHubPassport, type GitHubVerifiedProfile } from "./github.strategy";
import { db } from "../../db";
import { users } from "../../db/schema";
import { eq } from "drizzle-orm";

configureGooglePassport();
configureGitHubPassport();

export const authRouter = Router();

/**
 * GET /auth/google
 * Redirects to Google consent screen.
 */
authRouter.get(
  "/google",
  passport.authenticate("google", {
    session: false,
    scope: ["openid", "profile", "email"],
    prompt: "select_account",
  })
);

/**
 * GET /auth/google/callback
 * Exchanges code -> profile, upserts user, creates session, sets cookies, redirects to client.
 */
authRouter.get(
  "/google/callback",
  passport.authenticate("google", { session: false, failureRedirect: `${requireEnv("CLIENT_URL")}/?auth=failed` }),
  async (req, res, next) => {
    try {
      const profile = req.user as GoogleVerifiedProfile | undefined;
      if (!profile) throw new Error("Missing verified OAuth profile");

      const user = await upsertOAuthUser(profile);
      const { refreshToken } = await createSession(user.id);

      const accessToken = signAccessToken({
        userId: user.id,
        email: user.email,
        name: user.name ?? null,
      });

      setAuthCookies(res, accessToken, refreshToken);

      // Your client already plans a route at /auth/callback in Phase 0.
      res.redirect(`${requireEnv("CLIENT_URL")}/auth/callback`);
    } catch (err) {
      next(err);
    }
  }
);

authRouter.get("/me", getMe);

authRouter.post("/refresh", async (req, res, next) => {
  try {
    const refreshToken = req.cookies?.refresh_token as string | undefined;
    if (!refreshToken) return res.status(401).json({ ok: false });

    const refreshHash = hashRefreshToken(refreshToken);
    const session = await findSessionByRefreshTokenHash(refreshHash);
    if (!session) return res.status(401).json({ ok: false });

    if (new Date(session.expiresAt) <= new Date()) {
      await deleteSessionById(session.id);
      clearAuthCookies(res);
      return res.status(401).json({ ok: false });
    }

    const [user] = await db.select().from(users).where(eq(users.id, session.userId)).limit(1);
    if (!user) return res.status(401).json({ ok: false });

    const nextRefreshToken = generateRefreshToken();
    const nextRefreshHash = hashRefreshToken(nextRefreshToken);
    const nextExpiresAt = refreshTokenExpiryDate();

    const rotated = await rotateSession(session.id, nextRefreshHash, nextExpiresAt);
    if (!rotated) return res.status(500).json({ ok: false });

    const accessToken = signAccessToken({
      userId: user.id,
      email: user.email,
      name: user.name ?? null,
    });

    setAuthCookies(res, accessToken, nextRefreshToken);
    deleteExpiredSessionsFireAndForget();
    return res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

authRouter.post("/logout", async (req, res, next) => {
  try {
    const refreshToken = req.cookies?.refresh_token as string | undefined;
    if (refreshToken) {
      const refreshHash = hashRefreshToken(refreshToken);
      const session = await findSessionByRefreshTokenHash(refreshHash);
      if (session) await deleteSessionById(session.id);
    }

    clearAuthCookies(res);
    return res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

authRouter.get(
  "/github",
  passport.authenticate("github", {
    session: false,
    scope: ["user:email"],
  })
);

authRouter.get(
  "/github/callback",
  passport.authenticate("github", {
    session: false,
    failureRedirect: `${requireEnv("CLIENT_URL")}/?auth=failed`,
  }),
  async (req, res, next) => {
    try {
      const profile = req.user as GitHubVerifiedProfile | undefined;
      if (!profile) throw new Error("Missing verified OAuth profile");

      const user = await upsertOAuthUser(profile);
      const { refreshToken } = await createSession(user.id);

      const accessToken = signAccessToken({
        userId: user.id,
        email: user.email,
        name: user.name ?? null,
      });

      setAuthCookies(res, accessToken, refreshToken);
      res.redirect(`${requireEnv("CLIENT_URL")}/auth/callback`);
    } catch (err) {
      next(err);
    }
  }
);