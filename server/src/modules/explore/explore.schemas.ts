import { z } from "zod";

/** Cross-workspace feed list query. Cursor is an opaque base64url newest-cursor (createdAt,id). */
export const ExploreFeedQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).optional().default(20),
  cursor: z.string().optional(),
  tab: z.enum(["following", "pulse"]).optional().default("pulse"),
});

/**
 * Public-workspace directory query.
 * `sort=newest` powers the "just launched" strip; `sort=followers` powers the
 * editorial directory + featured spotlight. `q` searches name/slug; `offset`
 * drives "load more" pagination.
 */
export const ExploreWorkspacesQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(60).optional().default(30),
  offset: z.coerce.number().int().min(0).max(10000).optional().default(0),
  sort: z.enum(["active", "newest", "followers"]).optional().default("active"),
  q: z.string().trim().max(100).optional(),
});

export const ExploreFeedCursorSchema = z.object({
  v: z.literal(1),
  createdAt: z.string(),
  id: z.string().uuid(),
});
