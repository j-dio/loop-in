import { Router } from "express";
import { authenticate } from "../../middleware/authenticate";
import { requireRole, requireWorkspace } from "../../middleware/workspace";
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

// Workspace CRUD (auth required)
workspacesRouter.post("/", authenticate, postWorkspace);
workspacesRouter.get("/", authenticate, getWorkspaces);

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

