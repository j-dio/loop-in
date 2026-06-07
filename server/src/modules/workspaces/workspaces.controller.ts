import type { NextFunction, Request, Response } from "express";
import { eq } from "drizzle-orm";
import { db } from "../../db";
import { workspaces } from "../../db/schema";
import {
  CreateWorkspaceBodySchema,
  InviteMemberBodySchema,
  PatchWorkspaceBodySchema,
  PatchWorkspaceParamsSchema,
  RemoveMemberParamsSchema,
  WorkspaceMembersParamsSchema,
} from "./workspaces.schemas";
import {
  createWorkspaceWithOwnerMembership,
  deleteWorkspaceBySlug,
  inviteUserAsMember,
  listWorkspaceMembers,
  listWorkspacesForUser,
  removeWorkspaceMember,
  updateWorkspaceBySlug,
} from "./workspaces.service";

export async function postWorkspace(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user?.id) return res.status(401).json({ error: "Unauthorized" });

    const parsed = CreateWorkspaceBodySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid request", details: parsed.error.flatten() });
    }

    const { name, slug, primaryColor, visibility, require_approval } = parsed.data;

    const [existing] = await db
      .select({ id: workspaces.id })
      .from(workspaces)
      .where(eq(workspaces.slug, slug))
      .limit(1);

    if (existing) return res.status(409).json({ error: "Workspace slug already exists" });

    const workspace = await createWorkspaceWithOwnerMembership({
      userId: req.user.id,
      name,
      slug,
      primaryColor,
      visibility,
      requireApproval: require_approval,
    });

    return res.status(201).json({ workspace });
  } catch (err) {
    next(err);
  }
}

export async function getWorkspaces(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user?.id) return res.status(401).json({ error: "Unauthorized" });

    const workspaces = await listWorkspacesForUser(req.user.id);
    return res.json({ workspaces });
  } catch (err) {
    next(err);
  }
}

export async function patchWorkspace(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user?.id) return res.status(401).json({ error: "Unauthorized" });

    const paramsParsed = PatchWorkspaceParamsSchema.safeParse(req.params);
    if (!paramsParsed.success) {
      return res.status(400).json({ error: "Invalid params", details: paramsParsed.error.flatten() });
    }

    const bodyParsed = PatchWorkspaceBodySchema.safeParse(req.body);
    if (!bodyParsed.success) {
      return res.status(400).json({ error: "Invalid request", details: bodyParsed.error.flatten() });
    }

    const { require_approval, ...rest } = bodyParsed.data;
    const updated = await updateWorkspaceBySlug({
      slug: paramsParsed.data.slug,
      patch: {
        ...rest,
        ...(require_approval !== undefined ? { requireApproval: require_approval } : {}),
      },
    });

    if (!updated) return res.status(404).json({ error: "Workspace not found" });

    return res.json({ workspace: updated });
  } catch (err) {
    next(err);
  }
}

export async function deleteWorkspace(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user?.id) return res.status(401).json({ error: "Unauthorized" });

    const paramsParsed = PatchWorkspaceParamsSchema.safeParse(req.params);
    if (!paramsParsed.success) {
      return res.status(400).json({ error: "Invalid params", details: paramsParsed.error.flatten() });
    }

    const ok = await deleteWorkspaceBySlug(paramsParsed.data.slug);
    if (!ok) return res.status(404).json({ error: "Workspace not found" });

    return res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

export async function postWorkspaceMember(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user?.id) return res.status(401).json({ error: "Unauthorized" });
    if (!req.workspace) return res.status(404).json({ error: "Workspace not found" });

    const paramsParsed = WorkspaceMembersParamsSchema.safeParse(req.params);
    if (!paramsParsed.success) {
      return res.status(400).json({ error: "Invalid params", details: paramsParsed.error.flatten() });
    }

    const bodyParsed = InviteMemberBodySchema.safeParse(req.body);
    if (!bodyParsed.success) {
      return res.status(400).json({ error: "Invalid request", details: bodyParsed.error.flatten() });
    }

    const result = await inviteUserAsMember({
      workspaceId: req.workspace.id,
      email: bodyParsed.data.email,
      invitedByUserId: req.user.id,
    });

    if (result === "already_member") {
      return res.status(409).json({ error: "User is already a member" });
    }
    if (result === "already_pending") {
      return res.status(409).json({ error: "An invite is already pending for this email" });
    }
    if ("pending" in result && result.pending) {
      return res.status(202).json({ pending: true, email: result.email });
    }

    return res.status(201).json({ member: result });
  } catch (err) {
    next(err);
  }
}

export function getMyRole(req: Request, res: Response) {
  if (!req.user?.id) return res.status(401).json({ error: "Unauthorized" });
  if (!req.workspaceRole) return res.status(403).json({ error: "Not a member" });
  return res.json({ role: req.workspaceRole });
}

export async function getWorkspaceMembers(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user?.id) return res.status(401).json({ error: "Unauthorized" });
    if (!req.workspace) return res.status(404).json({ error: "Workspace not found" });

    const paramsParsed = WorkspaceMembersParamsSchema.safeParse(req.params);
    if (!paramsParsed.success) {
      return res.status(400).json({ error: "Invalid params", details: paramsParsed.error.flatten() });
    }

    const members = await listWorkspaceMembers(req.workspace.id);
    return res.json({ members });
  } catch (err) {
    next(err);
  }
}

export async function deleteWorkspaceMember(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user?.id) return res.status(401).json({ error: "Unauthorized" });
    if (!req.workspace) return res.status(404).json({ error: "Workspace not found" });

    const paramsParsed = RemoveMemberParamsSchema.safeParse(req.params);
    if (!paramsParsed.success) {
      return res.status(400).json({ error: "Invalid params", details: paramsParsed.error.flatten() });
    }

    const outcome = await removeWorkspaceMember({
      workspaceId: req.workspace.id,
      userId: paramsParsed.data.userId,
      ownerId: req.workspace.ownerId,
    });

    if (outcome === "cannot_remove_owner") {
      return res.status(403).json({ error: "Cannot remove workspace owner" });
    }
    if (outcome === "not_found") {
      return res.status(404).json({ error: "Member not found" });
    }

    return res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

