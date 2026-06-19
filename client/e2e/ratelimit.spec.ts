import { test, expect } from "@playwright/test";
import { SEED, apiAs } from "./helpers/auth";

/**
 * Checklist §4 — per-IP rate limit (flag-5 MVP).
 *
 * Re-run note: the sliding windows are real (createPost 1h, comment 1min). Re-running within
 * those windows can pre-saturate a bucket; the per-user test self-skips if already saturated,
 * and the per-IP test is written to tolerate a non-zero starting count. For a pristine run,
 * wait out the window or flush Redis (`docker compose exec redis redis-cli FLUSHALL`).
 */
test.describe("Per-IP rate limit on participant writes", () => {
  test("per-user createPost cap (5/h) returns 429 on the 6th", async ({ playwright }) => {
    const api = await apiAs(playwright, SEED.lena);
    const statuses: number[] = [];
    for (let i = 0; i < 6; i++) {
      const r = await api.post(`/api/workspaces/demo/posts`, {
        data: { title: `rl-user ${Date.now()}-${i}`, description: "x", category: "bug" },
      });
      statuses.push(r.status());
    }
    await api.dispose();

    test.skip(statuses[0] === 429, "lena createPost window already saturated — wait 1h or flush Redis");
    expect(statuses.slice(0, 5).every((s) => s < 300), `first 5 should pass: ${statuses}`).toBeTruthy();
    expect(statuses[5], `6th should be 429: ${statuses}`).toBe(429);
  });

  test("per-IP comment cap catches a multi-account flood from one IP", async ({ playwright }) => {
    // One approved demo post to comment on.
    const mayaApi = await apiAs(playwright, SEED.maya);
    const list = await mayaApi.get(`/api/workspaces/demo/posts`);
    const postId = (await list.json()).posts[0].id as string;
    await mayaApi.dispose();
    const commentPath = `/api/workspaces/demo/posts/${postId}/comments`;

    // Per-user comment cap = 20; per-IP cap = 80. Spread across users sharing one IP (localhost),
    // the IP ceiling must trip BEFORE any single user reaches 20 — proving it's IP-keyed.
    const users = [SEED.maya, SEED.devon, SEED.priya, SEED.sam, SEED.lena];
    let total = 0;
    let blocked: { user: string; personal: number } | null = null;

    outer: for (const u of users) {
      const api = await apiAs(playwright, u);
      let personal = 0;
      for (let i = 0; i < 20; i++) {
        const r = await api.post(commentPath, { data: { content: `ip-flood ${u} ${i}` } });
        if (r.status() === 429) {
          blocked = { user: u, personal };
          await api.dispose();
          break outer;
        }
        expect(r.status(), `${u} #${i} should pass`).toBeLessThan(300);
        personal++;
        total++;
      }
      await api.dispose();
    }

    expect(blocked, "expected a 429 from the per-IP ceiling").not.toBeNull();
    expect(
      blocked!.personal,
      `blocked user (${blocked!.user}) was under their own 20/min cap → IP-keyed`,
    ).toBeLessThan(20);
    expect(total, "IP ceiling engaged near the 80 cap").toBeGreaterThanOrEqual(50);
  });
});
