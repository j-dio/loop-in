import type { NextFunction, Request, Response } from "express";
import {
  CommentDeleteParamsSchema,
  CommentsPostParamsSchema,
  CreateCommentBodySchema,
} from "./comments.schemas";
import { createComment, listCommentsForPost, softDeleteComment } from "./comments.service";
import type { RequesterContext } from "./posts.service";
import { notifyPostComment } from "../notifications/notifications.service";

function requesterCtx(req: Request): RequesterContext {
  return {
    userId: req.user?.id,
    workspaceRole: req.workspaceRole,
  };
}

export async function listCommentsHandler(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.workspace) return res.status(404).json({ error: "Workspace not found" });

    const paramsParsed = CommentsPostParamsSchema.safeParse(req.params);
    if (!paramsParsed.success) {
      return res.status(400).json({ error: "Invalid params", details: paramsParsed.error.flatten() });
    }

    const result = await listCommentsForPost({
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

export async function createCommentHandler(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user?.id) return res.status(401).json({ error: "Unauthorized" });
    if (!req.workspace) return res.status(404).json({ error: "Workspace not found" });

    const paramsParsed = CommentsPostParamsSchema.safeParse(req.params);
    if (!paramsParsed.success) {
      return res.status(400).json({ error: "Invalid params", details: paramsParsed.error.flatten() });
    }

    const bodyParsed = CreateCommentBodySchema.safeParse(req.body);
    if (!bodyParsed.success) {
      return res.status(400).json({ error: "Invalid request", details: bodyParsed.error.flatten() });
    }

    const comment = await createComment({
      workspaceId: req.workspace.id,
      postId: paramsParsed.data.postId,
      authorId: req.user.id,
      content: bodyParsed.data.content,
      workspaceRole: req.workspaceRole,
      ctx: requesterCtx(req),
    });

    if (comment === "not_found") return res.status(404).json({ error: "Post not found" });
    if (comment === "forbidden") return res.status(403).json({ error: "Forbidden" });

    notifyPostComment({
      postId: paramsParsed.data.postId,
      workspaceId: req.workspace.id,
      workspaceSlug: req.workspace.slug,
      actorId: req.user.id,
      commentBody: bodyParsed.data.content,
    });

    return res.status(201).json({ comment });
  } catch (err) {
    next(err);
  }
}

export async function deleteCommentHandler(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user?.id) return res.status(401).json({ error: "Unauthorized" });
    if (!req.workspace) return res.status(404).json({ error: "Workspace not found" });

    const paramsParsed = CommentDeleteParamsSchema.safeParse(req.params);
    if (!paramsParsed.success) {
      return res.status(400).json({ error: "Invalid params", details: paramsParsed.error.flatten() });
    }

    const outcome = await softDeleteComment({
      workspaceId: req.workspace.id,
      postId: paramsParsed.data.postId,
      commentId: paramsParsed.data.commentId,
      userId: req.user.id,
      workspaceRole: req.workspaceRole,
    });

    if (outcome === "not_found") return res.status(404).json({ error: "Comment not found" });
    if (outcome === "forbidden") return res.status(403).json({ error: "Forbidden" });

    return res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}
