CREATE TYPE "public"."post_type" AS ENUM('feedback', 'announcement');--> statement-breakpoint
ALTER TABLE "posts" ALTER COLUMN "category" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "type" "post_type" DEFAULT 'feedback' NOT NULL;--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "pinned_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "posts_workspace_pinned_idx" ON "posts" USING btree ("workspace_id","pinned_at" desc) WHERE pinned_at IS NOT NULL AND deleted_at IS NULL;