import type { NextFunction, Request, Response } from "express";
import { eq } from "drizzle-orm";
import { db } from "../../db";
import { workspaces } from "../../db/schema";
import {
  AddLinkBodySchema,
  AddScreenshotBodySchema,
  CreateWorkspaceBodySchema,
  InviteMemberBodySchema,
  LinkIdParamsSchema,
  LogoPresignBodySchema,
  PatchWorkspaceBodySchema,
  PatchWorkspaceParamsSchema,
  RemoveMemberParamsSchema,
  ReorderScreenshotsBodySchema,
  ScreenshotIdParamsSchema,
  ScreenshotPresignBodySchema,
  UpdateLogoBodySchema,
  WorkspaceMembersParamsSchema,
} from "./workspaces.schemas";
import {
  createPresignedLogoPut,
  createPresignedScreenshotPut,
  isS3UploadConfigured,
  isValidScreenshotUrl,
  isValidWorkspaceLogoUrl,
} from "../uploads/uploads.service";
import {
  addLink,
  addScreenshot,
  deleteLink,
  deleteScreenshot,
  getWorkspaceProfile,
  reorderScreenshots,
} from "./workspaces.profile.service";
import {
  followWorkspace,
  getFollowerCount,
  isFollowing,
  unfollowWorkspace,
} from "./workspaces.follows.service";
import {
  acceptInviteByToken,
  cancelPendingInvite,
  createWorkspaceWithOwnerMembership,
  deleteWorkspaceBySlug,
  getInviteByToken,
  inviteUserAsMember,
  listPendingInvites,
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

    const { require_approval, website_url, ...rest } = bodyParsed.data;
    const updated = await updateWorkspaceBySlug({
      slug: paramsParsed.data.slug,
      patch: {
        ...rest,
        ...(require_approval !== undefined ? { requireApproval: require_approval } : {}),
        ...(website_url !== undefined ? { websiteUrl: website_url } : {}),
      },
    });

    if (!updated) return res.status(404).json({ error: "Workspace not found" });

    return res.json({ workspace: updated });
  } catch (err) {
    next(err);
  }
}

/** POST /:slug/logo/presign — presigned PUT for a workspace logo (admin/owner). */
export async function presignWorkspaceLogo(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user?.id) return res.status(401).json({ error: "Unauthorized" });
    if (!req.workspace) return res.status(404).json({ error: "Workspace not found" });

    if (!isS3UploadConfigured()) {
      return res
        .status(503)
        .json({ error: "File uploads are not configured (S3_BUCKET and AWS_REGION)" });
    }

    const bodyParsed = LogoPresignBodySchema.safeParse(req.body);
    if (!bodyParsed.success) {
      return res.status(400).json({ error: "Invalid request", details: bodyParsed.error.flatten() });
    }

    const result = await createPresignedLogoPut({
      workspaceId: req.workspace.id,
      body: bodyParsed.data,
    });

    if (!result.ok) {
      if (result.reason === "bad_extension_mismatch") {
        return res.status(400).json({
          error: "Filename extension must match content type (jpg, png, gif, or webp)",
        });
      }
      return res.status(502).json({ error: "Could not create upload URL", details: result.message });
    }

    return res.json({
      upload_url: result.uploadUrl,
      image_url: result.imageUrl,
      upload_headers: result.headers,
      expires_in_seconds: 300,
    });
  } catch (err) {
    next(err);
  }
}

/** PATCH /:slug/logo — set or clear the workspace logo (admin/owner). */
export async function patchWorkspaceLogo(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user?.id) return res.status(401).json({ error: "Unauthorized" });
    if (!req.workspace) return res.status(404).json({ error: "Workspace not found" });

    const paramsParsed = PatchWorkspaceParamsSchema.safeParse(req.params);
    if (!paramsParsed.success) {
      return res.status(400).json({ error: "Invalid params", details: paramsParsed.error.flatten() });
    }

    const bodyParsed = UpdateLogoBodySchema.safeParse(req.body);
    if (!bodyParsed.success) {
      return res.status(400).json({ error: "Invalid request", details: bodyParsed.error.flatten() });
    }

    const { logo_url } = bodyParsed.data;
    if (logo_url != null && !isValidWorkspaceLogoUrl(logo_url, req.workspace.id)) {
      return res.status(400).json({ error: "Invalid logo URL" });
    }

    const updated = await updateWorkspaceBySlug({
      slug: paramsParsed.data.slug,
      patch: { logoUrl: logo_url },
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

export async function getPendingInvites(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.workspace) return res.status(404).json({ error: "Workspace not found" });
    const invites = await listPendingInvites(req.workspace.id);
    return res.json({ invites });
  } catch (err) {
    next(err);
  }
}

export async function deleteInvite(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.workspace) return res.status(404).json({ error: "Workspace not found" });
    const inviteId = (req.params.inviteId as string | undefined)?.trim();
    if (!inviteId) return res.status(400).json({ error: "inviteId is required" });

    const result = await cancelPendingInvite({ inviteId, workspaceId: req.workspace.id });
    if (result === "not_found") return res.status(404).json({ error: "Invite not found" });
    return res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

export async function getInviteInfo(req: Request, res: Response, next: NextFunction) {
  try {
    const token = (req.params.token as string | undefined)?.trim();
    if (!token) return res.status(400).json({ error: "Token is required" });

    const result = await getInviteByToken(token);

    if (result === "not_found") return res.status(404).json({ error: "Invite not found" });
    if (result === "expired") return res.status(410).json({ error: "This invite has expired" });

    return res.json({ invite: result });
  } catch (err) {
    next(err);
  }
}

export async function postAcceptInvite(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user?.id || !req.user.email) {
      return res.status(401).json({ error: "You must be signed in to accept an invite" });
    }

    const token = req.body?.token?.trim();
    if (!token) return res.status(400).json({ error: "Token is required" });

    const result = await acceptInviteByToken({
      token,
      userId: req.user.id,
      userEmail: req.user.email,
    });

    if (result === "not_found") return res.status(404).json({ error: "Invite not found or already used" });
    if (result === "expired") return res.status(410).json({ error: "This invite has expired" });
    if (result === "email_mismatch") {
      return res.status(403).json({ error: "This invite was sent to a different email address" });
    }
    if (result === "already_member") {
      return res.status(409).json({ error: "You are already a member of this workspace" });
    }

    return res.json({ workspaceSlug: result.workspaceSlug, workspaceName: result.workspaceName });
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

/** GET /:slug/profile — public profile (fields + ordered screenshots + links). */
export async function getWorkspaceProfileHandler(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.workspace) return res.status(404).json({ error: "Workspace not found" });

    const profile = await getWorkspaceProfile(req.workspace.slug);
    if (!profile) return res.status(404).json({ error: "Workspace not found" });

    const { workspace, screenshots, links } = profile;
    const viewerId = req.user?.id;
    const [followerCount, following] = await Promise.all([
      getFollowerCount(workspace.id),
      viewerId ? isFollowing({ userId: viewerId, workspaceId: workspace.id }) : Promise.resolve(false),
    ]);
    return res.json({
      workspace: {
        id: workspace.id,
        name: workspace.name,
        slug: workspace.slug,
        logoUrl: workspace.logoUrl,
        tagline: workspace.tagline,
        description: workspace.description,
        platform: workspace.platform,
        category: workspace.category,
        websiteUrl: workspace.websiteUrl,
        visibility: workspace.visibility,
        createdAt: workspace.createdAt,
      },
      screenshots,
      links,
      followerCount,
      isFollowing: following,
    });
  } catch (err) {
    next(err);
  }
}

/** POST /:slug/screenshots/presign — presigned PUT for a screenshot (admin/owner). */
export async function presignScreenshot(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user?.id) return res.status(401).json({ error: "Unauthorized" });
    if (!req.workspace) return res.status(404).json({ error: "Workspace not found" });

    if (!isS3UploadConfigured()) {
      return res
        .status(503)
        .json({ error: "File uploads are not configured (S3_BUCKET and AWS_REGION)" });
    }

    const bodyParsed = ScreenshotPresignBodySchema.safeParse(req.body);
    if (!bodyParsed.success) {
      return res.status(400).json({ error: "Invalid request", details: bodyParsed.error.flatten() });
    }

    const result = await createPresignedScreenshotPut({
      workspaceId: req.workspace.id,
      body: bodyParsed.data,
    });

    if (!result.ok) {
      if (result.reason === "bad_extension_mismatch") {
        return res
          .status(400)
          .json({ error: "Filename extension must match content type (jpg, png, gif, or webp)" });
      }
      return res.status(502).json({ error: "Could not create upload URL", details: result.message });
    }

    return res.json({
      upload_url: result.uploadUrl,
      image_url: result.imageUrl,
      upload_headers: result.headers,
      expires_in_seconds: 300,
    });
  } catch (err) {
    next(err);
  }
}

/** POST /:slug/screenshots — add a screenshot (admin/owner). */
export async function addScreenshotHandler(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user?.id) return res.status(401).json({ error: "Unauthorized" });
    if (!req.workspace) return res.status(404).json({ error: "Workspace not found" });

    const bodyParsed = AddScreenshotBodySchema.safeParse(req.body);
    if (!bodyParsed.success) {
      return res.status(400).json({ error: "Invalid request", details: bodyParsed.error.flatten() });
    }

    if (!isValidScreenshotUrl(bodyParsed.data.url, req.workspace.id)) {
      return res.status(400).json({ error: "Invalid screenshot URL" });
    }

    const result = await addScreenshot({ workspaceId: req.workspace.id, url: bodyParsed.data.url });
    if (result === "limit_reached") {
      return res.status(409).json({ error: "Maximum of 5 screenshots reached" });
    }

    return res.status(201).json({ screenshot: result });
  } catch (err) {
    next(err);
  }
}

/** DELETE /:slug/screenshots/:id — remove a screenshot (admin/owner). */
export async function deleteScreenshotHandler(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.workspace) return res.status(404).json({ error: "Workspace not found" });

    const paramsParsed = ScreenshotIdParamsSchema.safeParse(req.params);
    if (!paramsParsed.success) {
      return res.status(400).json({ error: "Invalid params", details: paramsParsed.error.flatten() });
    }

    const result = await deleteScreenshot({ workspaceId: req.workspace.id, id: paramsParsed.data.id });
    if (result === "not_found") return res.status(404).json({ error: "Screenshot not found" });
    return res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

/** PATCH /:slug/screenshots/reorder — reorder screenshots (admin/owner). */
export async function reorderScreenshotsHandler(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.workspace) return res.status(404).json({ error: "Workspace not found" });

    const bodyParsed = ReorderScreenshotsBodySchema.safeParse(req.body);
    if (!bodyParsed.success) {
      return res.status(400).json({ error: "Invalid request", details: bodyParsed.error.flatten() });
    }

    const result = await reorderScreenshots({ workspaceId: req.workspace.id, ids: bodyParsed.data.ids });
    if (result === "mismatch") {
      return res.status(400).json({ error: "Reorder list must match the current screenshots exactly" });
    }
    return res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

/** POST /:slug/links — add a typed link (admin/owner). */
export async function addLinkHandler(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.workspace) return res.status(404).json({ error: "Workspace not found" });

    const bodyParsed = AddLinkBodySchema.safeParse(req.body);
    if (!bodyParsed.success) {
      return res.status(400).json({ error: "Invalid request", details: bodyParsed.error.flatten() });
    }

    const link = await addLink({
      workspaceId: req.workspace.id,
      kind: bodyParsed.data.kind,
      url: bodyParsed.data.url,
    });
    return res.status(201).json({ link });
  } catch (err) {
    next(err);
  }
}

/** DELETE /:slug/links/:id — remove a link (admin/owner). */
export async function deleteLinkHandler(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.workspace) return res.status(404).json({ error: "Workspace not found" });

    const paramsParsed = LinkIdParamsSchema.safeParse(req.params);
    if (!paramsParsed.success) {
      return res.status(400).json({ error: "Invalid params", details: paramsParsed.error.flatten() });
    }

    const result = await deleteLink({ workspaceId: req.workspace.id, id: paramsParsed.data.id });
    if (result === "not_found") return res.status(404).json({ error: "Link not found" });
    return res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

/** POST /:slug/follow — follow an app (participant tier). Idempotent. */
export async function followWorkspaceHandler(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user?.id) return res.status(401).json({ error: "Unauthorized" });
    if (!req.workspace) return res.status(404).json({ error: "Workspace not found" });

    await followWorkspace({ userId: req.user.id, workspaceId: req.workspace.id });
    const followerCount = await getFollowerCount(req.workspace.id);
    return res.json({ following: true, followerCount });
  } catch (err) {
    next(err);
  }
}

/** DELETE /:slug/follow — unfollow an app (participant tier). Idempotent. */
export async function unfollowWorkspaceHandler(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user?.id) return res.status(401).json({ error: "Unauthorized" });
    if (!req.workspace) return res.status(404).json({ error: "Workspace not found" });

    await unfollowWorkspace({ userId: req.user.id, workspaceId: req.workspace.id });
    const followerCount = await getFollowerCount(req.workspace.id);
    return res.json({ following: false, followerCount });
  } catch (err) {
    next(err);
  }
}

