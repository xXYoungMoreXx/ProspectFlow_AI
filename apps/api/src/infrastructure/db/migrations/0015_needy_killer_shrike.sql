-- qa_results table already created in 0014_qa_results.sql (with IF NOT EXISTS).
-- This migration only handles the hitl_action_type enum and column type change.
CREATE TYPE "public"."hitl_action_type" AS ENUM('APPROVE_LEAD_LIST', 'SEND_EXTERNAL_MESSAGE', 'SEND_PROPOSAL', 'APPROVE_MOCKUP', 'APPROVE_STAGING', 'DEPLOY_PRODUCTION', 'APPROVE_BRIEFING', 'SEND_DELIVERY');--> statement-breakpoint
ALTER TABLE "hitl_approvals" ALTER COLUMN "action_type" SET DATA TYPE "public"."hitl_action_type" USING "action_type"::"public"."hitl_action_type";