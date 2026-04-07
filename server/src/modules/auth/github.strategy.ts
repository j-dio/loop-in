import passport from "passport";
import { Strategy as GitHubStrategy, type Profile } from "passport-github2";
import { requireEnv } from "../../config/env";

export type GitHubVerifiedProfile = {
  provider: "github";
  providerId: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
};

type Done = (error: Error | null, user?: GitHubVerifiedProfile | false, info?: unknown) => void;

type GitHubEmail = {
  email: string;
  primary: boolean;
  verified: boolean;
  visibility: "public" | "private" | null;
};

async function fetchGitHubPrimaryEmail(accessToken: string): Promise<string | null> {
  const res = await fetch("https://api.github.com/user/emails", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "loopin-local-dev",
    },
  });
  if (!res.ok) return null;
  const emails = (await res.json()) as GitHubEmail[];
  const primaryVerified = emails.find((e) => e.primary && e.verified)?.email;
  if (primaryVerified) return primaryVerified;
  const anyVerified = emails.find((e) => e.verified)?.email;
  return anyVerified ?? null;
}

export function configureGitHubPassport() {
  passport.use(
    new GitHubStrategy(
      {
        clientID: requireEnv("GITHUB_CLIENT_ID"),
        clientSecret: requireEnv("GITHUB_CLIENT_SECRET"),
        callbackURL: `${requireEnv("SERVER_URL")}/auth/github/callback`,
        // This makes GitHub return email *when available* (still can be missing).
        scope: ["user:email"],
      },
      async (accessToken: string, _refreshToken: string, profile: Profile, done: Done) => {
        try {
          const emailFromProfile = profile.emails?.[0]?.value ?? null;
          const email = emailFromProfile ?? (await fetchGitHubPrimaryEmail(accessToken));
          if (!email) return done(new Error("GitHub profile missing email"));

          const verified: GitHubVerifiedProfile = {
            provider: "github",
            providerId: String(profile.id),
            email,
            name: profile.displayName ?? profile.username ?? null,
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