import { z } from "zod";
import { WorkspaceSlugSchema } from "../workspaces/workspaces.schemas";

export const PostCategorySchema = z.enum(["bug", "feature_request", "ui_tweak"]);

export const PostSortSchema = z.enum(["trending", "top", "newest"]);

export const PostsParentParamsSchema = z.object({
  slug: WorkspaceSlugSchema,
});

export const PostIdParamsSchema = z.object({
  slug: WorkspaceSlugSchema,
  postId: z.string().uuid(),
});

export const ListPostsQuerySchema = z.object({
  sort: PostSortSchema.optional().default("newest"),
  limit: z.coerce.number().int().min(1).max(50).optional().default(20),
  cursor: z.string().optional(),
});

export const NewestCursorSchema = z.object({
  v: z.literal(1),
  k: z.literal("newest"),
  createdAt: z.string(),
  id: z.string().uuid(),
});

export const TopCursorSchema = z.object({
  v: z.literal(1),
  k: z.literal("top"),
  upvoteCount: z.number().int().min(0),
  createdAt: z.string(),
  id: z.string().uuid(),
});

export const PostCursorSchema = z.discriminatedUnion("k", [NewestCursorSchema, TopCursorSchema]);

export const CreatePostBodySchema = z.object({
  title: z.string().trim().min(1).max(255),
  description: z.string().trim().max(10000).optional().nullable(),
  category: PostCategorySchema,
  is_anonymous: z.boolean().optional().default(false),
});

export const PatchPostBodySchema = z
  .object({
    title: z.string().trim().min(1).max(255).optional(),
    description: z.string().trim().max(10000).optional().nullable(),
    category: PostCategorySchema.optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "at least one field must be provided" });
