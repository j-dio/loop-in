import { and, eq, isNull } from "drizzle-orm";
import { db } from "../db";
import { posts, workspaces } from "../db/schema";
import { redis } from "../lib/redis";
import { logger } from "../lib/logger";
import { trendingRedisKey } from "../lib/trendingKeys";

/** PRD §9 — higher = older posts need more votes to rank well. */
const TRENDING_GRAVITY = 1.8;

/** Age offset (hours) so brand-new posts don’t divide by zero. */
const TRENDING_AGE_OFFSET_HOURS = 2;

const MS_PER_HOUR = 60 * 60 * 1000;

export function computeTrendingScore(
  upvoteCount: number,
  createdAt: Date,
  nowMs: number = Date.now()
): number {
  const hours = Math.max(0, (nowMs - createdAt.getTime()) / MS_PER_HOUR);
  const denom = (hours + TRENDING_AGE_OFFSET_HOURS) ** TRENDING_GRAVITY;
  if (denom === 0) return upvoteCount;
  return upvoteCount / denom;
}

/**
 * Re-reads approved posts from Postgres and overwrites each workspace’s Redis ZSET.
 * Workspaces with no approved posts get their key removed so the feed can fall back cleanly.
 */
export async function refreshTrendingScores(): Promise<void> {
  const now = Date.now();

  const [workspaceRows, postRows] = await Promise.all([
    db.select({ id: workspaces.id }).from(workspaces),
    db
      .select({
        id: posts.id,
        workspaceId: posts.workspaceId,
        upvoteCount: posts.upvoteCount,
        createdAt: posts.createdAt,
      })
      .from(posts)
      .where(
        and(eq(posts.moderationStatus, "approved"), isNull(posts.deletedAt))
      ),
  ]);

  const byWorkspace = new Map<string, typeof postRows>();
  for (const row of postRows) {
    const list = byWorkspace.get(row.workspaceId);
    if (list) list.push(row);
    else byWorkspace.set(row.workspaceId, [row]);
  }

  for (const { id: workspaceId } of workspaceRows) {
    const key = trendingRedisKey(workspaceId);
    const list = byWorkspace.get(workspaceId) ?? [];

    if (list.length === 0) {
      await redis.del(key);
      continue;
    }

    const pipeline = redis.pipeline();
    pipeline.del(key);
    for (const row of list) {
      const score = computeTrendingScore(row.upvoteCount, row.createdAt, now);
      pipeline.zadd(key, score, row.id);
    }
    await pipeline.exec();
  }

  logger.debug(
    { workspaces: workspaceRows.length, posts: postRows.length },
    "trending refresh completed"
  );
}

const FIVE_MINUTES_MS = 5 * 60 * 1000;

let refreshInFlight = false;

/**
 * Runs an immediate refresh, then every 5 minutes. Overlapping ticks are skipped
 * so a slow DB doesn’t stack duplicate work.
 */
export function startTrendingRefreshScheduler(): void {
  const run = () => {
    if (refreshInFlight) {
      logger.warn("trending refresh skipped (previous run still in progress)");
      return;
    }
    refreshInFlight = true;
    void refreshTrendingScores()
      .catch((err) => {
        logger.error({ err }, "trending refresh failed");
      })
      .finally(() => {
        refreshInFlight = false;
      });
  };

  run();
  setInterval(run, FIVE_MINUTES_MS);
  logger.info({ intervalMs: FIVE_MINUTES_MS }, "trending refresh scheduler started");
}
