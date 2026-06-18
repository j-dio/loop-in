import type { NextFunction, Request, Response } from "express";
import { WorkspaceSlugSchema } from "../modules/workspaces/workspaces.schemas";
import {
  findWorkspaceBySlug,
  getUserRoleInWorkspace,
  type WorkspaceRole,
} from "../modules/workspaces/workspaces.service";

/**
 * requireWorkspace
 * - Resolves :slug -> req.workspace
 * - Resolves membership -> req.workspaceRole (nullable)
 * - Enforces access rules:
 *   - public: resolve workspace + nullable role; per-route guards authorize writes
 *   - invite_only: reject non-members for all operations (including reads)
 */
export async function requireWorkspace(req: Request, res: Response, next: NextFunction) {
  try {
    const slug = req.params.slug;
    const parsedSlug = WorkspaceSlugSchema.safeParse(slug);
    if (!parsedSlug.success) return res.status(400).json({ error: "Invalid workspace slug" });

    const workspace = await findWorkspaceBySlug(parsedSlug.data);
    if (!workspace) return res.status(404).json({ error: "Workspace not found" });

    req.workspace = workspace;

    const userId = req.user?.id;
    const role: WorkspaceRole | null = userId
      ? await getUserRoleInWorkspace({ userId, workspaceId: workspace.id })
      : null;

    if (role) req.workspaceRole = role;

    // invite_only: non-members get nothing — reads included. (unchanged)
    if (workspace.visibility === "invite_only" && !role) {
      return userId
        ? res.status(403).json({ error: "Forbidden" })
        : res.status(401).json({ error: "Unauthorized" });
    }

    // NOTE: the old "any write requires membership" rule is intentionally removed.
    // Public-board writes are authorized per-route by requireParticipant (participant tier),
    // by requireRole (staff actions), or by author-or-staff checks in the service layer
    // (edit/delete). See docs/superpowers/specs/2026-06-18-social-layer-data-model-design.md §2.
    return next();
  } catch (err) {
    next(err);
  }
}

/**
 * requireParticipant
 * Participant tier: any signed-in user may write on a PUBLIC board.
 * - no user            -> 401
 * - no workspace       -> 404 (requireWorkspace must run first)
 * - invite_only + no role -> 403 (already blocked upstream by requireWorkspace; re-asserted here
 *                                  so the guard is correct in isolation)
 */
export function requireParticipant(req: Request, res: Response, next: NextFunction) {
  if (!req.user?.id) return res.status(401).json({ error: "Unauthorized" });
  if (!req.workspace) return res.status(404).json({ error: "Workspace not found" });
  if (req.workspace.visibility === "invite_only" && !req.workspaceRole) {
    return res.status(403).json({ error: "Forbidden" });
  }
  return next();
}

export function requireRole(...roles: WorkspaceRole[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const role = req.workspaceRole;
    if (!role) return res.status(403).json({ error: "Forbidden" });
    if (!roles.includes(role)) return res.status(403).json({ error: "Forbidden" });
    return next();
  };
}

