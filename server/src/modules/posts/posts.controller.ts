import type { NextFunction, Request, Response } from "express";
import {
  CreatePostBodySchema,
  ListPostsQuerySchema,
  PostCursorSchema,
  PostIdParamsSchema,
  PostsParentParamsSchema,
  PatchPostBodySchema,
} from "./posts.schemas";
import {
  createPost,
  getMyUpvoteState,
  getPostById,
  listPosts,
  softDeletePost,
  toggleUpvote,
  updatePost,
  type ListPostsSort,
} from "./posts.service";

function parseCursor(raw: string | undefined, sort: ListPostsSort):
  | { k: "newest"; createdAt: Date; id: string }
  | { k: "top"; upvoteCount: number; createdAt: Date; id: string }
  | null
  | "mismatch" {
  if (!raw) return null;
  try {
    const json: unknown = JSON.parse(Buffer.from(raw, "base64url").toString("utf8"));
    const parsed = PostCursorSchema.safeParse(json);
    if (!parsed.success) return null;
    const c = parsed.data;
    const effectiveSort = sort === "trending" ? "top" : sort;
    if (c.k === "newest" && effectiveSort !== "newest") return "mismatch";
    if (c.k === "top" && effectiveSort === "newest") return "mismatch";
    if (c.k === "newest") {
      return { k: "newest", createdAt: new Date(c.createdAt), id: c.id };
    }
    return {
      k: "top",
      upvoteCount: c.upvoteCount,
      createdAt: new Date(c.createdAt),
      id: c.id,
    };
  } catch {
    return null;
  }
}

function requesterCtx(req: Request) {
  return {
    userId: req.user?.id,
    workspaceRole: req.workspaceRole,
  };
}

/**
 * Public feed list. Response includes `upvotedPostIds`: post IDs on this page the current user
 * has upvoted (batch lookup, no extra round-trips). Empty when unauthenticated.
 */
export async function listPostsHandler(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.workspace) return res.status(404).json({ error: "Workspace not found" });

    const paramsParsed = PostsParentParamsSchema.safeParse(req.params);
    if (!paramsParsed.success) {
      return res.status(400).json({ error: "Invalid params", details: paramsParsed.error.flatten() });
    }

    const queryParsed = ListPostsQuerySchema.safeParse(req.query);
    if (!queryParsed.success) {
      return res.status(400).json({ error: "Invalid query", details: queryParsed.error.flatten() });
    }

    const sort = queryParsed.data.sort as ListPostsSort;
    const cursor = parseCursor(queryParsed.data.cursor, sort);
    if (cursor === "mismatch") {
      return res.status(400).json({ error: "Cursor does not match sort" });
    }

    const result = await listPosts({
      workspaceId: req.workspace.id,
      sort,
      limit: queryParsed.data.limit,
      cursor,
      ctx: requesterCtx(req),
    });

    return res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function getPostHandler(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.workspace) return res.status(404).json({ error: "Workspace not found" });

    const paramsParsed = PostIdParamsSchema.safeParse(req.params);
    if (!paramsParsed.success) {
      return res.status(400).json({ error: "Invalid params", details: paramsParsed.error.flatten() });
    }

    const post = await getPostById({
      workspaceId: req.workspace.id,
      postId: paramsParsed.data.postId,
      ctx: requesterCtx(req),
    });

    if (post === "not_found") return res.status(404).json({ error: "Post not found" });
    if (post === "forbidden") return res.status(403).json({ error: "Forbidden" });

    return res.json({ post });
  } catch (err) {
    next(err);
  }
}

export async function createPostHandler(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user?.id) return res.status(401).json({ error: "Unauthorized" });
    if (!req.workspace) return res.status(404).json({ error: "Workspace not found" });

    const parsed = CreatePostBodySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid request", details: parsed.error.flatten() });
    }

    const { title, description, category, is_anonymous } = parsed.data;

    const post = await createPost({
      workspaceId: req.workspace.id,
      authorId: req.user.id,
      title,
      description: description ?? null,
      category,
      isAnonymous: is_anonymous,
      ctx: requesterCtx(req),
    });

    return res.status(201).json({ post });
  } catch (err) {
    next(err);
  }
}

export async function patchPostHandler(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user?.id) return res.status(401).json({ error: "Unauthorized" });
    if (!req.workspace) return res.status(404).json({ error: "Workspace not found" });

    const paramsParsed = PostIdParamsSchema.safeParse(req.params);
    if (!paramsParsed.success) {
      return res.status(400).json({ error: "Invalid params", details: paramsParsed.error.flatten() });
    }

    const bodyParsed = PatchPostBodySchema.safeParse(req.body);
    if (!bodyParsed.success) {
      return res.status(400).json({ error: "Invalid request", details: bodyParsed.error.flatten() });
    }

    const updated = await updatePost({
      workspaceId: req.workspace.id,
      postId: paramsParsed.data.postId,
      editorUserId: req.user.id,
      workspaceRole: req.workspaceRole,
      patch: bodyParsed.data,
    });

    if (updated === "not_found") return res.status(404).json({ error: "Post not found" });
    if (updated === "forbidden") return res.status(403).json({ error: "Forbidden" });

    return res.json({ post: updated });
  } catch (err) {
    next(err);
  }
}

export async function deletePostHandler(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user?.id) return res.status(401).json({ error: "Unauthorized" });
    if (!req.workspace) return res.status(404).json({ error: "Workspace not found" });

    const paramsParsed = PostIdParamsSchema.safeParse(req.params);
    if (!paramsParsed.success) {
      return res.status(400).json({ error: "Invalid params", details: paramsParsed.error.flatten() });
    }

    const outcome = await softDeletePost({
      workspaceId: req.workspace.id,
      postId: paramsParsed.data.postId,
      editorUserId: req.user.id,
      workspaceRole: req.workspaceRole,
    });

    if (outcome === "not_found") return res.status(404).json({ error: "Post not found" });
    if (outcome === "forbidden") return res.status(403).json({ error: "Forbidden" });

    return res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

export async function getUpvoteHandler(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.workspace) return res.status(404).json({ error: "Workspace not found" });

    const paramsParsed = PostIdParamsSchema.safeParse(req.params);
    if (!paramsParsed.success) {
      return res.status(400).json({ error: "Invalid params", details: paramsParsed.error.flatten() });
    }

    const result = await getMyUpvoteState({
      workspaceId: req.workspace.id,
      postId: paramsParsed.data.postId,
      ctx: requesterCtx(req),
    });

    if (result === "not_found") return res.status(404).json({ error: "Post not found" });
    if (result === "forbidden") return res.status(403).json({ error: "Forbidden" });

    return res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function postToggleUpvoteHandler(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user?.id) return res.status(401).json({ error: "Unauthorized" });
    if (!req.workspace) return res.status(404).json({ error: "Workspace not found" });

    const paramsParsed = PostIdParamsSchema.safeParse(req.params);
    if (!paramsParsed.success) {
      return res.status(400).json({ error: "Invalid params", details: paramsParsed.error.flatten() });
    }

    const result = await toggleUpvote({
      workspaceId: req.workspace.id,
      postId: paramsParsed.data.postId,
      userId: req.user.id,
      ctx: requesterCtx(req),
    });

    if (result === "not_found") return res.status(404).json({ error: "Post not found" });
    if (result === "forbidden") return res.status(403).json({ error: "Forbidden" });

    return res.json(result);
  } catch (err) {
    next(err);
  }
}
