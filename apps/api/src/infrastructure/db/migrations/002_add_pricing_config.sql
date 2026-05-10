-- Migration: 002_add_pricing_config.sql
-- Description: Creates the pricing_config table to store dynamic pricing rules per operator.

CREATE TABLE IF NOT EXISTS pricing_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operator_id UUID NOT NULL REFERENCES operators(id) ON DELETE CASCADE,
  service_type service_type NOT NULL,
  base_price_cents BIGINT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for fast lookup by operator and service type
CREATE UNIQUE INDEX IF NOT EXISTS idx_pricing_config_operator_service 
ON pricing_config(operator_id, service_type);
