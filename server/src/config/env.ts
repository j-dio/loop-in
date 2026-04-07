import { config as loadEnv } from "dotenv";

// Local dev: load the repo-root .env so `server/` and tooling share one source.
// Production: rely on real environment variables.
loadEnv({ path: "../.env" });

export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}

