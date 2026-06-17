import { Router } from "express";
import { optionalAuth } from "../../middleware/authenticate";
import { createWorkspaceRateLimiter } from "../../middleware/rateLimit";
import { exploreFeedHandler, exploreWorkspacesHandler } from "./explore.controller";

/**
 * Public discovery — no auth required. Mounted at /api/explore.
 * `optionalAuth` runs so rate limits key by user when a visitor happens to be signed in;
 * the rate limiter classifies these paths as the default bucket.
 */
export const exploreRouter = Router();

exploreRouter.use(optionalAuth);
exploreRouter.use(createWorkspaceRateLimiter());

exploreRouter.get("/workspaces", exploreWorkspacesHandler);
exploreRouter.get("/feed", exploreFeedHandler);
