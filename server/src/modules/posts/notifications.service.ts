import { eq } from "drizzle-orm";
import { db } from "../../db";
import { posts, users } from "../../db/schema";
import {
  isEmailConfigured,
  sendPostApprovedEmail,
  sendPostShippedEmail,
  sendPostUpdateEmail,
} from "../email/email.service";
import { logger } from "../../lib/logger";

async function resolvePostAuthor(postId: string): Promise<{
  authorId: string;
  isAnonymous: boolean;
  title: string;
  authorEmail: string;
  authorName: string | null;
} | null> {
  const [row] = await db
    .select({
      authorId: posts.authorId,
      isAnonymous: posts.isAnonymous,
      title: posts.title,
      authorEmail: users.email,
      authorName: users.name,
    })
    .from(posts)
    .innerJoin(users, eq(posts.authorId, users.id))
    .where(eq(posts.id, postId))
    .limit(1);
  return row ?? null;
}

function postUrl(workspaceSlug: string, postId: string): string {
  const base = process.env.CLIENT_URL ?? "";
  return `${base}/${workspaceSlug}/post/${postId}`;
}

export function notifyPostApproved(input: {
  postId: string;
  workspaceSlug: string;
  actorId: string;
}): void {
  void (async () => {
    try {
      if (!isEmailConfigured()) return;
      const row = await resolvePostAuthor(input.postId);
      if (!row || row.isAnonymous || row.authorId === input.actorId) return;
      await sendPostApprovedEmail({
        to: row.authorEmail,
        authorName: row.authorName ?? "there",
        postTitle: row.title,
        postUrl: postUrl(input.workspaceSlug, input.postId),
      });
    } catch (err) {
      logger.error({ err, postId: input.postId }, "Failed to send post-approved notification");
    }
  })();
}

export function notifyPostShipped(input: {
  postId: string;
  workspaceSlug: string;
  actorId: string;
}): void {
  void (async () => {
    try {
      if (!isEmailConfigured()) return;
      const row = await resolvePostAuthor(input.postId);
      if (!row || row.isAnonymous || row.authorId === input.actorId) return;
      await sendPostShippedEmail({
        to: row.authorEmail,
        authorName: row.authorName ?? "there",
        postTitle: row.title,
        postUrl: postUrl(input.workspaceSlug, input.postId),
      });
    } catch (err) {
      logger.error({ err, postId: input.postId }, "Failed to send post-shipped notification");
    }
  })();
}

export function notifyPostUpdate(input: {
  postId: string;
  workspaceSlug: string;
  actorId: string;
  updateContent: string;
}): void {
  void (async () => {
    try {
      if (!isEmailConfigured()) return;
      const row = await resolvePostAuthor(input.postId);
      if (!row || row.isAnonymous || row.authorId === input.actorId) return;
      await sendPostUpdateEmail({
        to: row.authorEmail,
        authorName: row.authorName ?? "there",
        postTitle: row.title,
        updateContent: input.updateContent,
        postUrl: postUrl(input.workspaceSlug, input.postId),
      });
    } catch (err) {
      logger.error({ err, postId: input.postId }, "Failed to send post-update notification");
    }
  })();
}
