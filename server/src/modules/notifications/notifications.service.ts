import type { InferInsertModel } from "drizzle-orm";
import { and, desc, eq, inArray, isNull, lt, or, sql } from "drizzle-orm";
import { db } from "../../db";
import { follows, notifications, posts, users, workspaceMembers, workspaces } from "../../db/schema";
import { logger } from "../../lib/logger";
import { encodeFeedCursor } from "../explore/explore.service";

// ─── Types ────────────────────────────────────────────────────────────────────

export type NotificationData = {
  postTitle?: string;
  appName?: string;
  appSlug?: string;
  actorName?: string;
  commentPreview?: string;
  boardStatus?: string;
  role?: "admin" | "member";
};

type NewNotification = InferInsertModel<typeof notifications>;

// ─── Pure helpers (exported for unit tests) ───────────────────────────────────

export function eventToNotificationType(
  boardStatus: string,
): "post_planned" | "post_in_progress" | "post_shipped" | null {
  switch (boardStatus) {
    case "planned":    return "post_planned";
    case "in_progress": return "post_in_progress";
    case "shipped":    return "post_shipped";
    default:           return null; // inbox, under_review → no notification
  }
}

// Pure dedup used by resolveFollowerRecipients — tested directly.
export function filterFollowerIds(followerIds: string[], excludeIds: string[]): string[] {
  const excluded = new Set(excludeIds.filter(Boolean));
  return followerIds.filter((id) => !excluded.has(id));
}

const COMMENT_PREVIEW_MAX = 120;

export function buildNotificationData(input: Partial<NotificationData>): NotificationData {
  const data: NotificationData = {};
  if (input.postTitle !== undefined)     data.postTitle = input.postTitle;
  if (input.appName !== undefined)       data.appName = input.appName;
  if (input.appSlug !== undefined)       data.appSlug = input.appSlug;
  if (input.actorName !== undefined)     data.actorName = input.actorName;
  if (input.commentPreview !== undefined) {
    data.commentPreview =
      input.commentPreview.length > COMMENT_PREVIEW_MAX
        ? input.commentPreview.slice(0, COMMENT_PREVIEW_MAX) + "…"
        : input.commentPreview;
  }
  if (input.boardStatus !== undefined)   data.boardStatus = input.boardStatus;
  if (input.role !== undefined)          data.role = input.role;
  return data;
}

// ─── Writer ───────────────────────────────────────────────────────────────────

export async function createNotifications(rows: NewNotification[]): Promise<void> {
  if (rows.length === 0) return;
  await db.insert(notifications).values(rows);
}

// ─── DB helpers ───────────────────────────────────────────────────────────────

export async function resolveFollowerRecipients(
  workspaceId: string,
  excludeUserIds: string[],
): Promise<string[]> {
  const rows = await db
    .select({ userId: follows.userId })
    .from(follows)
    .where(eq(follows.workspaceId, workspaceId));
  return filterFollowerIds(rows.map((r) => r.userId), excludeUserIds);
}

async function resolvePostContext(postId: string): Promise<{
  authorId: string;
  title: string;
  workspaceName: string;
  moderationStatus: string;
  deletedAt: Date | null;
} | null> {
  const [row] = await db
    .select({
      authorId: posts.authorId,
      title: posts.title,
      workspaceName: workspaces.name,
      moderationStatus: posts.moderationStatus,
      deletedAt: posts.deletedAt,
    })
    .from(posts)
    .innerJoin(workspaces, eq(posts.workspaceId, workspaces.id))
    .where(eq(posts.id, postId))
    .limit(1);
  return row ?? null;
}

/**
 * Followers may only be pinged about a post that is publicly visible.
 * Mirrors the Following-feed rule: hidden (non-approved / soft-deleted) posts
 * must never leak to followers via a milestone notification.
 */
export function isPubliclyVisible(ctx: { moderationStatus: string; deletedAt: Date | null }): boolean {
  return ctx.moderationStatus === "approved" && ctx.deletedAt === null;
}

async function resolveActorName(actorId: string): Promise<string | null> {
  const [row] = await db
    .select({ name: users.name })
    .from(users)
    .where(eq(users.id, actorId))
    .limit(1);
  return row?.name ?? null;
}

// ─── Fire-and-forget emitters ─────────────────────────────────────────────────

export function notifyPostApproved(input: {
  postId: string;
  workspaceId: string;
  workspaceSlug: string;
  actorId?: string | null;
}): void {
  void (async () => {
    try {
      const ctx = await resolvePostContext(input.postId);
      if (!ctx) return;
      if (input.actorId && ctx.authorId === input.actorId) return; // self-action guard
      await createNotifications([{
        recipientId: ctx.authorId,
        type: "post_approved",
        workspaceId: input.workspaceId,
        postId: input.postId,
        actorId: null,
        data: buildNotificationData({
          postTitle: ctx.title,
          appName: ctx.workspaceName,
          appSlug: input.workspaceSlug,
        }),
      }]);
    } catch (err) {
      logger.error({ err, postId: input.postId }, "Failed to create post-approved notification");
    }
  })();
}

export function notifyBoardMove(input: {
  postId: string;
  workspaceId: string;
  workspaceSlug: string;
  boardStatus: string;
  actorId: string;
}): void {
  const type = eventToNotificationType(input.boardStatus);
  if (!type) return; // inbox / under_review → no notification
  void (async () => {
    try {
      const ctx = await resolvePostContext(input.postId);
      if (!ctx) return;
      if (ctx.authorId !== input.actorId) {
        await createNotifications([{
          recipientId: ctx.authorId,
          type,
          workspaceId: input.workspaceId,
          postId: input.postId,
          actorId: input.actorId,
          data: buildNotificationData({
            postTitle: ctx.title,
            appName: ctx.workspaceName,
            appSlug: input.workspaceSlug,
            boardStatus: input.boardStatus,
          }),
        }]);
      }
      if (input.boardStatus === "shipped" && isPubliclyVisible(ctx)) {
        notifyAppMilestone({
          workspaceId: input.workspaceId,
          workspaceSlug: input.workspaceSlug,
          postId: input.postId,
          type: "app_shipped",
          excludeUserIds: [ctx.authorId, input.actorId],
          postTitle: ctx.title,
          appName: ctx.workspaceName,
        });
      }
    } catch (err) {
      logger.error({ err, postId: input.postId }, "Failed to create board-move notification");
    }
  })();
}

export function notifyPostUpdate(input: {
  postId: string;
  workspaceId: string;
  workspaceSlug: string;
  actorId: string;
  updateContent: string;
}): void {
  void (async () => {
    try {
      const [ctx, actorName] = await Promise.all([
        resolvePostContext(input.postId),
        resolveActorName(input.actorId),
      ]);
      if (!ctx) return;
      if (ctx.authorId !== input.actorId) {
        await createNotifications([{
          recipientId: ctx.authorId,
          type: "post_update",
          workspaceId: input.workspaceId,
          postId: input.postId,
          actorId: input.actorId,
          data: buildNotificationData({
            postTitle: ctx.title,
            appName: ctx.workspaceName,
            appSlug: input.workspaceSlug,
            actorName: actorName ?? undefined,
          }),
        }]);
      }
      if (isPubliclyVisible(ctx)) {
        notifyAppMilestone({
          workspaceId: input.workspaceId,
          workspaceSlug: input.workspaceSlug,
          postId: input.postId,
          type: "app_update",
          excludeUserIds: [ctx.authorId, input.actorId],
          postTitle: ctx.title,
          appName: ctx.workspaceName,
          actorName: actorName ?? undefined,
        });
      }
    } catch (err) {
      logger.error({ err, postId: input.postId }, "Failed to create post-update notification");
    }
  })();
}

export function notifyPostComment(input: {
  postId: string;
  workspaceId: string;
  workspaceSlug: string;
  actorId: string;
  commentBody: string;
}): void {
  void (async () => {
    try {
      const [ctx, actorName] = await Promise.all([
        resolvePostContext(input.postId),
        resolveActorName(input.actorId),
      ]);
      if (!ctx) return;
      if (ctx.authorId === input.actorId) return; // self-action guard
      await createNotifications([{
        recipientId: ctx.authorId,
        type: "post_comment",
        workspaceId: input.workspaceId,
        postId: input.postId,
        actorId: input.actorId,
        data: buildNotificationData({
          postTitle: ctx.title,
          appName: ctx.workspaceName,
          appSlug: input.workspaceSlug,
          actorName: actorName ?? undefined,
          commentPreview: input.commentBody,
        }),
      }]);
    } catch (err) {
      logger.error({ err, postId: input.postId }, "Failed to create post-comment notification");
    }
  })();
}

export function notifyAppMilestone(input: {
  workspaceId: string;
  workspaceSlug: string;
  postId: string;
  type: "app_shipped" | "app_update";
  excludeUserIds: string[];
  postTitle: string;
  appName: string;
  actorName?: string;
}): void {
  void (async () => {
    try {
      const followerIds = await resolveFollowerRecipients(input.workspaceId, input.excludeUserIds);
      if (followerIds.length === 0) return;
      const data = buildNotificationData({
        postTitle: input.postTitle,
        appName: input.appName,
        appSlug: input.workspaceSlug,
        actorName: input.actorName,
      });
      const rows: NewNotification[] = followerIds.map((recipientId) => ({
        recipientId,
        type: input.type,
        workspaceId: input.workspaceId,
        postId: input.postId,
        actorId: null,
        data,
      }));
      await createNotifications(rows);
    } catch (err) {
      logger.error({ err, workspaceId: input.workspaceId }, "Failed to fan-out app milestone notification");
    }
  })();
}

/**
 * Fire when a new post lands in triage (requireApproval=true). Notifies all workspace
 * owners and admins except the submitter so they know triage has a new item to review.
 */
export function notifyAdminNewPost(input: {
  postId: string;
  workspaceId: string;
  workspaceSlug: string;
  workspaceName: string;
  postTitle: string;
  authorId: string;
  isAnonymous: boolean;
}): void {
  void (async () => {
    try {
      const rows = await db
        .select({ userId: workspaceMembers.userId })
        .from(workspaceMembers)
        .where(
          and(
            eq(workspaceMembers.workspaceId, input.workspaceId),
            inArray(workspaceMembers.role, ["owner", "admin"])
          )
        );

      const recipientIds = filterFollowerIds(rows.map((r) => r.userId), [input.authorId]);

      if (recipientIds.length === 0) return;

      const data = buildNotificationData({
        postTitle: input.postTitle,
        appName: input.workspaceName,
        appSlug: input.workspaceSlug,
      });

      // Never reveal the real author ID when the post is anonymous — admins receive
      // the notification but must not be able to identify the submitter via actorId.
      const actorId = input.isAnonymous ? null : input.authorId;

      const newRows: NewNotification[] = recipientIds.map((recipientId) => ({
        recipientId,
        type: "new_pending_post" as const,
        workspaceId: input.workspaceId,
        postId: input.postId,
        actorId,
        data,
      }));

      await createNotifications(newRows);
    } catch (err) {
      logger.error({ err, postId: input.postId }, "Failed to create new-pending-post notifications");
    }
  })();
}

/**
 * Fire when an existing user is added to a workspace (direct-add path only).
 * Pending-invite acceptance is user-initiated, so no in-app ping there.
 * Message copy is role-dependent on the client (data.role).
 */
export function notifyWorkspaceInvite(input: {
  recipientId: string;
  workspaceId: string;
  workspaceSlug: string;
  workspaceName: string;
  actorId: string;
  actorName?: string | null;
  role: "admin" | "member";
}): void {
  if (input.recipientId === input.actorId) return; // self-add guard
  void (async () => {
    try {
      const actorName = input.actorName ?? (await resolveActorName(input.actorId));
      await createNotifications([{
        recipientId: input.recipientId,
        type: "workspace_invite",
        workspaceId: input.workspaceId,
        postId: null,
        actorId: input.actorId,
        data: buildNotificationData({
          appName: input.workspaceName,
          appSlug: input.workspaceSlug,
          actorName: actorName ?? undefined,
          role: input.role,
        }),
      }]);
    } catch (err) {
      logger.error({ err, workspaceId: input.workspaceId }, "Failed to create workspace-invite notification");
    }
  })();
}

// ─── Read-side (controller queries) ──────────────────────────────────────────

export type NotificationItem = {
  id: string;
  type: string;
  workspaceId: string;
  postId: string | null;
  actorId: string | null;
  data: NotificationData;
  readAt: Date | null;
  createdAt: Date;
};

export async function listNotifications(input: {
  userId: string;
  limit: number;
  cursor: { createdAt: Date; id: string } | null;
  filter: "all" | "unread";
}): Promise<{ items: NotificationItem[]; nextCursor: string | null }> {
  const { userId, limit, cursor, filter } = input;

  const cursorCondition = cursor
    ? or(
        lt(notifications.createdAt, cursor.createdAt),
        and(
          eq(notifications.createdAt, cursor.createdAt),
          sql`${notifications.id}::text < ${cursor.id}`,
        ),
      )
    : undefined;

  const rows = await db
    .select()
    .from(notifications)
    .where(
      and(
        eq(notifications.recipientId, userId),
        filter === "unread" ? isNull(notifications.readAt) : undefined,
        cursorCondition,
      ),
    )
    .orderBy(desc(notifications.createdAt), desc(notifications.id))
    .limit(limit + 1);

  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  const last = page[page.length - 1];
  const nextCursor = hasMore && last ? encodeFeedCursor(last.createdAt, last.id) : null;

  const items: NotificationItem[] = page.map((r) => ({
    id: r.id,
    type: r.type,
    workspaceId: r.workspaceId,
    postId: r.postId ?? null,
    actorId: r.actorId ?? null,
    data: r.data as NotificationData,
    readAt: r.readAt ?? null,
    createdAt: r.createdAt,
  }));

  return { items, nextCursor };
}

export async function getUnreadCount(userId: string): Promise<number> {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(notifications)
    .where(and(eq(notifications.recipientId, userId), isNull(notifications.readAt)));
  return row?.count ?? 0;
}

export async function markOneRead(id: string, userId: string): Promise<void> {
  await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(
      and(
        eq(notifications.id, id),
        eq(notifications.recipientId, userId),
        isNull(notifications.readAt),
      ),
    );
  // no-op if not found, not owned, or already read — per spec
}

export async function markAllRead(userId: string): Promise<void> {
  await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(and(eq(notifications.recipientId, userId), isNull(notifications.readAt)));
}
