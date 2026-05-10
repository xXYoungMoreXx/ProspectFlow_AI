-- Migration: 003_hitl_tiered.sql
-- Description: Adds hitl_level column and corresponding index to support tiered HITL approvals.

ALTER TABLE hitl_approvals 
ADD COLUMN IF NOT EXISTS hitl_level TEXT NOT NULL DEFAULT 'HITL-1';

-- Index to query pending approvals by level (e.g. timeout worker)
CREATE INDEX IF NOT EXISTS idx_hitl_level ON hitl_approvals(hitl_level, status);
