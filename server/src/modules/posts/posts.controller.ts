import type { NextFunction, Request, Response } from "express";
import {
  AdminPostsListQuerySchema,
  CreateAnnouncementBodySchema,
  CreatePostBodySchema,
  ListPostsQuerySchema,
  ModerationEventsQuerySchema,
  ModeratePostBodySchema,
  PatchBoardStatusBodySchema,
  PatchPostBodySchema,
  PinBodySchema,
  PostCursorSchema,
  PostIdParamsSchema,
  PostsParentParamsSchema,
} from "./posts.schemas";
import { isValidPostImageUrl } from "../uploads/uploads.service";
import { notifyAdminNewPost, notifyAppMilestone, notifyBoardMove, notifyPostApproved } from "../notifications/notifications.service";
import {
  createAnnouncement,
  createPost,
  getMyUpvoteState,
  getPostById,
  listAnnouncementsForAdmin,
  listApprovedPostsForKanban,
  listPendingPostsForTriage,
  listPinnedPosts,
  listPosts,
  moderatePost,
  setPostPinned,
  softDeletePost,
  toggleUpvote,
  updatePost,
  updatePostBoardStatus,
  type ListPostsSort,
} from "./posts.service";
import { listModerationEvents } from "./moderationEvents.service";

function parseCursor(raw: string | undefined, sort: ListPostsSort):
  | { k: "newest"; createdAt: Date; id: string }
  | { k: "top"; upvoteCount: number; createdAt: Date; id: string }
  | { k: "trending"; id: string }
  | null
  | "mismatch" {
  if (!raw) return null;
  try {
    const json: unknown = JSON.parse(Buffer.from(raw, "base64url").toString("utf8"));
    const parsed = PostCursorSchema.safeParse(json);
    if (!parsed.success) return null;
    const c = parsed.data;

    if (sort === "trending") {
      if (c.k === "newest" || c.k === "top") return "mismatch";
      return { k: "trending", id: c.id };
    }
    if (sort === "newest") {
      if (c.k === "top" || c.k === "trending") return "mismatch";
      return { k: "newest", createdAt: new Date(c.createdAt), id: c.id };
    }
    if (c.k === "newest" || c.k === "trending") return "mismatch";
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
export async function listAdminTriageHandler(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.workspace) return res.status(404).json({ error: "Workspace not found" });

    const paramsParsed = PostsParentParamsSchema.safeParse(req.params);
    if (!paramsParsed.success) {
      return res.status(400).json({ error: "Invalid params", details: paramsParsed.error.flatten() });
    }

    const queryParsed = AdminPostsListQuerySchema.safeParse(req.query);
    if (!queryParsed.success) {
      return res.status(400).json({ error: "Invalid query", details: queryParsed.error.flatten() });
    }

    const posts = await listPendingPostsForTriage({
      workspaceId: req.workspace.id,
      limit: queryParsed.data.limit,
      ctx: requesterCtx(req),
    });

    return res.json({ posts });
  } catch (err) {
    next(err);
  }
}

export async function listAdminKanbanHandler(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.workspace) return res.status(404).json({ error: "Workspace not found" });

    const paramsParsed = PostsParentParamsSchema.safeParse(req.params);
    if (!paramsParsed.success) {
      return res.status(400).json({ error: "Invalid params", details: paramsParsed.error.flatten() });
    }

    const queryParsed = AdminPostsListQuerySchema.safeParse(req.query);
    if (!queryParsed.success) {
      return res.status(400).json({ error: "Invalid query", details: queryParsed.error.flatten() });
    }

    const posts = await listApprovedPostsForKanban({
      workspaceId: req.workspace.id,
      limit: queryParsed.data.limit,
      ctx: requesterCtx(req),
    });

    return res.json({ posts });
  } catch (err) {
    next(err);
  }
}

export async function listAnnouncementsHandler(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.workspace) return res.status(404).json({ error: "Workspace not found" });

    const announcements = await listAnnouncementsForAdmin({
      workspaceId: req.workspace.id,
      ctx: requesterCtx(req),
    });

    return res.json({ posts: announcements });
  } catch (err) {
    next(err);
  }
}

export async function moderatePostHandler(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user?.id) return res.status(401).json({ error: "Unauthorized" });
    if (!req.workspace) return res.status(404).json({ error: "Workspace not found" });

    const paramsParsed = PostIdParamsSchema.safeParse(req.params);
    if (!paramsParsed.success) {
      return res.status(400).json({ error: "Invalid params", details: paramsParsed.error.flatten() });
    }

    const bodyParsed = ModeratePostBodySchema.safeParse(req.body);
    if (!bodyParsed.success) {
      return res.status(400).json({ error: "Invalid request", details: bodyParsed.error.flatten() });
    }

    const result = await moderatePost({
      workspaceId: req.workspace.id,
      postId: paramsParsed.data.postId,
      moderationStatus: bodyParsed.data.moderation_status,
      ctx: requesterCtx(req),
    });

    if (result === "not_found") return res.status(404).json({ error: "Post not found" });
    if (result === "no_change") {
      return res.status(409).json({ error: "Post already has that moderation status" });
    }

    // Only email the author on the first approval (pending → approved), not on later re-moderation.
    if (
      bodyParsed.data.moderation_status === "approved" &&
      result.previousStatus === "pending"
    ) {
      notifyPostApproved({
        postId: paramsParsed.data.postId,
        workspaceId: req.workspace.id,
        workspaceSlug: req.workspace.slug,
        actorId: req.user.id,
      });
    }

    return res.json({ post: result.post });
  } catch (err) {
    next(err);
  }
}

export async function patchPostBoardStatusHandler(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user?.id) return res.status(401).json({ error: "Unauthorized" });
    if (!req.workspace) return res.status(404).json({ error: "Workspace not found" });

    const paramsParsed = PostIdParamsSchema.safeParse(req.params);
    if (!paramsParsed.success) {
      return res.status(400).json({ error: "Invalid params", details: paramsParsed.error.flatten() });
    }

    const bodyParsed = PatchBoardStatusBodySchema.safeParse(req.body);
    if (!bodyParsed.success) {
      return res.status(400).json({ error: "Invalid request", details: bodyParsed.error.flatten() });
    }

    const updated = await updatePostBoardStatus({
      workspaceId: req.workspace.id,
      postId: paramsParsed.data.postId,
      boardStatus: bodyParsed.data.board_status,
      ctx: requesterCtx(req),
    });

    if (updated === "not_found") return res.status(404).json({ error: "Post not found" });
    if (updated === "not_approved") {
      return res.status(409).json({ error: "Post must be approved before updating board status" });
    }

    notifyBoardMove({
      postId: paramsParsed.data.postId,
      workspaceId: req.workspace.id,
      workspaceSlug: req.workspace.slug,
      boardStatus: bodyParsed.data.board_status,
      actorId: req.user.id,
    });

    return res.json({ post: updated });
  } catch (err) {
    next(err);
  }
}

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
      q: queryParsed.data.q || undefined,
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

    const { title, description, category, is_anonymous, image_url } = parsed.data;

    if (image_url) {
      if (!isValidPostImageUrl(image_url, req.workspace.id)) {
        return res.status(400).json({ error: "Invalid image URL" });
      }
    }

    const post = await createPost({
      workspaceId: req.workspace.id,
      authorId: req.user.id,
      title,
      description: description ?? null,
      category,
      isAnonymous: is_anonymous,
      imageUrl: image_url ?? null,
      requireApproval: req.workspace.requireApproval,
      ctx: requesterCtx(req),
    });

    if (req.workspace.requireApproval) {
      notifyAdminNewPost({
        postId: post.id,
        workspaceId: req.workspace.id,
        workspaceSlug: req.workspace.slug,
        workspaceName: req.workspace.name,
        postTitle: post.title,
        authorId: req.user.id,
        isAnonymous: post.isAnonymous,
      });
    }

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

export async function createAnnouncementHandler(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user?.id) return res.status(401).json({ error: "Unauthorized" });
    if (!req.workspace) return res.status(404).json({ error: "Workspace not found" });

    const parsed = CreateAnnouncementBodySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid request", details: parsed.error.flatten() });
    }

    const { title, description, image_url } = parsed.data;

    if (image_url) {
      if (!isValidPostImageUrl(image_url, req.workspace.id)) {
        return res.status(400).json({ error: "Invalid image URL" });
      }
    }

    const created = await createAnnouncement({
      workspaceId: req.workspace.id,
      authorId: req.user.id,
      title,
      description: description ?? null,
      imageUrl: image_url ?? null,
      ctx: requesterCtx(req),
    });

    notifyAppMilestone({
      workspaceId: req.workspace.id,
      workspaceSlug: req.workspace.slug,
      postId: created.id,
      type: "app_update",
      excludeUserIds: req.user?.id ? [req.user.id] : [],
      postTitle: created.title,
      appName: req.workspace.name,
      actorName: req.user?.name ?? undefined,
    });

    return res.status(201).json({ post: created });
  } catch (err) {
    next(err);
  }
}

export async function pinPostHandler(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.workspace) return res.status(404).json({ error: "Workspace not found" });
    if (!req.user?.id) return res.status(401).json({ error: "Unauthorized" });

    const paramsParsed = PostIdParamsSchema.safeParse(req.params);
    if (!paramsParsed.success) {
      return res.status(400).json({ error: "Invalid params", details: paramsParsed.error.flatten() });
    }

    const bodyParsed = PinBodySchema.safeParse(req.body);
    if (!bodyParsed.success) {
      return res.status(400).json({ error: "Invalid request", details: bodyParsed.error.flatten() });
    }

    const result = await setPostPinned({
      workspaceId: req.workspace.id,
      postId: paramsParsed.data.postId,
      pinned: bodyParsed.data.pinned,
      actorId: req.user.id,
    });

    if (result === "not_found") return res.status(404).json({ error: "Post not found" });
    if (result === "cap_reached") {
      return res.status(409).json({ error: "You can pin at most 3 posts. Unpin one first." });
    }

    return res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

/** GET /:slug/posts/:postId/moderation-events — staff-only audit trail for a post. */
export async function listModerationEventsHandler(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.workspace) return res.status(404).json({ error: "Workspace not found" });

    const paramsParsed = PostIdParamsSchema.safeParse(req.params);
    if (!paramsParsed.success) {
      return res.status(400).json({ error: "Invalid params", details: paramsParsed.error.flatten() });
    }

    const queryParsed = ModerationEventsQuerySchema.safeParse(req.query);
    if (!queryParsed.success) {
      return res.status(400).json({ error: "Invalid query", details: queryParsed.error.flatten() });
    }

    const events = await listModerationEvents({
      workspaceId: req.workspace.id,
      postId: paramsParsed.data.postId,
      limit: queryParsed.data.limit,
    });

    return res.json({ events });
  } catch (err) {
    next(err);
  }
}

export async function listPinnedHandler(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.workspace) return res.status(404).json({ error: "Workspace not found" });

    const pinnedPosts = await listPinnedPosts({
      workspaceId: req.workspace.id,
      ctx: requesterCtx(req),
    });

    return res.json({ posts: pinnedPosts });
  } catch (err) {
    next(err);
  }
}
