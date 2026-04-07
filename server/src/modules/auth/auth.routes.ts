import { Router } from "express";
import passport from "passport";
import { configureGooglePassport, type GoogleVerifiedProfile } from "./google.strategy";
import { upsertOAuthUser, createSession } from "./auth.service";
import { signAccessToken } from "./auth.tokens";
import { setAuthCookies } from "./auth.cookies";
import { requireEnv } from "../../config/env";

configureGooglePassport();

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