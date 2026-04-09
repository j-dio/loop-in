import { randomBytes } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { db } from "../../db";
import { pendingInvites, users, workspaceMembers, workspaces } from "../../db/schema";

export type WorkspaceVisibility = "public" | "invite_only";
export type WorkspaceRole = "owner" | "admin" | "member";

export type Workspace = {
  id: string;
  ownerId: string;
  name: string;
  slug: string;
  primaryColor: string;
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
    visibility: row.visibility as WorkspaceVisibility,
    requireApproval: row.requireApproval,
    createdAt: row.createdAt,
  };
}

export async function createWorkspaceWithOwnerMembership(input: {
  userId: string;
  name: string;
  slug: string;
  primaryColor?: string | undefined;
  visibility?: WorkspaceVisibility | undefined;
  requireApproval?: boolean | undefined;
}): Promise<Workspace> {
  return await db.transaction(async (tx) => {
    const [insertedWorkspace] = await tx
      .insert(workspaces)
      .values({
        ownerId: input.userId,
        name: input.name,
        slug: input.slug,
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

    return mapWorkspaceRow(insertedWorkspace);
  });
}

export async function findWorkspaceBySlug(slug: string): Promise<Workspace | null> {
  const [row] = await db.select().from(workspaces).where(eq(workspaces.slug, slug)).limit(1);
  return row ? mapWorkspaceRow(row) : null;
}

export async function listWorkspacesForUser(userId: string): Promise<Workspace[]> {
  const rows = await db
    .select({ workspace: workspaces })
    .from(workspaceMembers)
    .innerJoin(workspaces, eq(workspaceMembers.workspaceId, workspaces.id))
    .where(eq(workspaceMembers.userId, userId));

  return rows.map((r) => mapWorkspaceRow(r.workspace));
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
    visibility?: WorkspaceVisibility | undefined;
    requireApproval?: boolean | undefined;
  };
}): Promise<Workspace | null> {
  const [updated] = await db
    .update(workspaces)
    .set({
      name: input.patch.name,
      primaryColor: input.patch.primaryColor,
      visibility: input.patch.visibility,
      requireApproval: input.patch.requireApproval,
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
      role: "member",
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
 * Invite by email: if the user exists, add membership; otherwise store a pending invite (7-day expiry).
 */
export async function inviteUserAsMember(input: {
  workspaceId: string;
  email: string;
  invitedByUserId: string;
}): Promise<
  WorkspaceMemberPublic | { pending: true; email: string } | "already_member" | "already_pending"
> {
  const normalizedEmail = input.email.trim().toLowerCase();

  const invitedUser = await findUserByEmailCaseInsensitive(input.email);
  if (invitedUser) {
    return addExistingUserAsMember({
      workspaceId: input.workspaceId,
      userId: invitedUser.id,
    });
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
    role: "member",
    invitedBy: input.invitedByUserId,
    token,
    expiresAt,
  });

  return { pending: true, email: normalizedEmail };
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

