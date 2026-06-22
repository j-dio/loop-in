import { execFileSync } from "node:child_process";
import path from "node:path";
import { test, expect } from "@playwright/test";
import { SEED, loginAs } from "./helpers/auth";

const SERVER_DIR = path.resolve(process.cwd(), "..", "server");

/**
 * Shell out to the LOCAL-ONLY server script that sets/clears `onboarding_completed_at`.
 * Mirrors the pattern in mintToken (shell:true for Windows .cmd resolution).
 */
function resetOnboarding(email: string, mode: "null" | "restore"): void {
  execFileSync(
    "npx",
    ["tsx", "scripts/reset-onboarding-uat.ts", email, mode],
    { cwd: SERVER_DIR, encoding: "utf8", shell: true }
  );
}

// ---------------------------------------------------------------------------
// Onboarding redirect — requires theo's onboarding_completed_at to be NULL
// ---------------------------------------------------------------------------
test.describe("Onboarding gate", () => {
  test.beforeAll(() => {
    resetOnboarding(SEED.theo, "null");
  });

  test.afterAll(() => {
    // Restore so the actor doesn't bounce to /welcome in unrelated specs.
    resetOnboarding(SEED.theo, "restore");
  });

  test("brand-new user is redirected to /welcome and can skip to /home", async ({
    page,
    context,
  }) => {
    // Inject cookie before navigating so /auth/me fires with credentials.
    await loginAs(context, SEED.theo);
    await page.goto("/home");

    // The onboarding gate should redirect to /welcome.
    await expect(page).toHaveURL(/\/welcome$/);

    // Click "Just exploring →" to complete onboarding and land on /home.
    await page.getByText("Just exploring →").click();
    await expect(page).toHaveURL(/\/home$/);

    // Navigating to /home again must NOT bounce back to /welcome.
    await page.goto("/home");
    await expect(page).toHaveURL(/\/home$/);
  });
});

// ---------------------------------------------------------------------------
// Create wizard — reserved-slug rejection (client-side guard)
// ---------------------------------------------------------------------------
test("reserved slug is rejected in the create wizard", async ({ page, context }) => {
  // maya is already onboarded — no redirect risk.
  await loginAs(context, SEED.maya);
  await page.goto("/home");

  // Open the wizard via the "+ New app" button in AppTopBar.
  await page.getByRole("button", { name: /new app/i }).click();

  // Dismiss any auto-focus; fill in fields.
  await page.getByLabel("Name").fill("Home");
  // Manually override the auto-derived slug with a reserved one.
  await page.getByLabel("Slug (URL)").fill("home");
  await page.getByLabel("Tagline").fill("x");
  // Pick a category so the "Category is required" guard doesn't fire first.
  await page.locator("#ws-category").selectOption("Other");

  // Submit — the client guard fires before any network call.
  await page.getByRole("button", { name: /create app/i }).click();

  // Inline error containing "reserved" must appear.
  await expect(page.getByRole("alert")).toContainText(/reserved/i);
});
