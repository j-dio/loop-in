import { config as loadEnv } from "dotenv";

// Local dev: load the repo-root .env so `server/` and tooling share one source.
// Production: rely on real environment variables.
// quiet: suppress dotenv's startup banner so it never pollutes script stdout (e.g. the
// UAT mint-token helper, whose only output must be the raw token).
loadEnv({ path: "../.env", quiet: true });

export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}

/**
 * Fail-fast validation run once at startup (before the server listens). Missing *required* vars throw
 * so a misconfigured deploy crashes immediately instead of 500-ing on first request. Missing
 * *recommended* vars only warn — the app still boots with that feature degraded.
 */
export function validateEnv(): void {
  const required = [
    "DATABASE_URL",
    "JWT_SECRET",
    "GOOGLE_CLIENT_ID",
    "GOOGLE_CLIENT_SECRET",
    "GITHUB_CLIENT_ID",
    "GITHUB_CLIENT_SECRET",
    "CLIENT_URL",
    "SERVER_URL",
  ];
  const missing = required.filter((name) => !process.env[name]?.trim());
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
  }

  // Recommended (feature-gated): warn only.
  const recommended = [
    "REDIS_URL",
    "S3_BUCKET",
    "AWS_REGION",
    "GEMINI_API_KEY",
    "SES_FROM_EMAIL",
    "SENTRY_DSN",
  ];
  const degraded = recommended.filter((name) => !process.env[name]?.trim());
  if (degraded.length > 0) {
    // eslint-disable-next-line no-console -- logger isn't wired here; this runs before app bootstrap.
    console.warn(`[env] Recommended variables not set (feature degraded): ${degraded.join(", ")}`);
  }
}

