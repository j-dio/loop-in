import { defineConfig } from "drizzle-kit";
import { config as loadEnv } from "dotenv";

loadEnv({ path: "../.env" });

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "../drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  }
});