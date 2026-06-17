import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";
import type { ViteReactSSGOptions } from "vite-react-ssg";

// Augment vite's UserConfig to include ssgOptions (provided by vite-react-ssg module augmentation)
declare module "vite" {
  interface UserConfig {
    ssgOptions?: ViteReactSSGOptions;
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  ssgOptions: {
    // Prerender only the marketing landing page; all other routes stay CSR.
    includedRoutes: () => ["/"],
  },
});
