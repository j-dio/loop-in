import { z } from "zod";
import { WorkspaceSlugSchema } from "../workspaces/workspaces.schemas";

export const AiParentParamsSchema = z.object({
  slug: WorkspaceSlugSchema,
});

export const DigestItemSchema = z.object({
  priority_rank: z.number().int().min(1).max(200),
  title: z.string().min(1).max(500),
  rationale: z.string().min(1).max(1000),
  implementation_notes: z.string().min(1).max(1000),
  complexity: z.enum(["S", "M", "L"]),
});

export const DigestResultSchema = z.object({
  items: z.array(DigestItemSchema).max(100),
  pattern_summary: z.string().min(1).max(2000),
});

export type DigestItem = z.infer<typeof DigestItemSchema>;
export type DigestResult = z.infer<typeof DigestResultSchema>;
