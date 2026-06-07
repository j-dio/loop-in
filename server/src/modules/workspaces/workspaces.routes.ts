import { Router } from "express";
import { authenticate, optionalAuth } from "../../middleware/authenticate";
import { createWorkspaceRateLimiter } from "../../middleware/rateLimit";
import { requireRole, requireWorkspace } from "../../middleware/workspace";
import { createPostsRouterStack } from "../posts/posts.routes";
import { createUploadsRouterStack } from "../uploads/uploads.routes";
import {
  deleteWorkspace,
  deleteWorkspaceMember,
  getWorkspaceMembers,
  getWorkspaces,
  patchWorkspace,
  postWorkspace,
  postWorkspaceMember,
} from "./workspaces.controller";

export const workspacesRouter = Router();

// Decode JWT early so rate limits can key by user_id; routes still enforce `authenticate` where required.
workspacesRouter.use(optionalAuth);
workspacesRouter.use(createWorkspaceRateLimiter());

// Workspace CRUD (auth required)
workspacesRouter.post("/", authenticate, postWorkspace);
workspacesRouter.get("/", authenticate, getWorkspaces);

// S3 presign (Phase 2 Step 10): /api/workspaces/:slug/uploads/presign
workspacesRouter.use("/:slug/uploads", createUploadsRouterStack());

// Posts (Phase 1 Step 3): /api/workspaces/:slug/posts — before /:slug PATCH to avoid shadowing
workspacesRouter.use("/:slug/posts", createPostsRouterStack());

// Members (admin or owner)
const adminOrOwner = requireRole("admin", "owner");
workspacesRouter.post(
  "/:slug/members",
  authenticate,
  requireWorkspace,
  adminOrOwner,
  postWorkspaceMember
);
workspacesRouter.get(
  "/:slug/members",
  authenticate,
  requireWorkspace,
  adminOrOwner,
  getWorkspaceMembers
);
workspacesRouter.delete(
  "/:slug/members/:userId",
  authenticate,
  requireWorkspace,
  adminOrOwner,
  deleteWorkspaceMember
);

// Owner-only settings + delete
workspacesRouter.patch("/:slug", authenticate, requireWorkspace, requireRole("owner"), patchWorkspace);
workspacesRouter.delete("/:slug", authenticate, requireWorkspace, requireRole("owner"), deleteWorkspace);

