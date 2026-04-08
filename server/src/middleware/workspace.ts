import type { NextFunction, Request, Response } from "express";
import { WorkspaceSlugSchema } from "../modules/workspaces/workspaces.schemas";
import {
  findWorkspaceBySlug,
  getUserRoleInWorkspace,
  type WorkspaceRole,
} from "../modules/workspaces/workspaces.service";

function isReadMethod(method: string) {
  return method === "GET" || method === "HEAD" || method === "OPTIONS";
}

/**
 * requireWorkspace
 * - Resolves :slug -> req.workspace
 * - Resolves membership -> req.workspaceRole
 * - Enforces PRD rules:
 *   - invite_only: reject non-members for all operations (including reads)
 *   - public + read: allow even unauthenticated
 *   - any write: require membership regardless of visibility
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

    const isRead = isReadMethod(req.method);

    if (workspace.visibility === "invite_only" && !role) {
      return userId
        ? res.status(403).json({ error: "Forbidden" })
        : res.status(401).json({ error: "Unauthorized" });
    }

    if (!isRead && !role) {
      return userId
        ? res.status(403).json({ error: "Forbidden" })
        : res.status(401).json({ error: "Unauthorized" });
    }

    return next();
  } catch (err) {
    next(err);
  }
}

export function requireRole(...roles: WorkspaceRole[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const role = req.workspaceRole;
    if (!role) return res.status(403).json({ error: "Forbidden" });
    if (!roles.includes(role)) return res.status(403).json({ error: "Forbidden" });
    return next();
  };
}

