-- Migration: 004_contract_acceptances.sql
-- Description: Adds contract_acceptances table for clickwrap compliance

CREATE TABLE IF NOT EXISTS contract_acceptances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES deals(id),
  contract_hash TEXT NOT NULL,
  accepted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ip_hash TEXT NOT NULL,
  user_agent_hash TEXT NOT NULL,
  session_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for querying acceptances by deal
CREATE INDEX IF NOT EXISTS idx_contract_acceptances_deal ON contract_acceptances(deal_id);

-- Append-only enforcement (No UPDATE/DELETE via permissions or triggers in production)
-- In a real RLS environment, we would do:
-- ALTER TABLE contract_acceptances ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "Append Only" ON contract_acceptances FOR INSERT WITH CHECK (true);
