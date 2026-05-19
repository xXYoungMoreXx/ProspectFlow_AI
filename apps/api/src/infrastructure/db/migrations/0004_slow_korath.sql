ALTER TABLE "leads" ADD COLUMN "cnpj" text;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "company_data" jsonb DEFAULT '{}'::jsonb;