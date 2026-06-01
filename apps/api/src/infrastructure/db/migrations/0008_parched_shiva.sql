CREATE TYPE "public"."briefing_asset_type" AS ENUM('logo', 'photo', 'document', 'other');--> statement-breakpoint
CREATE TYPE "public"."briefing_status" AS ENUM('IN_PROGRESS', 'COMPLETED', 'APPROVED');--> statement-breakpoint
CREATE TYPE "public"."execution_mode" AS ENUM('sequential', 'parallel');--> statement-breakpoint
CREATE TYPE "public"."follow_up_status" AS ENUM('SCHEDULED', 'SENT', 'FAILED', 'CANCELLED');--> statement-breakpoint
CREATE TABLE "briefing_assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"briefing_id" uuid NOT NULL,
	"asset_type" "briefing_asset_type" NOT NULL,
	"mime_type" text NOT NULL,
	"storage_ref" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"magic_bytes_validated" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "briefings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"deal_id" uuid NOT NULL,
	"operator_id" uuid NOT NULL,
	"agent_id" uuid,
	"status" "briefing_status" DEFAULT 'IN_PROGRESS' NOT NULL,
	"niche_template" text,
	"briefing_data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"interview_transcript_ref" text,
	"approved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "briefings_deal_id_unique" UNIQUE("deal_id")
);
--> statement-breakpoint
CREATE TABLE "follow_ups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"deal_id" uuid NOT NULL,
	"lead_id" uuid NOT NULL,
	"operator_id" uuid NOT NULL,
	"attempt" integer DEFAULT 1 NOT NULL,
	"scheduled_date" timestamp with time zone NOT NULL,
	"sent_at" timestamp with time zone,
	"channel" "message_channel" NOT NULL,
	"status" "follow_up_status" DEFAULT 'SCHEDULED' NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sub_agents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_id" uuid NOT NULL,
	"role" text NOT NULL,
	"llm_provider" "llm_provider" NOT NULL,
	"llm_model" text NOT NULL,
	"llm_temperature" numeric(3, 2) DEFAULT '0.70' NOT NULL,
	"llm_max_tokens" integer DEFAULT 4096 NOT NULL,
	"execution_mode" "execution_mode" DEFAULT 'sequential' NOT NULL,
	"parallel_group" integer,
	"max_retries" integer DEFAULT 3 NOT NULL,
	"timeout_seconds" integer DEFAULT 120 NOT NULL,
	"is_enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "briefing_assets" ADD CONSTRAINT "briefing_assets_briefing_id_briefings_id_fk" FOREIGN KEY ("briefing_id") REFERENCES "public"."briefings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "briefings" ADD CONSTRAINT "briefings_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "briefings" ADD CONSTRAINT "briefings_operator_id_operators_id_fk" FOREIGN KEY ("operator_id") REFERENCES "public"."operators"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "briefings" ADD CONSTRAINT "briefings_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "follow_ups" ADD CONSTRAINT "follow_ups_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "follow_ups" ADD CONSTRAINT "follow_ups_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "follow_ups" ADD CONSTRAINT "follow_ups_operator_id_operators_id_fk" FOREIGN KEY ("operator_id") REFERENCES "public"."operators"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sub_agents" ADD CONSTRAINT "sub_agents_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_briefing_assets_briefing" ON "briefing_assets" USING btree ("briefing_id");--> statement-breakpoint
CREATE INDEX "idx_briefings_deal" ON "briefings" USING btree ("deal_id");--> statement-breakpoint
CREATE INDEX "idx_follow_ups_deal" ON "follow_ups" USING btree ("deal_id");--> statement-breakpoint
CREATE INDEX "idx_follow_ups_scheduled" ON "follow_ups" USING btree ("scheduled_date","status");--> statement-breakpoint
CREATE INDEX "idx_sub_agents_agent" ON "sub_agents" USING btree ("agent_id");