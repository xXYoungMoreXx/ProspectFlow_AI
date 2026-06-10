CREATE TABLE IF NOT EXISTS workflow_definitions (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id    uuid        NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  definition  jsonb       NOT NULL DEFAULT '{}',
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_workflow_agent
  ON workflow_definitions(agent_id);

ALTER TABLE mcp_servers
  ADD COLUMN IF NOT EXISTS allowed_sub_agent_ids uuid[] NOT NULL DEFAULT '{}';
