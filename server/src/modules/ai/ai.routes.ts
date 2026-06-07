import { Router } from "express";
import { authenticate } from "../../middleware/authenticate";
import { requireRole, requireWorkspace } from "../../middleware/workspace";
import { generateDigestHandler } from "./ai.controller";

/**
 * Mounted at /api/workspaces/:slug/ai
 * optionalAuth is applied by the parent workspacesRouter before this stack.
 */
export function createAiRouterStack() {
  const r = Router({ mergeParams: true });
  r.use(requireWorkspace);
  r.post("/digest", authenticate, requireRole("owner", "admin"), generateDigestHandler);
  return r;
}
