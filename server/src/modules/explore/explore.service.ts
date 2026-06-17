import { and, desc, eq, isNull, lt, or, sql } from "drizzle-orm";
import { db } from "../../db";
import { posts, users, workspaces } from "../../db/schema";
import { serializeAuthorForPost } from "../posts/posts.service";
import type { PostCategory, ModerationStatus, BoardStatus } from "../posts/posts.service";

export type ExploreWorkspace = {
  id: string;
  name: string;
  slug: string;
  createdAt: Date;
  postCount: number;
};

export type ExploreFeedItem = {
  id: string;
  title: string;
  description: string | null;
  imageUrl: string | null;
  category: PostCategory;
  boardStatus: BoardStatus;
  upvoteCount: number;
  createdAt: Date;
  isAnonymous: boolean;
  author: { id?: string; name: string; avatarUrl: string | null };
  workspace: { name: string; slug: string };
};

/** Directory of public workspaces, ranked by approved-post count (most active first). */
export async function listPublicWorkspaces(limit: number): Promise<ExploreWorkspace[]> {
  const approvedPosts = sql<number>`count(${posts.id}) filter (where ${posts.moderationStatus} = 'approved' and ${posts.deletedAt} is null)`;

  const rows = await db
    .select({
      id: workspaces.id,
      name: workspaces.name,
      slug: workspaces.slug,
      createdAt: workspaces.createdAt,
      postCount: approvedPosts,
    })
    .from(workspaces)
    .leftJoin(posts, eq(posts.workspaceId, workspaces.id))
    .where(eq(workspaces.visibility, "public"))
    .groupBy(workspaces.id)
    .orderBy(desc(approvedPosts), desc(workspaces.createdAt))
    .limit(limit);

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    slug: r.slug,
    createdAt: r.createdAt,
    postCount: Number(r.postCount ?? 0),
  }));
}

function feedCursorWhere(createdAt: Date, id: string) {
  return or(
    lt(posts.createdAt, createdAt),
    and(eq(posts.createdAt, createdAt), sql`${posts.id}::text < ${id}`)
  );
}

/**
 * Cross-workspace feed: newest *approved* posts across all *public* workspaces. Never includes
 * invite-only content, pending/spam/rejected posts, or soft-deleted posts. Anonymous authors are
 * masked (the explore viewer is never workspace staff).
 */
export async function listPublicFeed(input: {
  limit: number;
  cursor: { createdAt: Date; id: string } | null;
}): Promise<{ items: ExploreFeedItem[]; nextCursor: string | null }> {
  const base = and(
    eq(workspaces.visibility, "public"),
    eq(posts.moderationStatus, "approved"),
    isNull(posts.deletedAt)
  );
  const whereClause = input.cursor
    ? and(base, feedCursorWhere(input.cursor.createdAt, input.cursor.id))
    : base;

  const rows = await db
    .select({
      post: posts,
      authorId: users.id,
      authorName: users.name,
      authorAvatar: users.avatarUrl,
      workspaceName: workspaces.name,
      workspaceSlug: workspaces.slug,
    })
    .from(posts)
    .innerJoin(workspaces, eq(posts.workspaceId, workspaces.id))
    .innerJoin(users, eq(posts.authorId, users.id))
    .where(whereClause)
    .orderBy(desc(posts.createdAt), desc(posts.id))
    .limit(input.limit + 1);

  const page = rows.slice(0, input.limit);
  const hasMore = rows.length > input.limit;
  const last = page[page.length - 1];

  let nextCursor: string | null = null;
  if (hasMore && last) {
    const payload = { v: 1 as const, createdAt: last.post.createdAt.toISOString(), id: last.post.id };
    nextCursor = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  }

  const items: ExploreFeedItem[] = page.map((r) => ({
    id: r.post.id,
    title: r.post.title,
    description: r.post.description,
    imageUrl: r.post.imageUrl ?? null,
    category: r.post.category as PostCategory,
    boardStatus: r.post.boardStatus as BoardStatus,
    upvoteCount: r.post.upvoteCount,
    createdAt: r.post.createdAt,
    isAnonymous: r.post.isAnonymous,
    author: serializeAuthorForPost(
      { id: r.authorId, name: r.authorName, avatarUrl: r.authorAvatar },
      { isAnonymous: r.post.isAnonymous },
      { userId: undefined, workspaceRole: undefined }
    ),
    workspace: { name: r.workspaceName, slug: r.workspaceSlug },
  }));

  return { items, nextCursor };
}

// Re-export for callers that only import from this module.
export type { ModerationStatus };
