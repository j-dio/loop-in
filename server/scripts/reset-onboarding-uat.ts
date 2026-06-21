import "../src/config/env";
import { eq, isNull, sql } from "drizzle-orm";
import { db, pool } from "../src/db";
import { users } from "../src/db/schema";

/**
 * LOCAL-ONLY UAT helper. Sets `onboarding_completed_at` for a seeded user to NULL
 * (simulating a brand-new account that has never completed onboarding) or restores it
 * to `now()` (mark as completed). Never a route, never runs in production.
 *
 * Usage:
 *   npx tsx scripts/reset-onboarding-uat.ts <email> null     → sets to NULL
 *   npx tsx scripts/reset-onboarding-uat.ts <email> restore  → sets to now()
 */
async function main() {
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "reset-onboarding-uat is a local UAT helper and must never run in production"
    );
  }

  const email = process.argv[2];
  const mode = process.argv[3];
  if (!email || (mode !== "null" && mode !== "restore")) {
    throw new Error(
      "usage: tsx scripts/reset-onboarding-uat.ts <email> <null|restore>"
    );
  }

  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (!user) {
    throw new Error(`no user with email ${email} — run \`npm run seed\` first`);
  }

  if (mode === "null") {
    await db
      .update(users)
      .set({ onboardingCompletedAt: null })
      .where(eq(users.email, email));
    process.stdout.write("null\n");
  } else {
    await db
      .update(users)
      .set({ onboardingCompletedAt: sql`now()` })
      .where(eq(users.email, email));
    process.stdout.write("restored\n");
  }
}

main()
  .then(async () => {
    await pool.end();
    process.exit(0);
  })
  .catch(async (err) => {
    // eslint-disable-next-line no-console
    console.error(
      "reset-onboarding-uat failed:",
      err instanceof Error ? err.message : err
    );
    await pool.end();
    process.exit(1);
  });
