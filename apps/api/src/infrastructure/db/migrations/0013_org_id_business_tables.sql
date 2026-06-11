-- Add organization_id to all business tables.
-- DEFAULT 'org_mvp' allows existing rows to survive the migration.
-- Uses DO $$ EXCEPTION WHEN duplicate_column pattern to suppress NOTICE
-- messages that drizzle-kit 0.31 treats as transaction-aborting errors.

DO $$ BEGIN ALTER TABLE "agents"          ADD COLUMN "organization_id" TEXT NOT NULL DEFAULT 'org_mvp'; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "sub_agents"      ADD COLUMN "organization_id" TEXT NOT NULL DEFAULT 'org_mvp'; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "leads"           ADD COLUMN "organization_id" TEXT NOT NULL DEFAULT 'org_mvp'; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "deals"           ADD COLUMN "organization_id" TEXT NOT NULL DEFAULT 'org_mvp'; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "projects"        ADD COLUMN "organization_id" TEXT NOT NULL DEFAULT 'org_mvp'; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "hitl_approvals"  ADD COLUMN "organization_id" TEXT NOT NULL DEFAULT 'org_mvp'; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "briefings"       ADD COLUMN "organization_id" TEXT NOT NULL DEFAULT 'org_mvp'; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "briefing_assets" ADD COLUMN "organization_id" TEXT NOT NULL DEFAULT 'org_mvp'; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "follow_ups"      ADD COLUMN "organization_id" TEXT NOT NULL DEFAULT 'org_mvp'; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "media_assets"    ADD COLUMN "organization_id" TEXT NOT NULL DEFAULT 'org_mvp'; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "token_usage"     ADD COLUMN "organization_id" TEXT NOT NULL DEFAULT 'org_mvp'; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
