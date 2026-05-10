-- Migration: Add GOOGLE to llm_provider enum
-- Date: 2026-05-05
-- Reason: CompositeLLMRouter has GoogleAdapter but DB enum lacked GOOGLE value

ALTER TYPE llm_provider ADD VALUE IF NOT EXISTS 'GOOGLE' BEFORE 'GROQ';
