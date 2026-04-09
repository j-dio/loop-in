CREATE TABLE "pending_invites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"email" varchar(255) NOT NULL,
	"role" varchar(20) DEFAULT 'member' NOT NULL,
	"invited_by" uuid NOT NULL,
	"token" varchar(255) NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "pending_invites" ADD CONSTRAINT "pending_invites_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pending_invites" ADD CONSTRAINT "pending_invites_invited_by_users_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "pending_invites_workspace_id_email_unique" ON "pending_invites" USING btree ("workspace_id","email");--> statement-breakpoint
CREATE UNIQUE INDEX "pending_invites_token_unique" ON "pending_invites" USING btree ("token");--> statement-breakpoint
CREATE INDEX "pending_invites_workspace_id_idx" ON "pending_invites" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "pending_invites_email_idx" ON "pending_invites" USING btree ("email");