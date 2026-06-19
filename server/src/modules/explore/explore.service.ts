import { and, desc, eq, inArray, isNull, lt, or, sql } from "drizzle-orm";
import { db } from "../../db";
import { follows, postUpdates, posts, users, workspaces } from "../../db/schema";
import { serializeAuthorForPost } from "../posts/posts.service";
import type { PostCategory, ModerationStatus, BoardStatus } from "../posts/posts.service";

export type ExploreWorkspace = {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  createdAt: Date;
  postCount: number;
  followerCount: number;
  isFollowing: boolean;
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
  // Note: the raw `isAnonymous` flag is intentionally NOT exposed on the public feed —
  // identity is masked by serializeAuthorForPost (a hidden author has no `id`).
  author: { id?: string; name: string; avatarUrl: string | null };
  workspace: { name: string; slug: string; logoUrl: string | null };
};

export type FollowingFeedItem =
  | ({ type: "post" } & ExploreFeedItem)
  | {
      type: "update";
      id: string;
      createdAt: Date;
      content: string;
      post: { id: string; title: string };
      author: { id?: string; name: string; avatarUrl: string | null };
      workspace: { name: string; slug: string; logoUrl: string | null };
    };

/**
 * Directory of public workspaces. `sort="active"` (default) ranks by approved-post count;
 * `sort="newest"` ranks by recency (powers the Explore "new apps" strip). The
 * `visibility='public'` filter is identical in both modes — invite-only never leaks.
 */
export async function listPublicWorkspaces(
  limit: number,
  viewerId?: string,
  sort: "active" | "newest" = "active"
): Promise<ExploreWorkspace[]> {
  const approvedPosts = sql<number>`count(${posts.id}) filter (where ${posts.moderationStatus} = 'approved' and ${posts.deletedAt} is null)`;
  const followerCount = sql<number>`(select count(*)::int from ${follows} where ${follows.workspaceId} = ${workspaces.id})`;
  const isFollowing = viewerId
    ? sql<boolean>`exists(select 1 from ${follows} where ${follows.workspaceId} = ${workspaces.id} and ${follows.userId} = ${viewerId})`
    : sql<boolean>`false`;

  const rows = await db
    .select({
      id: workspaces.id,
      name: workspaces.name,
      slug: workspaces.slug,
      logoUrl: workspaces.logoUrl,
      createdAt: workspaces.createdAt,
      postCount: approvedPosts,
      followerCount,
      isFollowing,
    })
    .from(workspaces)
    .leftJoin(posts, eq(posts.workspaceId, workspaces.id))
    .where(eq(workspaces.visibility, "public"))
    .groupBy(workspaces.id)
    .orderBy(
      ...(sort === "newest"
        ? [desc(workspaces.createdAt)]
        : [desc(approvedPosts), desc(workspaces.createdAt)])
    )
    .limit(limit);

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    slug: r.slug,
    logoUrl: r.logoUrl,
    createdAt: r.createdAt,
    postCount: Number(r.postCount ?? 0),
    followerCount: Number(r.followerCount ?? 0),
    isFollowing: Boolean(r.isFollowing),
  }));
}

/** Opaque base64url newest-cursor (createdAt, id). Shared by the discover + following feeds. */
export function encodeFeedCursor(createdAt: Date, id: string): string {
  const payload = { v: 1 as const, createdAt: createdAt.toISOString(), id };
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
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
      workspaceLogo: workspaces.logoUrl,
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

  const nextCursor = hasMore && last ? encodeFeedCursor(last.post.createdAt, last.post.id) : null;

  const items: ExploreFeedItem[] = page.map((r) => ({
    id: r.post.id,
    title: r.post.title,
    description: r.post.description,
    imageUrl: r.post.imageUrl ?? null,
    category: r.post.category as PostCategory,
    boardStatus: r.post.boardStatus as BoardStatus,
    upvoteCount: r.post.upvoteCount,
    createdAt: r.post.createdAt,
    author: serializeAuthorForPost(
      { id: r.authorId, name: r.authorName, avatarUrl: r.authorAvatar },
      { isAnonymous: r.post.isAnonymous },
      { userId: undefined, workspaceRole: undefined }
    ),
    workspace: { name: r.workspaceName, slug: r.workspaceSlug, logoUrl: r.workspaceLogo },
  }));

  return { items, nextCursor };
}

/**
 * Merge two reverse-chron sources (posts + status updates) into one page.
 * Each source is pre-fetched at limit+1 in (createdAt desc, id desc) order; merging their heads
 * yields the true top-`limit` of the union (merge of sorted streams). Ties broken by id desc to
 * match the SQL `id::text <` cursor ordering.
 */
export function mergeFollowingFeed(
  postItems: FollowingFeedItem[],
  updateItems: FollowingFeedItem[],
  limit: number
): { items: FollowingFeedItem[]; nextCursor: string | null } {
  const merged = [...postItems, ...updateItems].sort((a, b) => {
    const dt = b.createdAt.getTime() - a.createdAt.getTime();
    if (dt !== 0) return dt;
    return b.id.localeCompare(a.id);
  });

  const items = merged.slice(0, limit);
  const hasMore = merged.length > limit;
  const last = items[items.length - 1];
  const nextCursor = hasMore && last ? encodeFeedCursor(last.createdAt, last.id) : null;

  return { items, nextCursor };
}

function updateCursorWhere(createdAt: Date, id: string) {
  return or(
    lt(postUpdates.createdAt, createdAt),
    and(eq(postUpdates.createdAt, createdAt), sql`${postUpdates.id}::text < ${id}`)
  );
}

/**
 * Following feed: reverse-chron union of approved posts + status updates from the apps the user
 * follows. Two-query bounded merge (see mergeFollowingFeed). Updates whose parent post is not
 * approved / soft-deleted are excluded so hidden posts never leak via their updates.
 */
export async function listFollowingFeed(input: {
  userId: string;
  limit: number;
  cursor: { createdAt: Date; id: string } | null;
}): Promise<{ items: FollowingFeedItem[]; nextCursor: string | null }> {
  const followed = await db
    .select({ workspaceId: follows.workspaceId })
    .from(follows)
    .where(eq(follows.userId, input.userId));
  const wsIds = followed.map((f) => f.workspaceId);
  if (wsIds.length === 0) return { items: [], nextCursor: null };

  const fetch = input.limit + 1;

  const postBase = and(
    inArray(posts.workspaceId, wsIds),
    eq(workspaces.visibility, "public"),
    eq(posts.moderationStatus, "approved"),
    isNull(posts.deletedAt)
  );
  const postWhere = input.cursor
    ? and(postBase, feedCursorWhere(input.cursor.createdAt, input.cursor.id))
    : postBase;

  const updateBase = and(
    inArray(postUpdates.workspaceId, wsIds),
    eq(workspaces.visibility, "public"),
    eq(posts.moderationStatus, "approved"),
    isNull(posts.deletedAt)
  );
  const updateWhere = input.cursor
    ? and(updateBase, updateCursorWhere(input.cursor.createdAt, input.cursor.id))
    : updateBase;

  const [postRows, updateRows] = await Promise.all([
    db
      .select({
        post: posts,
        authorId: users.id,
        authorName: users.name,
        authorAvatar: users.avatarUrl,
        workspaceName: workspaces.name,
        workspaceSlug: workspaces.slug,
        workspaceLogo: workspaces.logoUrl,
      })
      .from(posts)
      .innerJoin(workspaces, eq(posts.workspaceId, workspaces.id))
      .innerJoin(users, eq(posts.authorId, users.id))
      .where(postWhere)
      .orderBy(desc(posts.createdAt), desc(posts.id))
      .limit(fetch),
    db
      .select({
        id: postUpdates.id,
        content: postUpdates.content,
        createdAt: postUpdates.createdAt,
        postId: posts.id,
        postTitle: posts.title,
        authorId: users.id,
        authorName: users.name,
        authorAvatar: users.avatarUrl,
        workspaceName: workspaces.name,
        workspaceSlug: workspaces.slug,
        workspaceLogo: workspaces.logoUrl,
      })
      .from(postUpdates)
      .innerJoin(posts, eq(postUpdates.postId, posts.id))
      .innerJoin(workspaces, eq(postUpdates.workspaceId, workspaces.id))
      .innerJoin(users, eq(postUpdates.authorId, users.id))
      .where(updateWhere)
      .orderBy(desc(postUpdates.createdAt), desc(postUpdates.id))
      .limit(fetch),
  ]);

  const postItems: FollowingFeedItem[] = postRows.map((r) => ({
    type: "post",
    id: r.post.id,
    title: r.post.title,
    description: r.post.description,
    imageUrl: r.post.imageUrl ?? null,
    category: r.post.category as PostCategory,
    boardStatus: r.post.boardStatus as BoardStatus,
    upvoteCount: r.post.upvoteCount,
    createdAt: r.post.createdAt,
    author: serializeAuthorForPost(
      { id: r.authorId, name: r.authorName, avatarUrl: r.authorAvatar },
      { isAnonymous: r.post.isAnonymous },
      { userId: undefined, workspaceRole: undefined }
    ),
    workspace: { name: r.workspaceName, slug: r.workspaceSlug, logoUrl: r.workspaceLogo },
  }));

  const updateItems: FollowingFeedItem[] = updateRows.map((r) => ({
    type: "update",
    id: r.id,
    createdAt: r.createdAt,
    content: r.content,
    post: { id: r.postId, title: r.postTitle },
    author: { id: r.authorId, name: r.authorName ?? "Unknown", avatarUrl: r.authorAvatar },
    workspace: { name: r.workspaceName, slug: r.workspaceSlug, logoUrl: r.workspaceLogo },
  }));

  return mergeFollowingFeed(postItems, updateItems, input.limit);
}

// Re-export for callers that only import from this module.
export type { ModerationStatus };
