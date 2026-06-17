import type { NextFunction, Request, Response } from "express";
import { CreatePostUpdateBodySchema, PostUpdateParamsSchema } from "./postUpdates.schemas";
import { createPostUpdate, listPostUpdates } from "./postUpdates.service";
import type { RequesterContext } from "./posts.service";
import { notifyPostUpdate } from "./notifications.service";

function requesterCtx(req: Request): RequesterContext {
  return {
    userId: req.user?.id,
    workspaceRole: req.workspaceRole,
  };
}

export async function listPostUpdatesHandler(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.workspace) return res.status(404).json({ error: "Workspace not found" });

    const paramsParsed = PostUpdateParamsSchema.safeParse(req.params);
    if (!paramsParsed.success) {
      return res.status(400).json({ error: "Invalid params", details: paramsParsed.error.flatten() });
    }

    const result = await listPostUpdates({
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

export async function createPostUpdateHandler(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user?.id) return res.status(401).json({ error: "Unauthorized" });
    if (!req.workspace) return res.status(404).json({ error: "Workspace not found" });

    const paramsParsed = PostUpdateParamsSchema.safeParse(req.params);
    if (!paramsParsed.success) {
      return res.status(400).json({ error: "Invalid params", details: paramsParsed.error.flatten() });
    }

    const bodyParsed = CreatePostUpdateBodySchema.safeParse(req.body);
    if (!bodyParsed.success) {
      return res.status(400).json({ error: "Invalid request", details: bodyParsed.error.flatten() });
    }

    const update = await createPostUpdate({
      workspaceId: req.workspace.id,
      postId: paramsParsed.data.postId,
      authorId: req.user.id,
      content: bodyParsed.data.content,
      ctx: requesterCtx(req),
    });

    if (update === "not_found") return res.status(404).json({ error: "Post not found" });
    if (update === "forbidden") return res.status(403).json({ error: "Forbidden" });

    notifyPostUpdate({
      postId: paramsParsed.data.postId,
      workspaceSlug: req.workspace.slug,
      actorId: req.user.id,
      updateContent: bodyParsed.data.content,
    });

    return res.status(201).json({ update });
  } catch (err) {
    next(err);
  }
}
