import { describe, it, expect, afterEach } from "vitest";
import { inArray } from "drizzle-orm";
import { db } from "../../db";
import { users } from "../../db/schema";
import { completeOnboarding } from "./users.service";

// ---------------------------------------------------------------------------
// Minimal DB seed helpers — only used by integration tests that require a DB.
// ---------------------------------------------------------------------------

let _counter = 0;
function uid(prefix: string) {
  return `${prefix}-${Date.now()}-${++_counter}`;
}

const userIds: string[] = [];

async function seedUser() {
  const [row] = await db
    .insert(users)
    .values({
      email: `${uid("u")}@test.invalid`,
      name: "T",
      provider: "test",
      providerId: uid("pid"),
    })
    .returning();
  userIds.push(row!.id);
  return row!;
}

afterEach(async () => {
  if (userIds.length) {
    await db.delete(users).where(inArray(users.id, [...userIds]));
    userIds.length = 0;
  }
});

// ---------------------------------------------------------------------------
// Integration tests — skipped when no DATABASE_URL is configured.
// ---------------------------------------------------------------------------

describe.skipIf(!process.env.DATABASE_URL)("completeOnboarding", () => {
  it("stamps onboarding_completed_at and returns it", async () => {
    const user = await seedUser(); // brand-new: onboarding_completed_at null
    const result = await completeOnboarding(user.id);
    expect(result).not.toBeNull();
    expect(result!.onboardingCompletedAt).toBeTruthy();
  });

  it("is idempotent — re-stamps without error", async () => {
    const user = await seedUser();
    const first = await completeOnboarding(user.id);
    expect(first!.onboardingCompletedAt).toBeTruthy();
    const second = await completeOnboarding(user.id);
    expect(second!.onboardingCompletedAt).toBeTruthy();
  });

  it("returns null for a non-existent user id", async () => {
    const result = await completeOnboarding("00000000-0000-0000-0000-000000000000");
    expect(result).toBeNull();
  });
});
