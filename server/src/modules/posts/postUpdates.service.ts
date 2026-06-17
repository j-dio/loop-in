import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { db } from "../../db";
import { postUpdates, posts, users } from "../../db/schema";
import { viewerCanSeePost, type RequesterContext } from "./posts.helpers";

export type PostUpdateLatest = {
  content: string;
  createdAt: Date;
};

export async function fetchLatestUpdatesForPosts(
  postIds: string[]
): Promise<Map<string, PostUpdateLatest>> {
  if (postIds.length === 0) return new Map();
  const rows = await db
    .select({
      postId: postUpdates.postId,
      content: postUpdates.content,
      createdAt: postUpdates.createdAt,
    })
    .from(postUpdates)
    .where(inArray(postUpdates.postId, postIds))
    .orderBy(desc(postUpdates.createdAt));

  const map = new Map<string, PostUpdateLatest>();
  for (const row of rows) {
    if (!map.has(row.postId)) {
      map.set(row.postId, { content: row.content, createdAt: row.createdAt });
    }
  }
  return map;
}

export type PostUpdatePublic = {
  id: string;
  postId: string;
  content: string;
  createdAt: Date;
  author: { id: string; name: string; avatarUrl: string | null };
};

async function loadPostForWorkspace(postId: string, workspaceId: string) {
  const [row] = await db
    .select()
    .from(posts)
    .where(and(eq(posts.id, postId), eq(posts.workspaceId, workspaceId)))
    .limit(1);
  return row ?? null;
}

export async function listPostUpdates(input: {
  workspaceId: string;
  postId: string;
  ctx: RequesterContext;
}): Promise<{ updates: PostUpdatePublic[] } | "not_found" | "forbidden"> {
  const post = await loadPostForWorkspace(input.postId, input.workspaceId);
  if (!post) return "not_found";
  if (!viewerCanSeePost(post, input.ctx)) {
    if (post.deletedAt) return "not_found";
    return "forbidden";
  }

  const rows = await db
    .select({
      update: postUpdates,
      authorName: users.name,
      authorAvatar: users.avatarUrl,
    })
    .from(postUpdates)
    .innerJoin(users, eq(postUpdates.authorId, users.id))
    .where(
      and(
        eq(postUpdates.postId, input.postId),
        eq(postUpdates.workspaceId, input.workspaceId)
      )
    )
    .orderBy(asc(postUpdates.createdAt), asc(postUpdates.id));

  const out: PostUpdatePublic[] = rows.map((r) => ({
    id: r.update.id,
    postId: r.update.postId,
    content: r.update.content,
    createdAt: r.update.createdAt,
    author: {
      id: r.update.authorId,
      name: r.authorName ?? "Unknown",
      avatarUrl: r.authorAvatar,
    },
  }));

  return { updates: out };
}

export async function createPostUpdate(input: {
  workspaceId: string;
  postId: string;
  authorId: string;
  content: string;
  ctx: RequesterContext;
}): Promise<PostUpdatePublic | "not_found" | "forbidden"> {
  const post = await loadPostForWorkspace(input.postId, input.workspaceId);
  if (!post) return "not_found";
  if (!viewerCanSeePost(post, input.ctx)) {
    if (post.deletedAt) return "not_found";
    return "forbidden";
  }

  const [inserted] = await db
    .insert(postUpdates)
    .values({
      postId: input.postId,
      workspaceId: input.workspaceId,
      authorId: input.authorId,
      content: input.content,
    })
    .returning();

  if (!inserted) throw new Error("Failed to create post update");

  const [authorRow] = await db
    .select({ name: users.name, avatarUrl: users.avatarUrl })
    .from(users)
    .where(eq(users.id, input.authorId))
    .limit(1);

  return {
    id: inserted.id,
    postId: inserted.postId,
    content: inserted.content,
    createdAt: inserted.createdAt,
    author: {
      id: input.authorId,
      name: authorRow?.name ?? "Unknown",
      avatarUrl: authorRow?.avatarUrl ?? null,
    },
  };
}
