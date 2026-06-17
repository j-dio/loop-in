import { z } from "zod";
import { WorkspaceSlugSchema } from "../workspaces/workspaces.schemas";

export const CreatePostUpdateBodySchema = z.object({
  content: z.string().trim().min(1).max(10000),
});

export const PostUpdateParamsSchema = z.object({
  slug: WorkspaceSlugSchema,
  postId: z.string().uuid(),
});
