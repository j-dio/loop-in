import { and, desc, eq, inArray, isNull, lt, or, sql } from "drizzle-orm";
import { db } from "../../db";
import { posts, upvotes, users } from "../../db/schema";
import { redis } from "../../lib/redis";
import { trendingRedisKey } from "../../lib/trendingKeys";
import { logger } from "../../lib/logger";
import type { WorkspaceRole } from "../workspaces/workspaces.service";

export type PostCategory = "bug" | "feature_request" | "ui_tweak";
export type ModerationStatus = "pending" | "approved" | "spam" | "rejected";
export type BoardStatus = "inbox" | "under_review" | "planned" | "in_progress" | "shipped";

export type PostAuthorPublic = {
  id?: string;
  name: string;
  avatarUrl: string | null;
};

export type PostPublic = {
  id: string;
  workspaceId: string;
  title: string;
  description: string | null;
  imageUrl: string | null;
  category: PostCategory;
  moderationStatus: ModerationStatus;
  boardStatus: BoardStatus;
  isAnonymous: boolean;
  upvoteCount: number;
  createdAt: Date;
  author: PostAuthorPublic;
};

export type RequesterContext = {
  userId: string | undefined;
  workspaceRole: WorkspaceRole | undefined;
};

function isAdminOrOwner(role: WorkspaceRole | undefined): boolean {
  return role === "admin" || role === "owner";
}

/** Post visible for detail / comments / upvote: approved for all viewers; else author or staff. Not soft-deleted. */
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

/** Same visibility as getPostById: upvote read/toggle only on posts the user could open. */
function canAccessPostForUpvote(
  p: { moderationStatus: string; authorId: string },
  ctx: RequesterContext
): boolean {
  const approved = p.moderationStatus === "approved";
  const isAuthor = ctx.userId !== undefined && p.authorId === ctx.userId;
  const staff = isAdminOrOwner(ctx.workspaceRole);
  return approved || isAuthor || staff;
}

async function fetchUpvotedPostIdsForUser(userId: string, postIds: string[]): Promise<string[]> {
  if (postIds.length === 0) return [];
  const rows = await db
    .select({ postId: upvotes.postId })
    .from(upvotes)
    .where(and(eq(upvotes.userId, userId), inArray(upvotes.postId, postIds)));
  return rows.map((r) => r.postId);
}

export function serializeAuthorForPost(
  author: { id: string; name: string | null; avatarUrl: string | null },
  post: { isAnonymous: boolean },
  ctx: RequesterContext
): PostAuthorPublic {
  const hideIdentity = post.isAnonymous && !isAdminOrOwner(ctx.workspaceRole);
  if (hideIdentity) {
    return { name: "Anonymous", avatarUrl: null };
  }
  return {
    id: author.id,
    name: author.name ?? "Unknown",
    avatarUrl: author.avatarUrl,
  };
}

function mapRowToPublic(
  row: {
    post: typeof posts.$inferSelect;
    authorId: string;
    authorName: string | null;
    authorAvatar: string | null;
  },
  ctx: RequesterContext
): PostPublic {
  const author = {
    id: row.authorId,
    name: row.authorName,
    avatarUrl: row.authorAvatar,
  };
  return {
    id: row.post.id,
    workspaceId: row.post.workspaceId,
    title: row.post.title,
    description: row.post.description,
    imageUrl: row.post.imageUrl ?? null,
    category: row.post.category as PostCategory,
    moderationStatus: row.post.moderationStatus as ModerationStatus,
    boardStatus: row.post.boardStatus as BoardStatus,
    isAnonymous: row.post.isAnonymous,
    upvoteCount: row.post.upvoteCount,
    createdAt: row.post.createdAt,
    author: serializeAuthorForPost(author, { isAnonymous: row.post.isAnonymous }, ctx),
  };
}

export async function createPost(input: {
  workspaceId: string;
  authorId: string;
  title: string;
  description: string | null | undefined;
  category: PostCategory;
  isAnonymous: boolean;
  imageUrl: string | null;
  requireApproval: boolean;
  ctx: RequesterContext;
}): Promise<PostPublic> {
  const moderationStatus = input.requireApproval ? "pending" : "approved";

  const [inserted] = await db
    .insert(posts)
    .values({
      workspaceId: input.workspaceId,
      authorId: input.authorId,
      title: input.title,
      description: input.description ?? null,
      category: input.category,
      isAnonymous: input.isAnonymous,
      imageUrl: input.imageUrl,
      moderationStatus,
      boardStatus: "inbox",
    })
    .returning();

  if (!inserted) throw new Error("Failed to create post");

  const [authorRow] = await db
    .select({ name: users.name, avatarUrl: users.avatarUrl })
    .from(users)
    .where(eq(users.id, input.authorId))
    .limit(1);

  const row = {
    post: inserted,
    authorId: input.authorId,
    authorName: authorRow?.name ?? null,
    authorAvatar: authorRow?.avatarUrl ?? null,
  };
  return mapRowToPublic(row, {
    userId: input.ctx.userId ?? input.authorId,
    workspaceRole: input.ctx.workspaceRole,
  });
}

/** Public feed: approved, not soft-deleted. */
function listBaseConditions(workspaceId: string) {
  return and(
    eq(posts.workspaceId, workspaceId),
    eq(posts.moderationStatus, "approved"),
    isNull(posts.deletedAt)
  );
}

function newestCursorWhere(createdAt: Date, id: string) {
  return or(
    lt(posts.createdAt, createdAt),
    and(eq(posts.createdAt, createdAt), sql`${posts.id}::text < ${id}`)
  );
}

function topCursorWhere(upvoteCount: number, createdAt: Date, id: string) {
  return or(
    lt(posts.upvoteCount, upvoteCount),
    and(eq(posts.upvoteCount, upvoteCount), lt(posts.createdAt, createdAt)),
    and(
      eq(posts.upvoteCount, upvoteCount),
      eq(posts.createdAt, createdAt),
      sql`${posts.id}::text < ${id}`
    )
  );
}

export type ListPostsSort = "trending" | "top" | "newest";

type ListPostsCursor =
  | { k: "newest"; createdAt: Date; id: string }
  | { k: "top"; upvoteCount: number; createdAt: Date; id: string }
  | { k: "trending"; id: string }
  | null;

async function listPostsDbOrdered(input: {
  workspaceId: string;
  sort: "top" | "newest";
  limit: number;
  cursor: ListPostsCursor;
  ctx: RequesterContext;
}): Promise<{ posts: PostPublic[]; nextCursor: string | null; upvotedPostIds: string[] }> {
  const base = listBaseConditions(input.workspaceId);
  let cursorCond: ReturnType<typeof newestCursorWhere> | ReturnType<typeof topCursorWhere> | undefined;
  if (input.cursor && input.sort === "newest" && input.cursor.k === "newest") {
    cursorCond = newestCursorWhere(input.cursor.createdAt, input.cursor.id);
  } else if (input.cursor && input.sort === "top" && input.cursor.k === "top") {
    cursorCond = topCursorWhere(input.cursor.upvoteCount, input.cursor.createdAt, input.cursor.id);
  } else {
    cursorCond = undefined;
  }

  const whereClause = cursorCond ? and(base, cursorCond) : base;

  const orderBy =
    input.sort === "newest"
      ? [desc(posts.createdAt), desc(posts.id)]
      : [desc(posts.upvoteCount), desc(posts.createdAt), desc(posts.id)];

  const rows = await db
    .select({
      post: posts,
      authorId: users.id,
      authorName: users.name,
      authorAvatar: users.avatarUrl,
    })
    .from(posts)
    .innerJoin(users, eq(posts.authorId, users.id))
    .where(whereClause)
    .orderBy(...orderBy)
    .limit(input.limit + 1);

  const page = rows.slice(0, input.limit);
  const hasMore = rows.length > input.limit;
  const last = page[page.length - 1];

  let nextCursor: string | null = null;
  if (hasMore && last) {
    const payload =
      input.sort === "newest"
        ? {
            v: 1 as const,
            k: "newest" as const,
            createdAt: last.post.createdAt.toISOString(),
            id: last.post.id,
          }
        : {
            v: 1 as const,
            k: "top" as const,
            upvoteCount: last.post.upvoteCount,
            createdAt: last.post.createdAt.toISOString(),
            id: last.post.id,
          };
    nextCursor = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  }

  const upvotedPostIds =
    input.ctx.userId && page.length > 0
      ? await fetchUpvotedPostIdsForUser(
          input.ctx.userId,
          page.map((r) => r.post.id)
        )
      : [];

  return {
    posts: page.map((r) => mapRowToPublic(r, input.ctx)),
    nextCursor,
    upvotedPostIds,
  };
}

function trendingFallbackToTop(input: {
  workspaceId: string;
  limit: number;
  cursor: ListPostsCursor;
  ctx: RequesterContext;
  reason: string;
}) {
  logger.warn(
    { workspaceId: input.workspaceId, reason: input.reason },
    "trending feed falling back to top sort"
  );
  const cursor = input.cursor?.k === "trending" ? null : input.cursor;
  return listPostsDbOrdered({
    workspaceId: input.workspaceId,
    sort: "top",
    limit: input.limit,
    cursor,
    ctx: input.ctx,
  });
}

async function listPostsTrending(input: {
  workspaceId: string;
  limit: number;
  cursor: ListPostsCursor;
  ctx: RequesterContext;
}): Promise<{ posts: PostPublic[]; nextCursor: string | null; upvotedPostIds: string[] }> {
  const key = trendingRedisKey(input.workspaceId);

  try {
    const cardinality = await redis.zcard(key);
    if (cardinality === 0) {
      return trendingFallbackToTop({
        workspaceId: input.workspaceId,
        limit: input.limit,
        cursor: input.cursor,
        ctx: input.ctx,
        reason: "redis trending key empty",
      });
    }

    let startRank = 0;
    if (input.cursor?.k === "trending") {
      const rank = await redis.zrevrank(key, input.cursor.id);
      if (rank === null) {
        return trendingFallbackToTop({
          workspaceId: input.workspaceId,
          limit: input.limit,
          cursor: input.cursor,
          ctx: input.ctx,
          reason: "trending cursor anchor not in redis",
        });
      }
      startRank = rank + 1;
    } else if (input.cursor) {
      return trendingFallbackToTop({
        workspaceId: input.workspaceId,
        limit: input.limit,
        cursor: input.cursor,
        ctx: input.ctx,
        reason: "unexpected cursor kind for trending",
      });
    }

    const windowEnd = startRank + input.limit;
    const idWindow = await redis.zrevrange(key, startRank, windowEnd);
    const hasMore = idWindow.length > input.limit;
    const pageIds = hasMore ? idWindow.slice(0, input.limit) : idWindow;

    if (pageIds.length === 0) {
      return { posts: [], nextCursor: null, upvotedPostIds: [] };
    }

    const base = listBaseConditions(input.workspaceId);
    const rowsUnordered = await db
      .select({
        post: posts,
        authorId: users.id,
        authorName: users.name,
        authorAvatar: users.avatarUrl,
      })
      .from(posts)
      .innerJoin(users, eq(posts.authorId, users.id))
      .where(and(base, inArray(posts.id, pageIds)));

    const byId = new Map(rowsUnordered.map((r) => [r.post.id, r]));
    const page = pageIds.map((id) => byId.get(id)).filter((r): r is NonNullable<typeof r> => r !== undefined);

    let nextCursor: string | null = null;
    if (hasMore) {
      const anchorId = pageIds[pageIds.length - 1];
      const payload = { v: 1 as const, k: "trending" as const, id: anchorId };
      nextCursor = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
    }

    const upvotedPostIds =
      input.ctx.userId && page.length > 0
        ? await fetchUpvotedPostIdsForUser(
            input.ctx.userId,
            page.map((r) => r.post.id)
          )
        : [];

    return {
      posts: page.map((r) => mapRowToPublic(r, input.ctx)),
      nextCursor,
      upvotedPostIds,
    };
  } catch (err) {
    logger.warn({ err, workspaceId: input.workspaceId }, "trending redis read failed");
    return trendingFallbackToTop({
      workspaceId: input.workspaceId,
      limit: input.limit,
      cursor: input.cursor,
      ctx: input.ctx,
      reason: "redis error",
    });
  }
}

export async function listPosts(input: {
  workspaceId: string;
  sort: ListPostsSort;
  limit: number;
  cursor: ListPostsCursor;
  ctx: RequesterContext;
}): Promise<{ posts: PostPublic[]; nextCursor: string | null; upvotedPostIds: string[] }> {
  if (input.sort === "trending") {
    return listPostsTrending(input);
  }
  return listPostsDbOrdered({
    workspaceId: input.workspaceId,
    sort: input.sort,
    limit: input.limit,
    cursor: input.cursor,
    ctx: input.ctx,
  });
}

export async function getPostById(input: {
  workspaceId: string;
  postId: string;
  ctx: RequesterContext;
}): Promise<PostPublic | "not_found" | "forbidden"> {
  const [row] = await db
    .select({
      post: posts,
      authorId: users.id,
      authorName: users.name,
      authorAvatar: users.avatarUrl,
    })
    .from(posts)
    .innerJoin(users, eq(posts.authorId, users.id))
    .where(and(eq(posts.id, input.postId), eq(posts.workspaceId, input.workspaceId)))
    .limit(1);

  if (!row) return "not_found";

  if (!viewerCanSeePost(row.post, input.ctx)) {
    if (row.post.deletedAt) return "not_found";
    return "forbidden";
  }

  return mapRowToPublic(row, input.ctx);
}

export async function updatePost(input: {
  workspaceId: string;
  postId: string;
  editorUserId: string;
  workspaceRole: WorkspaceRole | undefined;
  patch: { title?: string; description?: string | null; category?: PostCategory };
}): Promise<PostPublic | "not_found" | "forbidden"> {
  const [row] = await db
    .select()
    .from(posts)
    .where(and(eq(posts.id, input.postId), eq(posts.workspaceId, input.workspaceId)))
    .limit(1);

  if (!row || row.deletedAt) return "not_found";

  const isAuthor = row.authorId === input.editorUserId;
  const canEdit = isAuthor || isAdminOrOwner(input.workspaceRole);
  if (!canEdit) return "forbidden";

  const [updated] = await db
    .update(posts)
    .set({
      title: input.patch.title ?? row.title,
      description:
        input.patch.description !== undefined ? input.patch.description : row.description,
      category: input.patch.category ?? row.category,
    })
    .where(eq(posts.id, input.postId))
    .returning();

  if (!updated) return "not_found";

  const [joined] = await db
    .select({
      post: posts,
      authorId: users.id,
      authorName: users.name,
      authorAvatar: users.avatarUrl,
    })
    .from(posts)
    .innerJoin(users, eq(posts.authorId, users.id))
    .where(eq(posts.id, input.postId))
    .limit(1);

  if (!joined) return "not_found";

  return mapRowToPublic(joined, {
    userId: input.editorUserId,
    workspaceRole: input.workspaceRole,
  });
}

export async function softDeletePost(input: {
  workspaceId: string;
  postId: string;
  editorUserId: string;
  workspaceRole: WorkspaceRole | undefined;
}): Promise<"ok" | "not_found" | "forbidden"> {
  const [row] = await db
    .select()
    .from(posts)
    .where(and(eq(posts.id, input.postId), eq(posts.workspaceId, input.workspaceId)))
    .limit(1);

  if (!row || row.deletedAt) return "not_found";

  const isAuthor = row.authorId === input.editorUserId;
  const canDelete = isAuthor || isAdminOrOwner(input.workspaceRole);
  if (!canDelete) return "forbidden";

  await db.update(posts).set({ deletedAt: new Date() }).where(eq(posts.id, input.postId));

  return "ok";
}

export async function getMyUpvoteState(input: {
  workspaceId: string;
  postId: string;
  ctx: RequesterContext;
}): Promise<{ upvoted: boolean } | "not_found" | "forbidden"> {
  const [row] = await db
    .select()
    .from(posts)
    .where(and(eq(posts.id, input.postId), eq(posts.workspaceId, input.workspaceId)))
    .limit(1);

  if (!row || row.deletedAt) return "not_found";
  if (!canAccessPostForUpvote(row, input.ctx)) return "forbidden";

  if (!input.ctx.userId) return { upvoted: false };

  const [u] = await db
    .select({ id: upvotes.id })
    .from(upvotes)
    .where(and(eq(upvotes.postId, input.postId), eq(upvotes.userId, input.ctx.userId)))
    .limit(1);

  return { upvoted: Boolean(u) };
}

export async function toggleUpvote(input: {
  workspaceId: string;
  postId: string;
  userId: string;
  ctx: RequesterContext;
}): Promise<{ upvoted: boolean; upvoteCount: number } | "not_found" | "forbidden"> {
  return db.transaction(async (tx) => {
    const [locked] = await tx
      .select()
      .from(posts)
      .where(and(eq(posts.id, input.postId), eq(posts.workspaceId, input.workspaceId)))
      .for("update")
      .limit(1);

    if (!locked || locked.deletedAt) return "not_found";
    if (!canAccessPostForUpvote(locked, input.ctx)) return "forbidden";

    const [existing] = await tx
      .select({ id: upvotes.id })
      .from(upvotes)
      .where(and(eq(upvotes.postId, input.postId), eq(upvotes.userId, input.userId)))
      .limit(1);

    if (existing) {
      await tx.delete(upvotes).where(eq(upvotes.id, existing.id));
      const [after] = await tx
        .update(posts)
        .set({ upvoteCount: sql`GREATEST(0, ${posts.upvoteCount} - 1)` })
        .where(eq(posts.id, input.postId))
        .returning({ upvoteCount: posts.upvoteCount });
      if (!after) throw new Error("Failed to update post after upvote removal");
      return { upvoted: false, upvoteCount: after.upvoteCount };
    }

    await tx.insert(upvotes).values({ postId: input.postId, userId: input.userId });
    const [after] = await tx
      .update(posts)
      .set({ upvoteCount: sql`${posts.upvoteCount} + 1` })
      .where(eq(posts.id, input.postId))
      .returning({ upvoteCount: posts.upvoteCount });
    if (!after) throw new Error("Failed to update post after upvote add");
    return { upvoted: true, upvoteCount: after.upvoteCount };
  });
}

export async function moderatePost(input: {
  workspaceId: string;
  postId: string;
  moderationStatus: Exclude<ModerationStatus, "pending">;
  ctx: RequesterContext;
}): Promise<PostPublic | "not_found" | "invalid_transition"> {
  const [row] = await db
    .select()
    .from(posts)
    .where(and(eq(posts.id, input.postId), eq(posts.workspaceId, input.workspaceId)))
    .limit(1);

  if (!row || row.deletedAt) return "not_found";
  if (row.moderationStatus !== "pending") return "invalid_transition";

  const [updated] = await db
    .update(posts)
    .set({ moderationStatus: input.moderationStatus })
    .where(eq(posts.id, input.postId))
    .returning();

  if (!updated) return "not_found";

  const [joined] = await db
    .select({
      post: posts,
      authorId: users.id,
      authorName: users.name,
      authorAvatar: users.avatarUrl,
    })
    .from(posts)
    .innerJoin(users, eq(posts.authorId, users.id))
    .where(eq(posts.id, input.postId))
    .limit(1);

  if (!joined) return "not_found";

  return mapRowToPublic(joined, input.ctx);
}

export async function updatePostBoardStatus(input: {
  workspaceId: string;
  postId: string;
  boardStatus: BoardStatus;
  ctx: RequesterContext;
}): Promise<PostPublic | "not_found" | "not_approved"> {
  const [row] = await db
    .select()
    .from(posts)
    .where(and(eq(posts.id, input.postId), eq(posts.workspaceId, input.workspaceId)))
    .limit(1);

  if (!row || row.deletedAt) return "not_found";
  if (row.moderationStatus !== "approved") return "not_approved";

  const [updated] = await db
    .update(posts)
    .set({ boardStatus: input.boardStatus })
    .where(eq(posts.id, input.postId))
    .returning();

  if (!updated) return "not_found";

  const [joined] = await db
    .select({
      post: posts,
      authorId: users.id,
      authorName: users.name,
      authorAvatar: users.avatarUrl,
    })
    .from(posts)
    .innerJoin(users, eq(posts.authorId, users.id))
    .where(eq(posts.id, input.postId))
    .limit(1);

  if (!joined) return "not_found";

  return mapRowToPublic(joined, input.ctx);
}

export async function listPendingPostsForTriage(input: {
  workspaceId: string;
  limit: number;
  ctx: RequesterContext;
}): Promise<PostPublic[]> {
  const rows = await db
    .select({
      post: posts,
      authorId: users.id,
      authorName: users.name,
      authorAvatar: users.avatarUrl,
    })
    .from(posts)
    .innerJoin(users, eq(posts.authorId, users.id))
    .where(
      and(
        eq(posts.workspaceId, input.workspaceId),
        eq(posts.moderationStatus, "pending"),
        isNull(posts.deletedAt)
      )
    )
    .orderBy(desc(posts.createdAt), desc(posts.id))
    .limit(input.limit);

  return rows.map((r) => mapRowToPublic(r, input.ctx));
}

export async function listApprovedPostsForKanban(input: {
  workspaceId: string;
  limit: number;
  ctx: RequesterContext;
}): Promise<PostPublic[]> {
  const rows = await db
    .select({
      post: posts,
      authorId: users.id,
      authorName: users.name,
      authorAvatar: users.avatarUrl,
    })
    .from(posts)
    .innerJoin(users, eq(posts.authorId, users.id))
    .where(
      and(
        eq(posts.workspaceId, input.workspaceId),
        eq(posts.moderationStatus, "approved"),
        isNull(posts.deletedAt)
      )
    )
    .orderBy(desc(posts.createdAt), desc(posts.id))
    .limit(input.limit);

  return rows.map((r) => mapRowToPublic(r, input.ctx));
}
