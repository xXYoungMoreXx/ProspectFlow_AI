-- Add organization_id to all business tables.
-- DEFAULT 'org_mvp' allows existing rows to survive the migration.

ALTER TABLE "agents"          ADD COLUMN IF NOT EXISTS "organization_id" TEXT NOT NULL DEFAULT 'org_mvp';
ALTER TABLE "sub_agents"      ADD COLUMN IF NOT EXISTS "organization_id" TEXT NOT NULL DEFAULT 'org_mvp';
ALTER TABLE "leads"           ADD COLUMN IF NOT EXISTS "organization_id" TEXT NOT NULL DEFAULT 'org_mvp';
ALTER TABLE "deals"           ADD COLUMN IF NOT EXISTS "organization_id" TEXT NOT NULL DEFAULT 'org_mvp';
ALTER TABLE "projects"        ADD COLUMN IF NOT EXISTS "organization_id" TEXT NOT NULL DEFAULT 'org_mvp';
ALTER TABLE "hitl_approvals"  ADD COLUMN IF NOT EXISTS "organization_id" TEXT NOT NULL DEFAULT 'org_mvp';
ALTER TABLE "briefings"       ADD COLUMN IF NOT EXISTS "organization_id" TEXT NOT NULL DEFAULT 'org_mvp';
ALTER TABLE "briefing_assets" ADD COLUMN IF NOT EXISTS "organization_id" TEXT NOT NULL DEFAULT 'org_mvp';
ALTER TABLE "follow_ups"      ADD COLUMN IF NOT EXISTS "organization_id" TEXT NOT NULL DEFAULT 'org_mvp';
ALTER TABLE "media_assets"    ADD COLUMN IF NOT EXISTS "organization_id" TEXT NOT NULL DEFAULT 'org_mvp';
ALTER TABLE "token_usage"     ADD COLUMN IF NOT EXISTS "organization_id" TEXT NOT NULL DEFAULT 'org_mvp';
