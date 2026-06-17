import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { requireEnv } from "../config/env";

// Pool sizing: Railway's managed Postgres allows a limited number of connections. Keep `max` modest
// so a single instance never exhausts the server's connection slots. Override with DB_POOL_MAX.
const poolMax = Number(process.env.DB_POOL_MAX ?? 10);
export const pool = new Pool({
  connectionString: requireEnv("DATABASE_URL"),
  max: Number.isFinite(poolMax) && poolMax > 0 ? poolMax : 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
});
export const db = drizzle(pool);

export type Db = typeof db;
