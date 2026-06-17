CREATE INDEX IF NOT EXISTS "posts_feed_newest_idx" ON "posts" USING btree ("workspace_id","created_at" desc,"id" desc) WHERE moderation_status = 'approved' AND deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "posts_feed_top_idx" ON "posts" USING btree ("workspace_id","upvote_count" desc,"created_at" desc,"id" desc) WHERE moderation_status = 'approved' AND deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "posts_public_feed_idx" ON "posts" USING btree ("created_at" desc,"id" desc) WHERE moderation_status = 'approved' AND deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "workspaces_visibility_idx" ON "workspaces" USING btree ("visibility");--> statement-breakpoint
-- Substring search (ILIKE '%q%') uses trigram GIN indexes instead of a sequential scan.
-- pg_trgm is available on Railway-managed Postgres. These indexes are not tracked by the Drizzle
-- snapshot (extension + opclass), so they are created here directly and left unmanaged.
CREATE EXTENSION IF NOT EXISTS pg_trgm;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "posts_title_trgm_idx" ON "posts" USING gin ("title" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "posts_description_trgm_idx" ON "posts" USING gin ("description" gin_trgm_ops);
