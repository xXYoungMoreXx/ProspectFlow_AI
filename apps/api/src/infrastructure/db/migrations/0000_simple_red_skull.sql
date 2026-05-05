CREATE TYPE "public"."agent_persona" AS ENUM('HUNTER', 'CLOSER', 'BUILDER', 'QA');--> statement-breakpoint
CREATE TYPE "public"."agent_status" AS ENUM('ACTIVE', 'INACTIVE', 'PAUSED');--> statement-breakpoint
CREATE TYPE "public"."deal_status" AS ENUM('PROPOSED', 'NEGOTIATING', 'CLOSED', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."hitl_status" AS ENUM('PENDING', 'APPROVED', 'REJECTED', 'EXPIRED', 'EDITED_APPROVED');--> statement-breakpoint
CREATE TYPE "public"."lead_source" AS ENUM('MANUAL', 'SCRAPED', 'REFERRAL');--> statement-breakpoint
CREATE TYPE "public"."lead_status" AS ENUM('NEW', 'CONTACTED', 'QUALIFIED', 'CONVERTED', 'LOST');--> statement-breakpoint
CREATE TYPE "public"."llm_provider" AS ENUM('OLLAMA', 'OPENAI', 'ANTHROPIC', 'GROQ', 'CUSTOM');--> statement-breakpoint
CREATE TYPE "public"."message_channel" AS ENUM('WHATSAPP', 'EMAIL', 'INTERNAL');--> statement-breakpoint
CREATE TYPE "public"."message_direction" AS ENUM('INBOUND', 'OUTBOUND');--> statement-breakpoint
CREATE TYPE "public"."project_status" AS ENUM('PLANNING', 'IN_PROGRESS', 'REVIEW', 'DELIVERED', 'REVISION', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."service_type" AS ENUM('WEBSITE', 'TRAFFIC', 'SOCIAL_MEDIA', 'OTHER');--> statement-breakpoint
CREATE TABLE "agent_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_id" uuid NOT NULL,
	"name" text NOT NULL,
	"condition" text NOT NULL,
	"action" text NOT NULL,
	"priority" integer DEFAULT 100 NOT NULL,
	"is_enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agent_skills" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_id" uuid NOT NULL,
	"name" text NOT NULL,
	"skill_type" text NOT NULL,
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"is_enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"operator_id" uuid NOT NULL,
	"name" text NOT NULL,
	"persona" "agent_persona" NOT NULL,
	"status" "agent_status" DEFAULT 'INACTIVE' NOT NULL,
	"llm_provider" "llm_provider" NOT NULL,
	"llm_model" text NOT NULL,
	"llm_base_url" text,
	"llm_api_key_ref" text,
	"llm_temperature" numeric(3, 2) DEFAULT '0.70' NOT NULL,
	"llm_max_tokens" integer DEFAULT 4096 NOT NULL,
	"llm_system_prompt" text,
	"token_budget_total" bigint DEFAULT 1000000 NOT NULL,
	"token_budget_remaining" bigint DEFAULT 1000000 NOT NULL,
	"rag_enabled" boolean DEFAULT false NOT NULL,
	"rag_collection" text,
	"rag_top_k" integer DEFAULT 5,
	"rag_threshold" numeric(3, 2) DEFAULT '0.70',
	"hitl_timeout_minutes" integer DEFAULT 60 NOT NULL,
	"hitl_notify_channel" text DEFAULT 'email' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" text PRIMARY KEY NOT NULL,
	"timestamp" timestamp with time zone DEFAULT now() NOT NULL,
	"actor" text NOT NULL,
	"actor_id" text NOT NULL,
	"action" text NOT NULL,
	"resource_type" text NOT NULL,
	"resource_id" text NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"ip_address" "inet",
	"correlation_id" uuid NOT NULL,
	"causation_id" uuid
);
--> statement-breakpoint
CREATE TABLE "deals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lead_id" uuid NOT NULL,
	"operator_id" uuid NOT NULL,
	"agent_id" uuid,
	"service_type" "service_type" NOT NULL,
	"status" "deal_status" DEFAULT 'PROPOSED' NOT NULL,
	"briefing" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"proposal_text" text,
	"base_price_cents" bigint DEFAULT 0 NOT NULL,
	"addons" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"discount_pct" numeric(5, 2) DEFAULT '0' NOT NULL,
	"currency" text DEFAULT 'BRL' NOT NULL,
	"proposal_sent_at" timestamp with time zone,
	"closed_at" timestamp with time zone,
	"closed_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hitl_approvals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"operator_id" uuid NOT NULL,
	"agent_id" uuid NOT NULL,
	"action_type" text NOT NULL,
	"context_type" text NOT NULL,
	"context_id" uuid NOT NULL,
	"payload_preview" jsonb NOT NULL,
	"payload_full_ref" text,
	"status" "hitl_status" DEFAULT 'PENDING' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"decided_at" timestamp with time zone,
	"operator_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "leads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"operator_id" uuid NOT NULL,
	"assigned_agent_id" uuid,
	"contact_name" text NOT NULL,
	"contact_email" text,
	"contact_phone" text,
	"contact_company" text,
	"contact_website" text,
	"source" "lead_source" DEFAULT 'MANUAL' NOT NULL,
	"qualification_score" integer,
	"status" "lead_status" DEFAULT 'NEW' NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mcp_servers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_id" uuid NOT NULL,
	"name" text NOT NULL,
	"url" text NOT NULL,
	"auth_ref" text,
	"is_enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lead_id" uuid NOT NULL,
	"agent_id" uuid,
	"direction" "message_direction" NOT NULL,
	"channel" "message_channel" NOT NULL,
	"content" text NOT NULL,
	"content_type" text DEFAULT 'text/plain' NOT NULL,
	"external_id" text,
	"sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "operators" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"name" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "operators_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"deal_id" uuid NOT NULL,
	"operator_id" uuid NOT NULL,
	"assigned_agent_id" uuid,
	"status" "project_status" DEFAULT 'PLANNING' NOT NULL,
	"template_id" text,
	"briefing" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"deliverable_url" text,
	"deliverable_meta" jsonb DEFAULT '{}'::jsonb,
	"lighthouse_perf" integer,
	"lighthouse_a11y" integer,
	"lighthouse_seo" integer,
	"lighthouse_bp" integer,
	"revision_count" integer DEFAULT 0 NOT NULL,
	"revision_notes" text,
	"delivered_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "refresh_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"operator_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "refresh_tokens_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
ALTER TABLE "agent_rules" ADD CONSTRAINT "agent_rules_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_skills" ADD CONSTRAINT "agent_skills_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agents" ADD CONSTRAINT "agents_operator_id_operators_id_fk" FOREIGN KEY ("operator_id") REFERENCES "public"."operators"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deals" ADD CONSTRAINT "deals_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deals" ADD CONSTRAINT "deals_operator_id_operators_id_fk" FOREIGN KEY ("operator_id") REFERENCES "public"."operators"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deals" ADD CONSTRAINT "deals_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hitl_approvals" ADD CONSTRAINT "hitl_approvals_operator_id_operators_id_fk" FOREIGN KEY ("operator_id") REFERENCES "public"."operators"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hitl_approvals" ADD CONSTRAINT "hitl_approvals_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_operator_id_operators_id_fk" FOREIGN KEY ("operator_id") REFERENCES "public"."operators"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_assigned_agent_id_agents_id_fk" FOREIGN KEY ("assigned_agent_id") REFERENCES "public"."agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mcp_servers" ADD CONSTRAINT "mcp_servers_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_operator_id_operators_id_fk" FOREIGN KEY ("operator_id") REFERENCES "public"."operators"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_assigned_agent_id_agents_id_fk" FOREIGN KEY ("assigned_agent_id") REFERENCES "public"."agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_operator_id_operators_id_fk" FOREIGN KEY ("operator_id") REFERENCES "public"."operators"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_audit_resource" ON "audit_log" USING btree ("resource_type","resource_id");--> statement-breakpoint
CREATE INDEX "idx_audit_correlation" ON "audit_log" USING btree ("correlation_id");--> statement-breakpoint
CREATE INDEX "idx_deals_lead" ON "deals" USING btree ("lead_id");--> statement-breakpoint
CREATE INDEX "idx_deals_status" ON "deals" USING btree ("status","operator_id");--> statement-breakpoint
CREATE INDEX "idx_hitl_pending" ON "hitl_approvals" USING btree ("operator_id","status");--> statement-breakpoint
CREATE INDEX "idx_leads_status" ON "leads" USING btree ("status","operator_id");--> statement-breakpoint
CREATE INDEX "idx_leads_agent" ON "leads" USING btree ("assigned_agent_id");--> statement-breakpoint
CREATE INDEX "idx_messages_lead" ON "messages" USING btree ("lead_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_projects_status" ON "projects" USING btree ("status","operator_id");