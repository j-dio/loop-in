import { and, desc, eq, isNull, lt, or, sql } from "drizzle-orm";
import { db } from "../../db";
import { posts, users } from "../../db/schema";
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
  category: PostCategory;
  moderationStatus: ModerationStatus;
  boardStatus: BoardStatus;
  isAnonymous: boolean;
  upvoteCount: number;
  createdAt: Date;
  author: PostAuthorPublic;
};

type RequesterContext = {
  userId: string | undefined;
  workspaceRole: WorkspaceRole | undefined;
};

function isAdminOrOwner(role: WorkspaceRole | undefined): boolean {
  return role === "admin" || role === "owner";
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
  ctx: RequesterContext;
}): Promise<PostPublic> {
  const [inserted] = await db
    .insert(posts)
    .values({
      workspaceId: input.workspaceId,
      authorId: input.authorId,
      title: input.title,
      description: input.description ?? null,
      category: input.category,
      isAnonymous: input.isAnonymous,
      moderationStatus: "pending",
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

export async function listPosts(input: {
  workspaceId: string;
  sort: ListPostsSort;
  limit: number;
  cursor:
    | { k: "newest"; createdAt: Date; id: string }
    | { k: "top"; upvoteCount: number; createdAt: Date; id: string }
    | null;
  ctx: RequesterContext;
}): Promise<{ posts: PostPublic[]; nextCursor: string | null }> {
  const effectiveSort = input.sort === "trending" ? "top" : input.sort;

  const base = listBaseConditions(input.workspaceId);
  let cursorCond: ReturnType<typeof newestCursorWhere> | ReturnType<typeof topCursorWhere> | undefined;
  if (input.cursor && effectiveSort === "newest" && input.cursor.k === "newest") {
    cursorCond = newestCursorWhere(input.cursor.createdAt, input.cursor.id);
  } else if (input.cursor && effectiveSort === "top" && input.cursor.k === "top") {
    cursorCond = topCursorWhere(input.cursor.upvoteCount, input.cursor.createdAt, input.cursor.id);
  } else {
    cursorCond = undefined;
  }

  const whereClause = cursorCond ? and(base, cursorCond) : base;

  const orderBy =
    effectiveSort === "newest"
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
      effectiveSort === "newest"
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

  return {
    posts: page.map((r) => mapRowToPublic(r, input.ctx)),
    nextCursor,
  };
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
  if (row.post.deletedAt) return "not_found";

  const p = row.post;
  const canViewApproved = p.moderationStatus === "approved";
  const isAuthor = input.ctx.userId !== undefined && p.authorId === input.ctx.userId;
  const staff = isAdminOrOwner(input.ctx.workspaceRole);
  const canViewNonApproved = isAuthor || staff;

  if (!canViewApproved && !canViewNonApproved) return "forbidden";

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
