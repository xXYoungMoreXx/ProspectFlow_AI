CREATE TYPE "public"."hitl_action_type" AS ENUM('APPROVE_LEAD_LIST', 'SEND_EXTERNAL_MESSAGE', 'SEND_PROPOSAL', 'APPROVE_MOCKUP', 'APPROVE_STAGING', 'DEPLOY_PRODUCTION', 'APPROVE_BRIEFING', 'SEND_DELIVERY');--> statement-breakpoint
CREATE TABLE "qa_results" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"project_id" uuid NOT NULL,
	"agent_id" uuid NOT NULL,
	"check_type" text NOT NULL,
	"status" text NOT NULL,
	"score" integer,
	"details" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "hitl_approvals" ALTER COLUMN "action_type" SET DATA TYPE "public"."hitl_action_type" USING "action_type"::"public"."hitl_action_type";--> statement-breakpoint
ALTER TABLE "qa_results" ADD CONSTRAINT "qa_results_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "qa_results" ADD CONSTRAINT "qa_results_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_qa_results_project" ON "qa_results" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "idx_qa_results_org" ON "qa_results" USING btree ("organization_id");