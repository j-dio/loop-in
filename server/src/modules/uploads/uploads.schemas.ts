import { z } from "zod";
import { WorkspaceSlugSchema } from "../workspaces/workspaces.schemas";

export const UploadsParentParamsSchema = z.object({
  slug: WorkspaceSlugSchema,
});

export const PresignBodySchema = z.object({
  filename: z.string().trim().min(1).max(255),
  content_type: z.enum(["image/jpeg", "image/png", "image/gif", "image/webp"]),
});
