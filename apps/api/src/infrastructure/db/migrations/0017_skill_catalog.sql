CREATE TABLE IF NOT EXISTS skill_catalog (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name            text        NOT NULL,
  slug            text        NOT NULL UNIQUE,
  description     text        NOT NULL,
  skill_type      text        NOT NULL,
  config_template jsonb       NOT NULL DEFAULT '{}',
  service_types   text[]      NOT NULL DEFAULT '{}',
  persona_hints   text[]      NOT NULL DEFAULT '{}',
  is_builtin      boolean     NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_skill_catalog_service_types
  ON skill_catalog USING GIN (service_types);
CREATE INDEX IF NOT EXISTS idx_skill_catalog_persona_hints
  ON skill_catalog USING GIN (persona_hints);
