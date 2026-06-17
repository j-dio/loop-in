import { defineConfig } from "vitest/config";

// Self-contained config so Vitest does not walk up the directory tree and pick up an unrelated
// vite.config.ts from a parent folder.
export default defineConfig({
  test: {
    root: __dirname,
    include: ["src/**/*.test.ts"],
    environment: "node",
  },
});
