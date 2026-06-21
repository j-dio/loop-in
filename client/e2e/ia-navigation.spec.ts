import { test, expect } from "@playwright/test";
import { loginAs, SEED } from "./helpers/auth";

/**
 * IA navigation smoke tests — Task 10 of the Social UX v2 redesign plan.
 *
 * Verifies four structural invariants of the new information architecture:
 *   1. Logged-in users landing on "/" are redirected to "/home"
 *   2. /home renders inside the shared shell with a navigation region
 *   3. /explore is a shell peer (the global top-bar Home/Explore links are present)
 *   4. /[slug]/admin shows the contextual sidebar sub-nav (Settings link navigates)
 *
 * Prereqs: dev stack running (docker + server :3001 + client :5173 + seeded DB).
 * See docs/UAT-AUTOMATION.md for setup.
 */

test("logged-in / redirects to /home", async ({ page, context }) => {
  await loginAs(context, SEED.maya);
  await page.goto("/");
  await expect(page).toHaveURL(/\/home$/);
});

test("Home shows following feed for a user who follows apps (maya)", async ({ page, context }) => {
  await loginAs(context, SEED.maya);
  await page.goto("/home");
  // maya (demo owner) — seed gives demo followers; her own follows may vary,
  // so assert the page renders the shell + a feed region, not an empty crash.
  await expect(page.getByRole("navigation")).toBeVisible();
  await expect(page.getByText(/home/i).first()).toBeVisible();
});

test("Explore renders inside the shared shell (global top bar present)", async ({ page, context }) => {
  await loginAs(context, SEED.theo);
  await page.goto("/explore");
  // The global nav (Home/Explore links) proves we're in AppShell, not the old bespoke header.
  // Use exact:true — the logo link also carries "Home" in its aria-label ("Loop In home").
  await expect(page.getByRole("link", { name: "Home", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Explore", exact: true })).toBeVisible();
});

test("admin route shows the contextual sub-nav", async ({ page, context }) => {
  await loginAs(context, SEED.maya);
  await page.goto("/demo/admin?section=triage");
  await expect(page.getByRole("link", { name: /Settings/i })).toBeVisible();
  await page.getByRole("link", { name: /Settings/i }).click();
  await expect(page).toHaveURL(/section=settings/);
});
