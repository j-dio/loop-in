import { test, expect } from "@playwright/test";
import { SEED, apiAs, loginAs } from "./helpers/auth";

// Checklist §3 — participant writes on a PUBLIC board by a NON-member (theo).
test.describe("Participant access on a public board", () => {
  test("non-member can create a post (participant tier)", async ({ playwright }) => {
    const api = await apiAs(playwright, SEED.theo);
    const res = await api.post(`/api/workspaces/demo/posts`, {
      data: {
        title: `UAT participant post ${Date.now()}`,
        description: "Submitted by a non-member via the participant tier.",
        category: "feature_request",
      },
    });
    expect(res.status(), await res.text()).toBe(201);
    expect((await res.json()).post?.id).toBeTruthy();
    await api.dispose();
  });

  test("non-member can comment + upvote", async ({ playwright }) => {
    const api = await apiAs(playwright, SEED.theo);
    const list = await api.get(`/api/workspaces/demo/posts`);
    const postId = (await list.json()).posts[0].id as string;

    const comment = await api.post(`/api/workspaces/demo/posts/${postId}/comments`, {
      data: { content: "Participant comment from a non-member." },
    });
    expect(comment.status(), await comment.text()).toBeLessThan(300);

    const upvote = await api.post(`/api/workspaces/demo/posts/${postId}/upvote`);
    expect(upvote.status(), await upvote.text()).toBeLessThan(300);
    await api.dispose();
  });

  // GAP NOW FIXED (Board.tsx canPost = signed-in && readable board, no longer membership-gated):
  // a signed-in non-member sees an ENABLED "Submit feedback" button on a public board and can
  // submit a post through the UI (not just the API). The optimistic insert shows it immediately.
  test("non-member sees an enabled Submit feedback button and can submit a post via the UI", async ({
    context,
    page,
  }) => {
    await loginAs(context, SEED.theo);
    await page.goto("/demo");

    const submit = page.getByRole("button", { name: "Submit feedback" });
    await expect(submit).toBeVisible();
    await expect(submit).toBeEnabled();
    await submit.click();

    const dialog = page.getByRole("dialog");
    const title = `UAT UI post ${Date.now()}`;
    await dialog.getByLabel("Title").fill(title);
    await dialog.getByLabel("Description").fill("Created through the Board UI by a non-member.");
    await dialog.getByRole("button", { name: "Submit", exact: true }).click();

    await expect(dialog).toBeHidden();
    // Optimistically inserted into the feed (pendingLocal) so it shows even while pending moderation.
    await expect(page.getByText(title)).toBeVisible();
  });

  // Thread page: a non-member can comment AND upvote an approved post through the UI.
  test("non-member can comment and upvote through the Thread UI", async ({ playwright, context, page }) => {
    // Pick an approved demo post to act on (public list returns only approved posts).
    const api = await apiAs(playwright, SEED.theo);
    const list = await api.get(`/api/workspaces/demo/posts`);
    const postId = (await list.json()).posts[0].id as string;
    await api.dispose();

    await loginAs(context, SEED.theo);
    await page.goto(`/demo/post/${postId}`);

    // Comment via the UI.
    const comment = `UAT UI comment ${Date.now()}`;
    await page.getByRole("textbox", { name: "Add a comment" }).fill(comment);
    await page.getByRole("button", { name: "Post comment" }).click();
    await expect(page.getByText(comment)).toBeVisible();

    // Upvote via the UI — the post-header upvote button toggles aria-pressed.
    const upvote = page.locator("article button[aria-pressed]").first();
    const before = await upvote.getAttribute("aria-pressed");
    await upvote.click();
    await expect(upvote).toHaveAttribute("aria-pressed", before === "true" ? "false" : "true");
  });
});
