import "../src/config/env";
import { eq, inArray, isNotNull } from "drizzle-orm";
import { db, pool } from "../src/db";
import { notifications, posts } from "../src/db/schema";

/**
 * One-off maintenance: remove dangling notifications that deep-link to a soft-deleted post.
 *
 * Background: `notifications.post_id` FK cascades only on a HARD delete. Posts are soft-deleted
 * (deletedAt), so before the soft-delete cleanup landed in softDeletePost, their notifications were
 * left pointing at a thread URL that now 404s. This sweeps the pre-existing orphans.
 *
 * Safe to run anywhere (incl. prod) — it only touches notifications whose parent post is already
 * soft-deleted. Dry-run by default; pass --apply to actually delete.
 *
 * Usage:
 *   npx tsx scripts/cleanup-orphan-notifications.ts            → count only (dry run)
 *   npx tsx scripts/cleanup-orphan-notifications.ts --apply    → delete the orphans
 */
async function main() {
  const apply = process.argv.includes("--apply");

  const orphans = await db
    .select({ id: notifications.id })
    .from(notifications)
    .innerJoin(posts, eq(posts.id, notifications.postId))
    .where(isNotNull(posts.deletedAt));

  const ids = orphans.map((r) => r.id);
  process.stdout.write(`orphan notifications (point to a soft-deleted post): ${ids.length}\n`);

  if (ids.length === 0) {
    process.stdout.write("nothing to clean.\n");
    return;
  }

  if (!apply) {
    process.stdout.write("dry run — re-run with --apply to delete.\n");
    return;
  }

  await db.delete(notifications).where(inArray(notifications.id, ids));
  process.stdout.write(`deleted ${ids.length} orphan notifications.\n`);
}

main()
  .then(async () => {
    await pool.end();
    process.exit(0);
  })
  .catch(async (err) => {
    // eslint-disable-next-line no-console
    console.error("cleanup-orphan-notifications failed:", err instanceof Error ? err.message : err);
    await pool.end();
    process.exit(1);
  });
