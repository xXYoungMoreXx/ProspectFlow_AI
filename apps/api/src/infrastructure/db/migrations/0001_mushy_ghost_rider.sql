ALTER TYPE "public"."llm_provider" ADD VALUE 'GOOGLE' BEFORE 'GROQ';--> statement-breakpoint
CREATE TABLE "pricing_config" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"operator_id" uuid NOT NULL,
	"service_type" "service_type" NOT NULL,
	"base_price_cents" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "pricing_config" ADD CONSTRAINT "pricing_config_operator_id_operators_id_fk" FOREIGN KEY ("operator_id") REFERENCES "public"."operators"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_pricing_config_operator_service" ON "pricing_config" USING btree ("operator_id","service_type");