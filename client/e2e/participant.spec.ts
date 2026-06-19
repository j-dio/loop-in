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

  // KNOWN GAP (surfaced by this UAT): Board.tsx computes canPost from MEMBERSHIP
  // (`workspaces.some(w => w.slug === slug)`), so a signed-in non-member still sees the
  // DISABLED "Submit feedback" button even though the backend now allows participant writes.
  // The participant submit affordance was never wired into the Board UI.
  test("UI gap: non-member sees a disabled submit button on the public board", async ({ context, page }) => {
    await loginAs(context, SEED.theo);
    await page.goto("/demo");
    const submit = page.getByRole("button", { name: /Submit feedback/ });
    await expect(submit).toBeVisible();
    await expect(submit).toBeDisabled();
  });
});
