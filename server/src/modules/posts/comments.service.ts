import { and, asc, desc, eq, isNull } from "drizzle-orm";
import { db } from "../../db";
import { comments, posts, users } from "../../db/schema";
import type { WorkspaceRole } from "../workspaces/workspaces.service";
import { viewerCanSeePost, type RequesterContext } from "./posts.service";

export type CommentPublic = {
  id: string;
  postId: string;
  workspaceId: string;
  content: string;
  isOfficialReply: boolean;
  createdAt: Date;
  author: { id: string; name: string; avatarUrl: string | null };
};

function isAdminOrOwner(role: WorkspaceRole | undefined): boolean {
  return role === "admin" || role === "owner";
}

async function loadPostForWorkspace(postId: string, workspaceId: string) {
  const [row] = await db
    .select()
    .from(posts)
    .where(and(eq(posts.id, postId), eq(posts.workspaceId, workspaceId)))
    .limit(1);
  return row ?? null;
}

export async function listCommentsForPost(input: {
  workspaceId: string;
  postId: string;
  ctx: RequesterContext;
}): Promise<{ comments: CommentPublic[] } | "not_found" | "forbidden"> {
  const post = await loadPostForWorkspace(input.postId, input.workspaceId);
  if (!post) return "not_found";
  if (!viewerCanSeePost(post, input.ctx)) {
    if (post.deletedAt) return "not_found";
    return "forbidden";
  }

  const rows = await db
    .select({
      comment: comments,
      authorName: users.name,
      authorAvatar: users.avatarUrl,
    })
    .from(comments)
    .innerJoin(users, eq(comments.authorId, users.id))
    .where(
      and(
        eq(comments.postId, input.postId),
        eq(comments.workspaceId, input.workspaceId),
        isNull(comments.deletedAt)
      )
    )
    .orderBy(desc(comments.isOfficialReply), asc(comments.createdAt), asc(comments.id));

  const out: CommentPublic[] = rows.map((r) => ({
    id: r.comment.id,
    postId: r.comment.postId,
    workspaceId: r.comment.workspaceId,
    content: r.comment.content,
    isOfficialReply: r.comment.isOfficialReply,
    createdAt: r.comment.createdAt,
    author: {
      id: r.comment.authorId,
      name: r.authorName ?? "Unknown",
      avatarUrl: r.authorAvatar,
    },
  }));

  return { comments: out };
}

export async function createComment(input: {
  workspaceId: string;
  postId: string;
  authorId: string;
  content: string;
  workspaceRole: WorkspaceRole | undefined;
  ctx: RequesterContext;
}): Promise<CommentPublic | "not_found" | "forbidden"> {
  const post = await loadPostForWorkspace(input.postId, input.workspaceId);
  if (!post) return "not_found";
  if (!viewerCanSeePost(post, input.ctx)) {
    if (post.deletedAt) return "not_found";
    return "forbidden";
  }

  const isOfficial = isAdminOrOwner(input.workspaceRole);

  const [inserted] = await db
    .insert(comments)
    .values({
      postId: input.postId,
      workspaceId: input.workspaceId,
      authorId: input.authorId,
      content: input.content,
      isOfficialReply: isOfficial,
    })
    .returning();

  if (!inserted) throw new Error("Failed to create comment");

  const [authorRow] = await db
    .select({ name: users.name, avatarUrl: users.avatarUrl })
    .from(users)
    .where(eq(users.id, input.authorId))
    .limit(1);

  return {
    id: inserted.id,
    postId: inserted.postId,
    workspaceId: inserted.workspaceId,
    content: inserted.content,
    isOfficialReply: inserted.isOfficialReply,
    createdAt: inserted.createdAt,
    author: {
      id: input.authorId,
      name: authorRow?.name ?? "Unknown",
      avatarUrl: authorRow?.avatarUrl ?? null,
    },
  };
}

export async function softDeleteComment(input: {
  workspaceId: string;
  postId: string;
  commentId: string;
  userId: string;
  workspaceRole: WorkspaceRole | undefined;
}): Promise<"ok" | "not_found" | "forbidden"> {
  const [row] = await db
    .select()
    .from(comments)
    .where(
      and(
        eq(comments.id, input.commentId),
        eq(comments.postId, input.postId),
        eq(comments.workspaceId, input.workspaceId)
      )
    )
    .limit(1);

  if (!row || row.deletedAt) return "not_found";

  const isAuthor = row.authorId === input.userId;
  const canDelete = isAuthor || isAdminOrOwner(input.workspaceRole);
  if (!canDelete) return "forbidden";

  await db
    .update(comments)
    .set({ deletedAt: new Date() })
    .where(eq(comments.id, input.commentId));

  return "ok";
}
