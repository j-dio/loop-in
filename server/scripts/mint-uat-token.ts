import "../src/config/env";
import { eq } from "drizzle-orm";
import { db, pool } from "../src/db";
import { users } from "../src/db/schema";
import { signAccessToken } from "../src/modules/auth/auth.tokens";

/**
 * LOCAL-ONLY UAT helper. Mints a valid `access_token` JWT for a SEEDED user so Playwright can
 * inject the cookie and skip the OAuth round-trip. NOT a route, NOT reachable in prod — it signs
 * with the same JWT_SECRET the server verifies with, so it only works where you already hold the
 * secret (your dev box). Refuses to run against NODE_ENV=production.
 *
 * Usage:  npx tsx scripts/mint-uat-token.ts <email>
 * Prints the raw token to stdout (nothing else) so callers can capture it cleanly.
 */
async function main() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("mint-uat-token is a local UAT helper and must never run in production");
  }

  const email = process.argv[2];
  if (!email) throw new Error("usage: tsx scripts/mint-uat-token.ts <email>");

  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (!user) throw new Error(`no user with email ${email} — run \`npm run seed\` first`);

  const token = signAccessToken({ userId: user.id, email: user.email, name: user.name });
  // Raw token only — keep stdout clean for capture.
  process.stdout.write(token);
}

main()
  .then(async () => {
    await pool.end();
    process.exit(0);
  })
  .catch(async (err) => {
    // eslint-disable-next-line no-console
    console.error("mint-uat-token failed:", err instanceof Error ? err.message : err);
    await pool.end();
    process.exit(1);
  });
