CREATE TABLE "members" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"user_id" text NOT NULL,
	"role" text DEFAULT 'owner' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "organizations_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "agents" ADD COLUMN "organization_id" text DEFAULT 'org_mvp' NOT NULL;--> statement-breakpoint
ALTER TABLE "briefing_assets" ADD COLUMN "organization_id" text DEFAULT 'org_mvp' NOT NULL;--> statement-breakpoint
ALTER TABLE "briefings" ADD COLUMN "organization_id" text DEFAULT 'org_mvp' NOT NULL;--> statement-breakpoint
ALTER TABLE "deals" ADD COLUMN "organization_id" text DEFAULT 'org_mvp' NOT NULL;--> statement-breakpoint
ALTER TABLE "follow_ups" ADD COLUMN "organization_id" text DEFAULT 'org_mvp' NOT NULL;--> statement-breakpoint
ALTER TABLE "hitl_approvals" ADD COLUMN "organization_id" text DEFAULT 'org_mvp' NOT NULL;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "organization_id" text DEFAULT 'org_mvp' NOT NULL;--> statement-breakpoint
ALTER TABLE "media_assets" ADD COLUMN "organization_id" text DEFAULT 'org_mvp' NOT NULL;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "organization_id" text DEFAULT 'org_mvp' NOT NULL;--> statement-breakpoint
ALTER TABLE "sub_agents" ADD COLUMN "organization_id" text DEFAULT 'org_mvp' NOT NULL;--> statement-breakpoint
ALTER TABLE "token_usage" ADD COLUMN "organization_id" text DEFAULT 'org_mvp' NOT NULL;--> statement-breakpoint
ALTER TABLE "members" ADD CONSTRAINT "members_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "members_org_user_uidx" ON "members" USING btree ("organization_id","user_id");