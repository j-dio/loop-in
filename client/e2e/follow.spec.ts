import { test, expect } from "@playwright/test";
import { SEED, apiAs, loginAs, mintToken } from "./helpers/auth";

// Checklist §2 — Follow graph + Following feed. theo is NOT a member/follower of `demo`.
test.describe("Phase 3 — Follow + Following feed", () => {
  test.beforeAll(async ({ playwright }) => {
    // Deterministic start: force theo unfollowed (idempotent — 200 whether or not following).
    const api = await apiAs(playwright, SEED.theo);
    await api.delete(`/api/workspaces/demo/follow`);
    await api.dispose();
  });

  test("follow / unfollow from ProfileHeader is optimistic + persists", async ({ context, page }) => {
    await loginAs(context, SEED.theo);
    await page.goto("/demo");

    const followBtn = page.getByRole("button", { name: "Follow", exact: true });
    await expect(followBtn).toBeVisible();
    await followBtn.click();

    // Optimistic flip to Following.
    const followingBtn = page.getByRole("button", { name: "Following", exact: true });
    await expect(followingBtn).toBeVisible();
    await expect(followingBtn).toHaveAttribute("aria-pressed", "true");

    // Persists across reload.
    await page.reload();
    await expect(page.getByRole("button", { name: "Following", exact: true })).toBeVisible();
  });

  test("Following tab shows posts from followed apps", async ({ context, page, playwright }) => {
    // Ensure theo follows demo (the prior test may run independently).
    const api = await apiAs(playwright, SEED.theo);
    await api.post(`/api/workspaces/demo/follow`);
    await api.dispose();

    await loginAs(context, SEED.theo);
    await page.goto("/explore");
    // "Following" is ambiguous (the segmented tab + a directory FollowButton now reads "Following").
    // Target the tab specifically: it's the sibling button of the unique "Discover" tab.
    await page
      .getByRole("button", { name: "Discover", exact: true })
      .locator('xpath=following-sibling::button[normalize-space()="Following"]')
      .click();

    // A seeded approved demo post appears in the Following feed. (It shows twice — once as the
    // post item and once as its status-update item from the two-query merge — so take .first().)
    await expect(page.getByText("Dark mode for the dashboard").first()).toBeVisible();
  });

  test.afterAll(async ({ playwright }) => {
    const api = await apiAs(playwright, SEED.theo);
    await api.delete(`/api/workspaces/demo/follow`); // leave clean for re-runs
    await api.dispose();
  });
});

test("follow endpoint is idempotent + returns count", async ({ playwright }) => {
  mintToken(SEED.devon);
  const api = await apiAs(playwright, SEED.devon); // devon already follows demo in seed
  const r1 = await api.post(`/api/workspaces/demo/follow`);
  expect(r1.ok()).toBeTruthy();
  const r2 = await api.post(`/api/workspaces/demo/follow`); // second follow — no duplicate
  expect(r2.ok()).toBeTruthy();
  const body = await r2.json();
  expect(body.following).toBe(true);
  expect(typeof body.followerCount).toBe("number");
  await api.dispose();
});
