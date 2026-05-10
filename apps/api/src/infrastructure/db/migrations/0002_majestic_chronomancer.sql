CREATE TABLE "contract_acceptances" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"deal_id" uuid NOT NULL,
	"contract_hash" text NOT NULL,
	"accepted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ip_hash" text NOT NULL,
	"user_agent_hash" text NOT NULL,
	"session_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "prospect_optouts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"operator_id" uuid NOT NULL,
	"phone_hash" text,
	"email_hash" text,
	"opted_out_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "hitl_approvals" ADD COLUMN "hitl_level" text DEFAULT 'HITL-1' NOT NULL;--> statement-breakpoint
ALTER TABLE "contract_acceptances" ADD CONSTRAINT "contract_acceptances_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prospect_optouts" ADD CONSTRAINT "prospect_optouts_operator_id_operators_id_fk" FOREIGN KEY ("operator_id") REFERENCES "public"."operators"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_contract_acceptances_deal" ON "contract_acceptances" USING btree ("deal_id");--> statement-breakpoint
CREATE INDEX "idx_optouts_operator_phone" ON "prospect_optouts" USING btree ("operator_id","phone_hash");--> statement-breakpoint
CREATE INDEX "idx_optouts_operator_email" ON "prospect_optouts" USING btree ("operator_id","email_hash");--> statement-breakpoint
CREATE INDEX "idx_hitl_level_status" ON "hitl_approvals" USING btree ("hitl_level","status");