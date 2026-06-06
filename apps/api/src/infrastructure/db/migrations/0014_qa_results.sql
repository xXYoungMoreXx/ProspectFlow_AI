-- QA agent result persistence — one row per check per project run.
-- checkType: 'LIGHTHOUSE' | 'CONTENT' | 'LINKS' | 'MOBILE'
-- status:    'PASS' | 'FAIL' | 'WARNING'

CREATE TABLE IF NOT EXISTS "qa_results" (
  "id"              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "organization_id" TEXT NOT NULL,
  "project_id"      UUID NOT NULL REFERENCES "projects"("id") ON DELETE CASCADE,
  "agent_id"        UUID NOT NULL REFERENCES "agents"("id"),
  "check_type"      TEXT NOT NULL,
  "status"          TEXT NOT NULL,
  "score"           INTEGER,
  "details"         JSONB,
  "created_at"      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "idx_qa_results_project" ON "qa_results"("project_id");
CREATE INDEX IF NOT EXISTS "idx_qa_results_org"     ON "qa_results"("organization_id");
