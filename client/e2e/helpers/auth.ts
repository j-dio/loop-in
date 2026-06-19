import { execFileSync } from "node:child_process";
import path from "node:path";
import type { APIRequestContext, BrowserContext, Cookie, Playwright } from "@playwright/test";

/**
 * UAT auth = JWT cookie injection (no OAuth). `mintToken` shells out to the LOCAL-ONLY server
 * script `server/scripts/mint-uat-token.ts`, which signs an access_token for a seeded user with
 * the same JWT_SECRET the server verifies with. Never a prod endpoint — it only works where you
 * already hold the secret (your dev box). See docs/UAT-AUTOMATION.md.
 */

export const API_BASE = process.env.UAT_API_BASE ?? "http://localhost:3001";
export const CLIENT_BASE = process.env.UAT_CLIENT_BASE ?? "http://localhost:5173";

// Seeded users (server/src/db/seed.ts). maya owns `demo`; theo follows only orbit-notes,
// so theo is a clean NON-member, NON-follower of `demo` for follow + participant tests.
export const SEED = {
  maya: "maya@loopin-demo.dev", // demo owner
  devon: "devon@loopin-demo.dev",
  priya: "priya@loopin-demo.dev",
  sam: "sam@loopin-demo.dev",
  lena: "lena@loopin-demo.dev",
  theo: "theo@loopin-demo.dev", // not a member/follower of demo
} as const;

const SERVER_DIR = path.resolve(process.cwd(), "..", "server");
const tokenCache = new Map<string, string>();

export function mintToken(email: string): string {
  const cached = tokenCache.get(email);
  if (cached) return cached;
  // shell:true so Windows resolves npx.cmd (spawning .cmd without a shell throws EINVAL on
  // modern Node). Emits a harmless DEP0190 warning; args are static/local so it's safe.
  const out = execFileSync("npx", ["tsx", "scripts/mint-uat-token.ts", email], {
    cwd: SERVER_DIR,
    encoding: "utf8",
    shell: true,
  });
  // Defensive: take the last JWT-shaped line in case any tooling banner leaks onto stdout.
  const token = out
    .trim()
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .pop();
  if (!token || !/^[\w-]+\.[\w-]+\.[\w-]+$/.test(token)) {
    throw new Error(`mint-uat-token gave no valid token for ${email} (seeded? env ok?):\n${out}`);
  }
  tokenCache.set(email, token);
  return token;
}

/** Cookie matching server's setAuthCookies: host-only `localhost`, path "/", lax, non-secure (dev). */
export function authCookie(token: string): Cookie {
  return {
    name: "access_token",
    value: token,
    domain: "localhost",
    path: "/",
    expires: -1,
    httpOnly: true,
    secure: false,
    sameSite: "Lax",
  };
}

/** Inject a seeded user's session into a browser context (for UI specs). */
export async function loginAs(context: BrowserContext, email: string): Promise<void> {
  await context.addCookies([authCookie(mintToken(email))]);
}

/** API client carrying a seeded user's cookie (for API-level specs: rate limit, participant). */
export async function apiAs(playwright: Playwright, email: string): Promise<APIRequestContext> {
  return playwright.request.newContext({
    baseURL: API_BASE,
    extraHTTPHeaders: { Cookie: `access_token=${mintToken(email)}` },
  });
}
