    # CONTEXT — Fase 1: Hunter + Closer

> Leia este arquivo no início de cada sessão de desenvolvimento da Fase 1.
> Versão: 2.0.0

---

## Estado Atual

```
Fase atual:    1 — Hunter + Closer (MVP v0)
Pré-requisito: Fase 0 concluída e todos os checks passando
Objetivo:      Lead prospectado → Negociação → Deal fechado
```

## O que JÁ EXISTE (não recriar)

```
✅ Monorepo Turborepo funcionando
✅ Docker Compose com postgres, redis, chromadb, n8n, ollama
✅ Drizzle schema com: operators, refresh_tokens
✅ Fastify API na porta 3001
✅ Auth completo: login/refresh/logout
✅ Middleware: auth, rateLimiter, requestId
✅ Logger Pino com redact
✅ Container DI (container.ts)
✅ Domain shared: Result, DomainEvent, AggregateRoot, errors
✅ Value Objects de ID: AgentId, LeadId, DealId, BriefingId, ProjectId, HITLApprovalId
✅ Env validation com Zod
✅ CI pipeline
```

## O que vamos criar nesta fase

```
Domain:
  ✅ Lead aggregate (TASK-101)
  ✅ Deal aggregate (TASK-102)
  ✅ Agent + SubAgent aggregates (TASK-103)
  ✅ HITLApproval aggregate (TASK-104)

Infrastructure:
  ✅ Drizzle repositories: Lead, Agent, Deal, HITL (TASK-105)
  ✅ Redis cache + BullMQ queue (TASK-106)
  ✅ GoogleMapsAdapter (TASK-107)
  ✅ MCPBrasilAdapter (TASK-108)
  ✅ WhatsApp, Telegram, Email adapters (TASK-111)

Application:
  ✅ QualifyLeadUseCase (TASK-109)
  ✅ HITL system completo (TASK-110)

Python (Agent Runtime):
  ✅ Base FastAPI + BaseSubAgent (TASK-112)
  ✅ Hunter Agent com 3 sub-agentes paralelos (TASK-113)
  ✅ Closer Agent com 4 sub-agentes (TASK-114)

HTTP Routes:
  ✅ /api/v1/leads, /api/v1/deals, /api/v1/agents (TASK-116)
  ✅ /api/v1/hitl (TASK-116)
  ✅ /api/v1/prospecting (TASK-116)

n8n:
  ✅ Workflows: Hunter diário, Closer loop, DealTracker cron (TASK-115)
```

## Decisões desta fase (não questionar)

- HITL é obrigatório antes de qualquer mensagem externa — sem exceção
- Mensageria via Evolution API (WhatsApp) + Telegram Bot API
- Google Maps Places API (New) como fonte primária de leads
- MCP Brasil para validação de CNPJ (self-hosted, gratuito)
- Cache de 24h para resultados do Maps (economizar quota)
- Cache de 7 dias para CNPJ (dados raramente mudam)
- Deduplicação: não prospectar mesmo Place ID em 30 dias
- CNPJ suspenso/inapto/baixado → lead bloqueado automaticamente

## Contratos que DEVEM ser respeitados

```typescript
// Todo lead qualificado DEVE emitir LeadQualified event
// Todo follow-up enviado DEVE emitir FollowUpSent event
// Toda mensagem externa DEVE ter HITLApproval.status === 'APPROVED'
// Score do lead DEVE seguir a fórmula exata do specs/03_hunter.spec.md
// Payload do HITL DEVE ter PII mascarado (email, telefone → ***REDACTED***)
```

## Integrações externas desta fase

```
Google Maps API:
  - Endpoint: https://places.googleapis.com/v1/places:searchText
  - Auth: X-Goog-Api-Key header
  - FieldMask: displayName, formattedAddress, nationalPhoneNumber, websiteUri, rating, userRatingCount
  - Cache: 24h por (categoria, região, data)
  - Rate limit: 2000/dia free (alertar quando < 200)

MCP Brasil:
  - URL: http://mcp-brasil:8000/mcp (interno Docker)
  - Tool: brasilapi_consultar_cnpj
  - Cache: 7 dias por CNPJ
  - Sem autenticação (66 APIs gratuitas)

Evolution API (WhatsApp):
  - URL: http://evolution-api:8082 (interno Docker)
  - Auth: apikey header
  - Delay: 1.5–4s entre mensagens (humanizado)
  - Limite: 50 msg/dia por número

Telegram:
  - Bot HITL: notificações + aprovação inline ao operador
  - Bot Sales: canal de vendas alternativo ao WhatsApp
  - Webhook URL: ${API_PUBLIC_URL}/webhooks/telegram/hitl (ou /sales)
```

## Como verificar que a Fase 1 está completa

```bash
# 1. Testes
npm run test:unit      # domain/ coverage >= 90%
npm run test:security  # TODOS passando (BLOQUEANTE)
npm run test:integration # repositórios com Testcontainers

# 2. Hunter funcional
curl -X POST http://localhost:3001/api/v1/prospecting/search-maps \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"categories":["restaurant"],"region":{"city":"Salvador","state":"BA","radiusKm":5}}'
# Retorna jobId e cria HITL após execução

# 3. HITL via Telegram
# Aprovar pelo botão do Telegram
# Verificar que lead foi criado no CRM

# 4. Closer envia mensagem após HITL aprovado
# Verificar no WhatsApp/Telegram do número de teste

# 5. DealTracker cron
# Aguardar 3 dias com deal NEGOTIATING sem contato
# Verificar que follow-up foi agendado automaticamente
```
