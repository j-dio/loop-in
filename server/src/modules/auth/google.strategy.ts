import passport from "passport";
import { Strategy as GoogleStrategy, type Profile } from "passport-google-oauth20";
import { requireEnv } from "../../config/env";

export type GoogleVerifiedProfile = {
  provider: "google";
  providerId: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
};

export function configureGooglePassport() {
  passport.use(
    new GoogleStrategy(
      {
        clientID: requireEnv("GOOGLE_CLIENT_ID"),
        clientSecret: requireEnv("GOOGLE_CLIENT_SECRET"),
        callbackURL: `${requireEnv("SERVER_URL")}/auth/google/callback`,
      },
      async (_accessToken: string, _refreshToken: string, profile: Profile, done) => {
        try {
          const email = profile.emails?.[0]?.value;
          if (!email) return done(new Error("Google profile missing email"));

          const verified: GoogleVerifiedProfile = {
            provider: "google",
            providerId: profile.id,
            email,
            name: profile.displayName ?? null,
            avatarUrl: profile.photos?.[0]?.value ?? null,
          };

          return done(null, verified);
        } catch (err) {
          return done(err as Error);
        }
      }
    )
  );

  return passport;
}