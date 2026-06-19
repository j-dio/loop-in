import { defineConfig, devices } from "@playwright/test";
import { CLIENT_BASE } from "./e2e/helpers/auth";

/**
 * Social-MVP UAT. Drives the running dev server (client :5173 + API :3001 + seeded DB).
 * Serial single-worker: the rate-limit spec mutates shared Redis counters, so parallelism
 * would cause cross-spec interference. Bring the stack up first (docker + server + client +
 * `npm run seed`), then `npm run test:e2e`. See docs/UAT-AUTOMATION.md.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: [["list"]],
  timeout: 60_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: CLIENT_BASE,
    headless: true,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
