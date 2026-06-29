import { randomBytes } from "node:crypto";
import { and, eq, gt, sql } from "drizzle-orm";
import { db } from "../../db";
import { pendingInvites, users, workspaceMembers, workspaces } from "../../db/schema";
import { sendAddedToWorkspaceEmail, sendPendingInviteEmail } from "../email/email.service";
import { notifyWorkspaceInvite } from "../notifications/notifications.service";

export type WorkspaceVisibility = "public" | "invite_only";
export type WorkspaceRole = "owner" | "admin" | "member";
export type AppPlatform = "web" | "mobile" | "desktop" | "other";
export type LinkKind = "github" | "appstore" | "playstore" | "x" | "other";

export type Workspace = {
  id: string;
  ownerId: string;
  name: string;
  slug: string;
  primaryColor: string;
  logoUrl: string | null;
  tagline: string | null;
  description: string | null;
  platform: AppPlatform | null;
  category: string | null;
  websiteUrl: string | null;
  visibility: WorkspaceVisibility;
  requireApproval: boolean;
  createdAt: Date;
};

function mapWorkspaceRow(row: typeof workspaces.$inferSelect): Workspace {
  return {
    id: row.id,
    ownerId: row.ownerId,
    name: row.name,
    slug: row.slug,
    primaryColor: row.primaryColor,
    logoUrl: row.logoUrl,
    tagline: row.tagline,
    description: row.description,
    platform: row.platform as AppPlatform | null,
    category: row.category,
    websiteUrl: row.websiteUrl,
    visibility: row.visibility as WorkspaceVisibility,
    requireApproval: row.requireApproval,
    createdAt: row.createdAt,
  };
}

export async function createWorkspaceWithOwnerMembership(input: {
  userId: string;
  name: string;
  slug: string;
  tagline: string;
  platform: AppPlatform;
  category: string;
  primaryColor?: string | undefined;
  visibility?: WorkspaceVisibility | undefined;
  requireApproval?: boolean | undefined;
}): Promise<Workspace & { role: WorkspaceRole }> {
  return await db.transaction(async (tx) => {
    const [insertedWorkspace] = await tx
      .insert(workspaces)
      .values({
        ownerId: input.userId,
        name: input.name,
        slug: input.slug,
        tagline: input.tagline,
        platform: input.platform,
        category: input.category,
        primaryColor: input.primaryColor ?? undefined,
        visibility: input.visibility ?? undefined,
        requireApproval: input.requireApproval ?? undefined,
      })
      .returning();

    if (!insertedWorkspace) throw new Error("Failed to create workspace");

    const [memberRow] = await tx
      .insert(workspaceMembers)
      .values({
        workspaceId: insertedWorkspace.id,
        userId: input.userId,
        role: "owner",
      })
      .returning();

    if (!memberRow) throw new Error("Failed to create workspace owner membership");

    // Return role alongside the workspace so the client can mark the creator as owner without a
    // follow-up GET /api/workspaces. The list endpoint carries role; the create endpoint must too,
    // otherwise a freshly created board renders with canManage=false until a session refresh.
    return { ...mapWorkspaceRow(insertedWorkspace), role: memberRow.role as WorkspaceRole };
  });
}

export async function findWorkspaceBySlug(slug: string): Promise<Workspace | null> {
  const [row] = await db.select().from(workspaces).where(eq(workspaces.slug, slug)).limit(1);
  return row ? mapWorkspaceRow(row) : null;
}

export async function listWorkspacesForUser(
  userId: string
): Promise<(Workspace & { role: WorkspaceRole })[]> {
  const rows = await db
    .select({ workspace: workspaces, role: workspaceMembers.role })
    .from(workspaceMembers)
    .innerJoin(workspaces, eq(workspaceMembers.workspaceId, workspaces.id))
    .where(eq(workspaceMembers.userId, userId));

  return rows.map((r) => ({ ...mapWorkspaceRow(r.workspace), role: r.role as WorkspaceRole }));
}

export async function getUserRoleInWorkspace(input: {
  userId: string;
  workspaceId: string;
}): Promise<WorkspaceRole | null> {
  const [row] = await db
    .select({ role: workspaceMembers.role })
    .from(workspaceMembers)
    .where(and(eq(workspaceMembers.workspaceId, input.workspaceId), eq(workspaceMembers.userId, input.userId)))
    .limit(1);

  return (row?.role as WorkspaceRole | undefined) ?? null;
}

export async function updateWorkspaceBySlug(input: {
  slug: string;
  patch: {
    name?: string | undefined;
    primaryColor?: string | undefined;
    logoUrl?: string | null | undefined;
    visibility?: WorkspaceVisibility | undefined;
    requireApproval?: boolean | undefined;
    tagline?: string | null | undefined;
    description?: string | null | undefined;
    platform?: AppPlatform | null | undefined;
    category?: string | null | undefined;
    websiteUrl?: string | null | undefined;
  };
}): Promise<Workspace | null> {
  const [updated] = await db
    .update(workspaces)
    .set({
      name: input.patch.name,
      primaryColor: input.patch.primaryColor,
      logoUrl: input.patch.logoUrl,
      visibility: input.patch.visibility,
      requireApproval: input.patch.requireApproval,
      tagline: input.patch.tagline,
      description: input.patch.description,
      platform: input.patch.platform,
      category: input.patch.category,
      websiteUrl: input.patch.websiteUrl,
    })
    .where(eq(workspaces.slug, input.slug))
    .returning();

  return updated ? mapWorkspaceRow(updated) : null;
}

export async function deleteWorkspaceBySlug(slug: string): Promise<boolean> {
  const [deleted] = await db.delete(workspaces).where(eq(workspaces.slug, slug)).returning();
  return Boolean(deleted);
}

export type WorkspaceMemberPublic = {
  userId: string;
  email: string;
  name: string | null;
  role: WorkspaceRole;
  joinedAt: Date;
};

export async function findUserByEmailCaseInsensitive(email: string): Promise<{ id: string; email: string; name: string | null } | null> {
  const normalized = email.trim().toLowerCase();
  const [row] = await db
    .select({ id: users.id, email: users.email, name: users.name })
    .from(users)
    .where(sql`lower(${users.email}) = ${normalized}`)
    .limit(1);
  return row ?? null;
}

async function addExistingUserAsMember(input: {
  workspaceId: string;
  userId: string;
  role: "admin" | "member";
}): Promise<WorkspaceMemberPublic | "already_member"> {
  const [existing] = await db
    .select({ role: workspaceMembers.role })
    .from(workspaceMembers)
    .where(
      and(
        eq(workspaceMembers.workspaceId, input.workspaceId),
        eq(workspaceMembers.userId, input.userId)
      )
    )
    .limit(1);

  if (existing) return "already_member";

  const [memberRow] = await db
    .insert(workspaceMembers)
    .values({
      workspaceId: input.workspaceId,
      userId: input.userId,
      role: input.role,
    })
    .returning();

  if (!memberRow) throw new Error("Failed to add workspace member");

  const [userRow] = await db
    .select({ email: users.email, name: users.name })
    .from(users)
    .where(eq(users.id, input.userId))
    .limit(1);

  if (!userRow) throw new Error("User not found after insert");

  return {
    userId: input.userId,
    email: userRow.email,
    name: userRow.name,
    role: memberRow.role as WorkspaceRole,
    joinedAt: memberRow.joinedAt,
  };
}

/**
 * Invite by email: if the user exists, add membership directly; otherwise store a pending invite (7-day expiry).
 * Sends an email notification either way (non-fatal — invite is still created if email fails).
 */
export async function inviteUserAsMember(input: {
  workspaceId: string;
  email: string;
  invitedByUserId: string;
  role: "admin" | "member";
}): Promise<
  WorkspaceMemberPublic | { pending: true; email: string } | "already_member" | "already_pending"
> {
  const normalizedEmail = input.email.trim().toLowerCase();

  const [workspace] = await db
    .select({ name: workspaces.name, slug: workspaces.slug })
    .from(workspaces)
    .where(eq(workspaces.id, input.workspaceId))
    .limit(1);

  const [inviter] = await db
    .select({ name: users.name, email: users.email })
    .from(users)
    .where(eq(users.id, input.invitedByUserId))
    .limit(1);

  const inviterName = inviter?.name ?? inviter?.email ?? "Someone";
  const workspaceName = workspace?.name ?? "a workspace";
  const workspaceSlug = workspace?.slug ?? "";
  const clientUrl = process.env.CLIENT_URL ?? "";

  const invitedUser = await findUserByEmailCaseInsensitive(input.email);
  if (invitedUser) {
    const result = await addExistingUserAsMember({
      workspaceId: input.workspaceId,
      userId: invitedUser.id,
      role: input.role,
    });
    if (result !== "already_member") {
      await sendAddedToWorkspaceEmail({
        to: normalizedEmail,
        workspaceName,
        inviterName,
        workspaceUrl: `${clientUrl}/${workspaceSlug}`,
      });
      // In-app ping for the newly-added user (fire-and-forget; copy varies by role).
      notifyWorkspaceInvite({
        recipientId: invitedUser.id,
        workspaceId: input.workspaceId,
        workspaceSlug,
        workspaceName,
        actorId: input.invitedByUserId,
        actorName: inviterName,
        role: input.role,
      });
    }
    return result;
  }

  const [existingPending] = await db
    .select({ id: pendingInvites.id })
    .from(pendingInvites)
    .where(
      and(
        eq(pendingInvites.workspaceId, input.workspaceId),
        eq(pendingInvites.email, normalizedEmail)
      )
    )
    .limit(1);

  if (existingPending) return "already_pending";

  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  await db.insert(pendingInvites).values({
    workspaceId: input.workspaceId,
    email: normalizedEmail,
    role: input.role,
    invitedBy: input.invitedByUserId,
    token,
    expiresAt,
  });

  await sendPendingInviteEmail({
    to: normalizedEmail,
    workspaceName,
    inviterName,
    acceptUrl: `${clientUrl}/invite/accept?token=${token}`,
  });

  return { pending: true, email: normalizedEmail };
}

export type PendingInviteRow = {
  id: string;
  email: string;
  inviterName: string;
  expiresAt: Date;
};

export async function listPendingInvites(workspaceId: string): Promise<PendingInviteRow[]> {
  const rows = await db
    .select({
      id: pendingInvites.id,
      email: pendingInvites.email,
      expiresAt: pendingInvites.expiresAt,
      inviterName: users.name,
      inviterEmail: users.email,
    })
    .from(pendingInvites)
    .innerJoin(users, eq(pendingInvites.invitedBy, users.id))
    .where(and(eq(pendingInvites.workspaceId, workspaceId), gt(pendingInvites.expiresAt, new Date())));

  return rows.map((r) => ({
    id: r.id,
    email: r.email,
    expiresAt: r.expiresAt,
    inviterName: r.inviterName ?? r.inviterEmail,
  }));
}

export async function cancelPendingInvite(input: {
  inviteId: string;
  workspaceId: string;
}): Promise<"ok" | "not_found"> {
  const [deleted] = await db
    .delete(pendingInvites)
    .where(and(eq(pendingInvites.id, input.inviteId), eq(pendingInvites.workspaceId, input.workspaceId)))
    .returning();
  return deleted ? "ok" : "not_found";
}

export type InviteInfo = {
  workspaceName: string;
  workspaceSlug: string;
  inviterName: string;
  email: string;
  expiresAt: Date;
};

export async function getInviteByToken(
  token: string
): Promise<InviteInfo | "not_found" | "expired"> {
  const [row] = await db
    .select({
      email: pendingInvites.email,
      expiresAt: pendingInvites.expiresAt,
      workspaceName: workspaces.name,
      workspaceSlug: workspaces.slug,
      inviterName: users.name,
      inviterEmail: users.email,
    })
    .from(pendingInvites)
    .innerJoin(workspaces, eq(pendingInvites.workspaceId, workspaces.id))
    .innerJoin(users, eq(pendingInvites.invitedBy, users.id))
    .where(eq(pendingInvites.token, token))
    .limit(1);

  if (!row) return "not_found";
  if (row.expiresAt < new Date()) return "expired";

  return {
    workspaceName: row.workspaceName,
    workspaceSlug: row.workspaceSlug,
    inviterName: row.inviterName ?? row.inviterEmail,
    email: row.email,
    expiresAt: row.expiresAt,
  };
}

export async function acceptInviteByToken(input: {
  token: string;
  userId: string;
  userEmail: string;
}): Promise<
  | { ok: true; workspaceSlug: string; workspaceName: string }
  | "not_found"
  | "expired"
  | "email_mismatch"
  | "already_member"
> {
  const [row] = await db
    .select({
      id: pendingInvites.id,
      workspaceId: pendingInvites.workspaceId,
      email: pendingInvites.email,
      role: pendingInvites.role,
      expiresAt: pendingInvites.expiresAt,
      workspaceName: workspaces.name,
      workspaceSlug: workspaces.slug,
    })
    .from(pendingInvites)
    .innerJoin(workspaces, eq(pendingInvites.workspaceId, workspaces.id))
    .where(
      and(eq(pendingInvites.token, input.token), gt(pendingInvites.expiresAt, new Date()))
    )
    .limit(1);

  if (!row) return "not_found";
  if (row.expiresAt < new Date()) return "expired";

  if (row.email.toLowerCase() !== input.userEmail.toLowerCase()) return "email_mismatch";

  const result = await addExistingUserAsMember({
    workspaceId: row.workspaceId,
    userId: input.userId,
    role: row.role === "admin" ? "admin" : "member",
  });

  if (result === "already_member") return "already_member";

  await db.delete(pendingInvites).where(eq(pendingInvites.id, row.id));

  return { ok: true, workspaceSlug: row.workspaceSlug, workspaceName: row.workspaceName };
}

export async function listWorkspaceMembers(workspaceId: string): Promise<WorkspaceMemberPublic[]> {
  const rows = await db
    .select({
      userId: workspaceMembers.userId,
      email: users.email,
      name: users.name,
      role: workspaceMembers.role,
      joinedAt: workspaceMembers.joinedAt,
    })
    .from(workspaceMembers)
    .innerJoin(users, eq(workspaceMembers.userId, users.id))
    .where(eq(workspaceMembers.workspaceId, workspaceId));

  return rows.map((r) => ({
    userId: r.userId,
    email: r.email,
    name: r.name,
    role: r.role as WorkspaceRole,
    joinedAt: r.joinedAt,
  }));
}

export async function removeWorkspaceMember(input: {
  workspaceId: string;
  userId: string;
  ownerId: string;
}): Promise<"ok" | "cannot_remove_owner" | "not_found"> {
  if (input.userId === input.ownerId) return "cannot_remove_owner";

  const [deleted] = await db
    .delete(workspaceMembers)
    .where(and(eq(workspaceMembers.workspaceId, input.workspaceId), eq(workspaceMembers.userId, input.userId)))
    .returning();

  return deleted ? "ok" : "not_found";
}

