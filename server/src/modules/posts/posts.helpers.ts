import type { WorkspaceRole } from "../workspaces/workspaces.service";

export type RequesterContext = {
  userId: string | undefined;
  workspaceRole: WorkspaceRole | undefined;
};

export function isAdminOrOwner(role: WorkspaceRole | undefined): boolean {
  return role === "admin" || role === "owner";
}

export function viewerCanSeePost(
  p: { moderationStatus: string; authorId: string; deletedAt: Date | null },
  ctx: RequesterContext
): boolean {
  if (p.deletedAt) return false;
  const canViewApproved = p.moderationStatus === "approved";
  const isAuthor = ctx.userId !== undefined && p.authorId === ctx.userId;
  const staff = isAdminOrOwner(ctx.workspaceRole);
  return canViewApproved || isAuthor || staff;
}
