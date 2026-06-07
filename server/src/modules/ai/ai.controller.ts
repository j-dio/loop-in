import type { NextFunction, Request, Response } from "express";
import { slidingWindowRedisHit } from "../../lib/rateLimitSlidingRedis";
import { setRateLimitHeaders } from "../../middleware/rateLimit";
import { logger } from "../../lib/logger";
import { generateDigest, isGeminiConfigured, isOpenRouterConfigured } from "./ai.service";

const AI_DIGEST_LIMIT = 1;
const AI_DIGEST_WINDOW_MS = 3_600_000; // 1 hour

export async function generateDigestHandler(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.workspace) return res.status(404).json({ error: "Workspace not found" });

    if (!isGeminiConfigured() && !isOpenRouterConfigured()) {
      return res.status(503).json({
        error: "AI features are not configured on this server. Add GEMINI_API_KEY to enable them.",
      });
    }

    // Per-workspace rate limit: 1 digest per hour, keyed by workspace ID (server-controlled UUID).
    // Fail-CLOSED (not fail-open): a Redis outage must block, not permit, unbounded LLM spend.
    const rlKey = `aiDigest:ws:${req.workspace.id}`;
    let rl: Awaited<ReturnType<typeof slidingWindowRedisHit>>;
    try {
      rl = await slidingWindowRedisHit(rlKey, AI_DIGEST_LIMIT, AI_DIGEST_WINDOW_MS);
    } catch (err) {
      logger.error({ err, workspaceId: req.workspace.id }, "ai digest rate limit unavailable");
      return res.status(503).json({ error: "AI digest temporarily unavailable. Try again shortly." });
    }
    setRateLimitHeaders(res, { limit: rl.limit, remaining: rl.remaining, resetSec: rl.resetSec });

    if (!rl.allowed) {
      const secsLeft = Math.max(0, rl.resetSec - Math.floor(Date.now() / 1000));
      const minsLeft = Math.ceil(secsLeft / 60);
      return res.status(429).json({
        error: `AI digest can only be generated once per hour per workspace. Try again in ${minsLeft} minute(s).`,
        reset_at: rl.resetSec,
      });
    }

    const result = await generateDigest({
      workspaceId: req.workspace.id,
      ctx: { userId: req.user?.id, workspaceRole: req.workspaceRole },
    });

    if (result === "not_configured") {
      return res.status(503).json({
        error: "AI features are not configured on this server. Add GEMINI_API_KEY to enable them.",
      });
    }

    if (result === "empty") {
      return res.json({
        digest: {
          items: [],
          pattern_summary: "No approved posts to analyze yet.",
        },
      });
    }

    return res.json({ digest: result });
  } catch (err) {
    logger.error({ err }, "generateDigestHandler unhandled error");
    next(err);
  }
}
