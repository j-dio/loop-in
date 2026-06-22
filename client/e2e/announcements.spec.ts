import { test, expect } from "@playwright/test";
import { SEED, apiAs, loginAs } from "./helpers/auth";

/**
 * E2E spec for announcements + pinning (Sub-project C, Task 12).
 *
 * Requires the dev stack to be running (server :3001 + client :5173 + seeded DB).
 * Actor: maya = demo workspace owner.
 */

// ---------------------------------------------------------------------------
// Shared cleanup — delete any "v2 is live" announcement created during tests.
// ---------------------------------------------------------------------------
test.afterAll(async ({ playwright }) => {
  const api = await apiAs(playwright, SEED.maya);
  const listRes = await api.get("/api/workspaces/demo/posts/announcements");
  if (listRes.ok()) {
    const body = (await listRes.json()) as { posts: { id: string; title: string }[] };
    for (const post of body.posts) {
      if (post.title === "v2 is live") {
        await api.delete(`/api/workspaces/demo/posts/${encodeURIComponent(post.id)}`);
      }
    }
  }
  await api.dispose();
});

// ---------------------------------------------------------------------------
// Test 1 — owner posts an announcement via the Admin → Updates UI
// ---------------------------------------------------------------------------
test("owner posts an announcement and it appears in the manager list", async ({
  page,
  context,
}) => {
  await loginAs(context, SEED.maya);
  await page.goto("/demo/admin?section=updates");

  // Wait for the section to load — "New announcement" button is in AnnouncementsManager
  await page.getByRole("button", { name: /new announcement/i }).click();

  // Dialog opens — fill in the title field (label="Title", id="announcement-title")
  await page.getByLabel("Title").fill("v2 is live");

  // Submit — button text is "Publish"
  await page.getByRole("button", { name: "Publish" }).click();

  // The announcement appears in the list (AnnouncementsManager renders the title as text)
  await expect(page.getByText("v2 is live")).toBeVisible();
});

// ---------------------------------------------------------------------------
// Test 2 — announcement is interactive: opens as a thread with a comment box
// ---------------------------------------------------------------------------
test("announcement opens as a thread with a comment box", async ({
  page,
  context,
  playwright,
}) => {
  // Ensure the announcement exists and is pinned so it appears in the PinnedStrip on the board.
  // Announcements are not in the main feedback feed (type filter); the PinnedStrip is the
  // only place they surface on the board page without navigating to admin.
  const api = await apiAs(playwright, SEED.maya);

  // Get or create the "v2 is live" announcement.
  const listRes = await api.get("/api/workspaces/demo/posts/announcements");
  const listBody = (await listRes.json()) as {
    posts: { id: string; title: string; pinnedAt: string | null }[];
  };
  let announcement = listBody.posts.find((p) => p.title === "v2 is live");
  if (!announcement) {
    const createRes = await api.post("/api/workspaces/demo/posts/announcements", {
      data: { title: "v2 is live", description: null },
    });
    const createBody = (await createRes.json()) as {
      post: { id: string; title: string; pinnedAt: string | null };
    };
    announcement = createBody.post;
  }

  // Pin it so it appears in the PinnedStrip on the board (only if not already pinned).
  // Note: pin cap is 3; we pin exactly 1 here so it's well within the cap.
  if (!announcement.pinnedAt) {
    // First ensure cap headroom: unpin everything except this post.
    const pinnedRes = await api.get("/api/workspaces/demo/posts/pinned");
    const pinnedBody = (await pinnedRes.json()) as { posts: { id: string }[] };
    for (const p of pinnedBody.posts) {
      if (p.id !== announcement.id) {
        await api.patch(`/api/workspaces/demo/posts/${p.id}/pin`, {
          data: { pinned: false },
        });
      }
    }
    await api.patch(
      `/api/workspaces/demo/posts/${announcement.id}/pin`,
      { data: { pinned: true } }
    );
  }

  await api.dispose();

  await loginAs(context, SEED.maya);

  // Navigate to the board — PinnedStrip renders any pinned post (including announcements).
  await page.goto("/demo");

  // The announcement title is rendered as a Link inside PinnedStrip → PostCard.
  // It appears in the `aria-label="Pinned posts"` section.
  const pinnedSection = page.getByRole("region", { name: "Pinned posts" });
  await expect(pinnedSection).toBeVisible({ timeout: 10_000 });
  await pinnedSection.getByText("v2 is live").click();

  // Should land on the thread page
  await expect(page).toHaveURL(/\/demo\/post\//);

  // Comment box with placeholder "Write a comment…" should be visible (Thread.tsx line 580)
  await expect(page.getByPlaceholder("Write a comment…")).toBeVisible();
});

// ---------------------------------------------------------------------------
// Test 3 — pin cap: a 4th pin is rejected with 409
// ---------------------------------------------------------------------------
test("pin cap: a 4th pin attempt is rejected with 409", async ({ playwright }) => {
  const api = await apiAs(playwright, SEED.maya);

  // Step 1 — get all approved posts in the demo workspace so we have IDs to pin.
  // Use the admin kanban endpoint which returns approved+non-deleted feedback posts.
  const kanbanRes = await api.get("/api/workspaces/demo/posts/admin/kanban");
  expect(kanbanRes.ok()).toBeTruthy();
  const kanbanBody = (await kanbanRes.json()) as { posts: { id: string }[] };
  const allPostIds = kanbanBody.posts.map((p) => p.id);
  expect(allPostIds.length).toBeGreaterThanOrEqual(4);

  // Step 2 — unpin everything first so we start from a clean state (idempotent).
  // Use the /pinned endpoint to get ALL currently-pinned posts (including announcements pinned
  // by Test 2), then unpin them — the kanban list only returns feedback-type posts.
  const pinnedRes = await api.get("/api/workspaces/demo/posts/pinned");
  if (pinnedRes.ok()) {
    const pinnedBody = (await pinnedRes.json()) as { posts: { id: string }[] };
    for (const p of pinnedBody.posts) {
      await api.patch(`/api/workspaces/demo/posts/${p.id}/pin`, {
        data: { pinned: false },
      });
    }
  }

  // Step 3 — pin the first 3 posts (should all succeed).
  const toPin = allPostIds.slice(0, 4); // grab 4; first 3 must pass, 4th must fail
  for (const id of toPin.slice(0, 3)) {
    const res = await api.patch(`/api/workspaces/demo/posts/${id}/pin`, {
      data: { pinned: true },
    });
    expect(res.status()).toBe(200);
  }

  // Step 4 — attempt to pin a 4th post: must return 409.
  const fourthRes = await api.patch(
    `/api/workspaces/demo/posts/${toPin[3]}/pin`,
    { data: { pinned: true } }
  );
  expect(fourthRes.status()).toBe(409);
  const fourthBody = (await fourthRes.json()) as { error: string };
  expect(fourthBody.error).toMatch(/pin at most 3/i);

  // Cleanup — unpin the 3 we pinned so future runs start clean.
  for (const id of toPin.slice(0, 3)) {
    await api.patch(`/api/workspaces/demo/posts/${id}/pin`, {
      data: { pinned: false },
    });
  }

  await api.dispose();
});
