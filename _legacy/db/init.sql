-- ProspectFlow AI — Schema inicial
-- Executado automaticamente na primeira inicialização do container PostgreSQL

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Índices extras para performance de consultas comuns
-- (As tabelas são criadas pelo SQLAlchemy/Alembic, mas índices extras aqui)

-- Após as tabelas serem criadas pelo Alembic, esses índices melhoram as queries:
-- CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_leads_phone ON leads(phone);
-- CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_leads_status_niche ON leads(status, niche);
-- CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_messages_lead_direction ON messages(lead_id, direction);
