import { z } from "zod";
import { WorkspaceSlugSchema } from "../workspaces/workspaces.schemas";

export const CreateCommentBodySchema = z.object({
  content: z.string().trim().min(1).max(10000),
});

export const CommentsPostParamsSchema = z.object({
  slug: WorkspaceSlugSchema,
  postId: z.string().uuid(),
});

export const CommentDeleteParamsSchema = z.object({
  slug: WorkspaceSlugSchema,
  postId: z.string().uuid(),
  commentId: z.string().uuid(),
});
