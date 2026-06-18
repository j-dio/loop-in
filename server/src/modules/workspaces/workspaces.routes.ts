import { Router } from "express";
import { authenticate, optionalAuth } from "../../middleware/authenticate";
import { createWorkspaceRateLimiter } from "../../middleware/rateLimit";
import { requireRole, requireWorkspace } from "../../middleware/workspace";
import { createAiRouterStack } from "../ai/ai.routes";
import { createPostsRouterStack } from "../posts/posts.routes";
import { createUploadsRouterStack } from "../uploads/uploads.routes";
import {
  deleteInvite,
  deleteWorkspace,
  deleteWorkspaceMember,
  getInviteInfo,
  getMyRole,
  getPendingInvites,
  getWorkspaceMembers,
  getWorkspaces,
  patchWorkspace,
  patchWorkspaceLogo,
  postAcceptInvite,
  postWorkspace,
  postWorkspaceMember,
  presignWorkspaceLogo,
} from "./workspaces.controller";

export const workspacesRouter = Router();

// Decode JWT early so rate limits can key by user_id; routes still enforce `authenticate` where required.
workspacesRouter.use(optionalAuth);
workspacesRouter.use(createWorkspaceRateLimiter());

// Workspace CRUD (auth required)
workspacesRouter.post("/", authenticate, postWorkspace);
workspacesRouter.get("/", authenticate, getWorkspaces);

// Invite accept flow — must be before /:slug routes to avoid shadowing
workspacesRouter.get("/invites/:token", getInviteInfo);            // public — shows invite info
workspacesRouter.post("/invites/accept", authenticate, postAcceptInvite); // auth required

// AI Insight Engine (Phase 5): /api/workspaces/:slug/ai/digest
workspacesRouter.use("/:slug/ai", createAiRouterStack());

// S3 presign (Phase 2 Step 10): /api/workspaces/:slug/uploads/presign
workspacesRouter.use("/:slug/uploads", createUploadsRouterStack());

// Posts (Phase 1 Step 3): /api/workspaces/:slug/posts — before /:slug PATCH to avoid shadowing
workspacesRouter.use("/:slug/posts", createPostsRouterStack());

// My role — any authenticated member (no requireRole guard)
workspacesRouter.get("/:slug/my-role", authenticate, requireWorkspace, getMyRole);

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

// Pending invites (admin or owner)
workspacesRouter.get(
  "/:slug/invites",
  authenticate,
  requireWorkspace,
  adminOrOwner,
  getPendingInvites
);
workspacesRouter.delete(
  "/:slug/invites/:inviteId",
  authenticate,
  requireWorkspace,
  adminOrOwner,
  deleteInvite
);

// Workspace logo (admin or owner)
workspacesRouter.post(
  "/:slug/logo/presign",
  authenticate,
  requireWorkspace,
  adminOrOwner,
  presignWorkspaceLogo
);
workspacesRouter.patch(
  "/:slug/logo",
  authenticate,
  requireWorkspace,
  adminOrOwner,
  patchWorkspaceLogo
);

// Owner-only settings + delete
workspacesRouter.patch("/:slug", authenticate, requireWorkspace, requireRole("owner"), patchWorkspace);
workspacesRouter.delete("/:slug", authenticate, requireWorkspace, requireRole("owner"), deleteWorkspace);

