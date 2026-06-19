import { test, expect } from "@playwright/test";
import { API_BASE, SEED, apiAs, loginAs, mintToken } from "./helpers/auth";

// Checklist §1 — Admin Profile tab (owner = maya on `demo`).
test.describe("Phase 2 — Admin Profile tab", () => {
  test("owner saves profile fields (UI)", async ({ context, page }) => {
    await loginAs(context, SEED.maya);
    const tagline = `UAT tagline ${Date.now()}`;

    await page.goto("/demo/admin");
    await page.getByRole("button", { name: "Profile", exact: true }).click();

    const taglineInput = page.locator("#pf-tagline");
    await expect(taglineInput).toBeVisible();
    await taglineInput.fill(tagline);
    await page.getByRole("button", { name: "Save profile" }).click();
    await expect(page.getByText("Profile saved.")).toBeVisible();

    // Persisted: reload and re-open the tab.
    await page.reload();
    await page.getByRole("button", { name: "Profile", exact: true }).click();
    await expect(page.locator("#pf-tagline")).toHaveValue(tagline);
  });

  test("reorder screenshots (API) — exact-permutation guard accepts a swap", async ({ playwright }) => {
    const api = await apiAs(playwright, SEED.maya);

    const before = await api.get(`/api/workspaces/demo/profile`);
    expect(before.ok()).toBeTruthy();
    const shots: { id: string }[] = (await before.json()).screenshots;
    test.skip(shots.length < 2, "demo needs >=2 seeded screenshots to test reorder");

    const original = shots.map((s) => s.id);
    const reversed = [...original].reverse();

    const res = await api.patch(`/api/workspaces/demo/screenshots/reorder`, { data: { ids: reversed } });
    expect(res.ok(), await res.text()).toBeTruthy();

    const after = await api.get(`/api/workspaces/demo/profile`);
    const newOrder = ((await after.json()).screenshots as { id: string }[]).map((s) => s.id);
    expect(newOrder).toEqual(reversed);

    // Restore original order so the suite is re-runnable.
    await api.patch(`/api/workspaces/demo/screenshots/reorder`, { data: { ids: original } });
    await api.dispose();
  });

  test("screenshot presign is reachable (S3-gated)", async ({ playwright }) => {
    const api = await apiAs(playwright, SEED.maya);
    const res = await api.post(`/api/workspaces/demo/screenshots/presign`, {
      data: { filename: "uat-shot.png", content_type: "image/png" },
    });
    if (res.status() === 503) {
      test.skip(true, "S3 not configured locally (503) — upload presign correctly gated");
    }
    expect(res.ok(), await res.text()).toBeTruthy();
    const body = await res.json();
    expect(body.upload_url).toContain("http");
    expect(body.image_url).toContain("http");
    await api.dispose();
  });
});

test("sanity — mint + /auth/me round-trips", async ({ playwright }) => {
  const token = mintToken(SEED.maya);
  expect(token.split(".")).toHaveLength(3); // looks like a JWT
  const api = await playwright.request.newContext({
    baseURL: API_BASE,
    extraHTTPHeaders: { Cookie: `access_token=${token}` },
  });
  const me = await api.get(`/auth/me`);
  expect(me.ok()).toBeTruthy();
  expect((await me.json()).user?.email).toBe(SEED.maya);
  await api.dispose();
});
