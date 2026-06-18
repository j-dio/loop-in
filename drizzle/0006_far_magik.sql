CREATE TYPE "public"."app_platform" AS ENUM('web', 'mobile', 'desktop', 'other');--> statement-breakpoint
CREATE TYPE "public"."link_kind" AS ENUM('github', 'appstore', 'playstore', 'x', 'other');--> statement-breakpoint
CREATE TABLE "app_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"kind" "link_kind" NOT NULL,
	"url" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app_screenshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"url" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "workspaces" ADD COLUMN "tagline" varchar(140);--> statement-breakpoint
ALTER TABLE "workspaces" ADD COLUMN "description" text;--> statement-breakpoint
ALTER TABLE "workspaces" ADD COLUMN "platform" "app_platform";--> statement-breakpoint
ALTER TABLE "workspaces" ADD COLUMN "category" varchar(50);--> statement-breakpoint
ALTER TABLE "workspaces" ADD COLUMN "website_url" text;--> statement-breakpoint
ALTER TABLE "app_links" ADD CONSTRAINT "app_links_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app_screenshots" ADD CONSTRAINT "app_screenshots_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "app_links_workspace_id_idx" ON "app_links" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "app_screenshots_workspace_id_idx" ON "app_screenshots" USING btree ("workspace_id");