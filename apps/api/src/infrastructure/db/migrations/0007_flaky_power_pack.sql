ALTER TYPE "public"."lead_source" ADD VALUE 'GOOGLE_MAPS';--> statement-breakpoint
ALTER TYPE "public"."lead_source" ADD VALUE 'APOLLO';--> statement-breakpoint
ALTER TYPE "public"."lead_status" ADD VALUE 'PROSPECTED' BEFORE 'CONTACTED';--> statement-breakpoint
ALTER TYPE "public"."lead_status" ADD VALUE 'APPROVED' BEFORE 'CONTACTED';--> statement-breakpoint
ALTER TYPE "public"."lead_status" ADD VALUE 'NEGOTIATING' BEFORE 'CONVERTED';