import { and, desc, eq, gte, inArray, isNull, lt, or, sql } from "drizzle-orm";
import { db } from "../../db";
import { follows, postUpdates, posts, users, workspaces } from "../../db/schema";
import { serializeAuthorForPost } from "../posts/posts.service";
import type { PostCategory, ModerationStatus, BoardStatus, PostType } from "../posts/posts.service";

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

export type AnnouncementFeedItem = {
  type: "announcement";
  id: string;
  createdAt: Date;
  title: string;
  description: string | null;
  imageUrl: string | null;
  upvoteCount: number;
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
    }
  | AnnouncementFeedItem;

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

/** Same cursor logic as feedCursorWhere but aliased for announcement queries (also keyed on posts). */
const announcementCursorWhere = feedCursorWhere;

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
 * Minimum upvote count for a post to appear in the following feed's trending filter.
 * Status updates are exempt — builder news always shows regardless of threshold.
 */
export const FOLLOWING_TRENDING_MIN = 5;

/**
 * Following feed: reverse-chron union of approved posts + status updates from the apps the user
 * follows. Two-query bounded merge (see mergeFollowingFeed). Updates whose parent post is not
 * approved / soft-deleted are excluded so hidden posts never leak via their updates.
 *
 * When `minUpvotes` is set, only posts meeting that threshold appear; updates are always included.
 * Existing callers omitting `minUpvotes` get the unfiltered post stream (Drizzle ignores undefined
 * args in `and(...)`).
 */
export async function listFollowingFeed(input: {
  userId: string;
  limit: number;
  cursor: { createdAt: Date; id: string } | null;
  minUpvotes?: number;
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
    isNull(posts.deletedAt),
    eq(posts.type, "feedback" as PostType),
    input.minUpvotes != null ? gte(posts.upvoteCount, input.minUpvotes) : undefined
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

  const announcementBase = and(
    inArray(posts.workspaceId, wsIds),
    eq(workspaces.visibility, "public"),
    eq(posts.moderationStatus, "approved"),
    isNull(posts.deletedAt),
    eq(posts.type, "announcement" as PostType)
  );
  const announcementWhere = input.cursor
    ? and(announcementBase, announcementCursorWhere(input.cursor.createdAt, input.cursor.id))
    : announcementBase;

  const [postRows, updateRows, announcementRows] = await Promise.all([
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
    db
      .select({
        id: posts.id,
        title: posts.title,
        description: posts.description,
        imageUrl: posts.imageUrl,
        upvoteCount: posts.upvoteCount,
        createdAt: posts.createdAt,
        isAnonymous: posts.isAnonymous,
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
      .where(announcementWhere)
      .orderBy(desc(posts.createdAt), desc(posts.id))
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

  const announcementItems: FollowingFeedItem[] = announcementRows.map((r) => ({
    type: "announcement",
    id: r.id,
    createdAt: r.createdAt,
    title: r.title,
    description: r.description,
    imageUrl: r.imageUrl ?? null,
    upvoteCount: r.upvoteCount,
    author: serializeAuthorForPost(
      { id: r.authorId, name: r.authorName, avatarUrl: r.authorAvatar },
      { isAnonymous: r.isAnonymous },
      { userId: undefined, workspaceRole: undefined }
    ),
    workspace: { name: r.workspaceName, slug: r.workspaceSlug, logoUrl: r.workspaceLogo },
  }));

  return mergeFollowingFeed([...postItems, ...announcementItems], updateItems, input.limit);
}

export type PulseItem = Extract<FollowingFeedItem, { type: "update" }> | AnnouncementFeedItem;

/**
 * Explore pulse: reverse-chron status updates AND announcements across all PUBLIC workspaces.
 * Builder-authored news only — never raw feedback posts. For updates, the parent post must be
 * approved + not soft-deleted so a hidden post never leaks via its update.
 */
export async function listPublicPulse(input: {
  limit: number;
  cursor: { createdAt: Date; id: string } | null;
}): Promise<{ items: PulseItem[]; nextCursor: string | null }> {
  const fetch = input.limit + 1;

  const updateBase = and(
    eq(workspaces.visibility, "public"),
    eq(posts.moderationStatus, "approved"),
    isNull(posts.deletedAt)
  );
  const updateWhere = input.cursor
    ? and(updateBase, updateCursorWhere(input.cursor.createdAt, input.cursor.id))
    : updateBase;

  const announcementBase = and(
    eq(workspaces.visibility, "public"),
    eq(posts.moderationStatus, "approved"),
    isNull(posts.deletedAt),
    eq(posts.type, "announcement" as PostType)
  );
  const announcementWhere = input.cursor
    ? and(announcementBase, announcementCursorWhere(input.cursor.createdAt, input.cursor.id))
    : announcementBase;

  const [updateRows, announcementRows] = await Promise.all([
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
    db
      .select({
        id: posts.id,
        title: posts.title,
        description: posts.description,
        imageUrl: posts.imageUrl,
        upvoteCount: posts.upvoteCount,
        createdAt: posts.createdAt,
        isAnonymous: posts.isAnonymous,
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
      .where(announcementWhere)
      .orderBy(desc(posts.createdAt), desc(posts.id))
      .limit(fetch),
  ]);

  const updateItems: PulseItem[] = updateRows.map((r) => ({
    type: "update",
    id: r.id,
    createdAt: r.createdAt,
    content: r.content,
    post: { id: r.postId, title: r.postTitle },
    author: { id: r.authorId, name: r.authorName ?? "Unknown", avatarUrl: r.authorAvatar },
    workspace: { name: r.workspaceName, slug: r.workspaceSlug, logoUrl: r.workspaceLogo },
  }));

  const announcementItems: PulseItem[] = announcementRows.map((r) => ({
    type: "announcement",
    id: r.id,
    createdAt: r.createdAt,
    title: r.title,
    description: r.description,
    imageUrl: r.imageUrl ?? null,
    upvoteCount: r.upvoteCount,
    author: serializeAuthorForPost(
      { id: r.authorId, name: r.authorName, avatarUrl: r.authorAvatar },
      { isAnonymous: r.isAnonymous },
      { userId: undefined, workspaceRole: undefined }
    ),
    workspace: { name: r.workspaceName, slug: r.workspaceSlug, logoUrl: r.workspaceLogo },
  }));

  // mergeFollowingFeed accepts two arrays; pass combined announcements+updates as the first arg.
  const { items: merged, nextCursor } = mergeFollowingFeed(
    [...updateItems, ...announcementItems] as FollowingFeedItem[],
    [],
    input.limit
  );

  return { items: merged as PulseItem[], nextCursor };
}

// Re-export for callers that only import from this module.
export type { ModerationStatus };
