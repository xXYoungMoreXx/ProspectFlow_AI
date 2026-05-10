-- Migration: 005_prospect_optouts.sql
-- Description: Adds prospect_optouts table for anti-spam blocklist

CREATE TABLE IF NOT EXISTS prospect_optouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operator_id UUID NOT NULL REFERENCES operators(id),
  phone_hash TEXT,
  email_hash TEXT,
  opted_out_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT check_contact_info CHECK (phone_hash IS NOT NULL OR email_hash IS NOT NULL)
);

-- Index to quickly check if a prospect is blocked for a given operator
CREATE INDEX IF NOT EXISTS idx_optouts_operator_phone ON prospect_optouts(operator_id, phone_hash);
CREATE INDEX IF NOT EXISTS idx_optouts_operator_email ON prospect_optouts(operator_id, email_hash);
