import { z } from "zod";

/** Cross-workspace feed list query. Cursor is an opaque base64url newest-cursor (createdAt,id). */
export const ExploreFeedQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).optional().default(20),
  cursor: z.string().optional(),
  tab: z.enum(["discover", "following"]).optional().default("discover"),
});

/** Public-workspace directory query. `sort=newest` powers the "new apps" strip. */
export const ExploreWorkspacesQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(60).optional().default(30),
  sort: z.enum(["active", "newest"]).optional().default("active"),
});

export const ExploreFeedCursorSchema = z.object({
  v: z.literal(1),
  createdAt: z.string(),
  id: z.string().uuid(),
});
