# Task: AgentePro — Evolução Contínua (Arco 2)

## Status: IN_PROGRESS

> **Arco 1 CONCLUÍDO** — Fases 0–8 (Refatoração Arquitetural ProspectFlow → AgentePro) finalizadas.
> Este documento agora cobre o **Arco 2**: alinhamento documental + features de negócio derivadas dos ADRs de 2026-05-09.

## Contexto

O projeto existe como um monolito Python (FastAPI + SQLAlchemy + Redis Streams) com módulos flat (`modules/lead_hunter`, `modules/conv_agent`, etc.) que funcionam como um PoC.

O PRD (`docs/PRD_AgentePro.md`) define uma arquitetura radicalmente diferente:
- **Monorepo Turborepo** com 3 apps + 2 packages
- **API**: Node.js 22 + Fastify 5 + Drizzle ORM + Zod + BullMQ (TypeScript)
- **Web**: Next.js 15 App Router + shadcn/ui + Tailwind CSS 4 + Zustand
- **Agent Runtime**: Python 3.12 + CrewAI + LiteLLM + ChromaDB
- **Padrão**: Hexagonal Architecture + CQRS + DDD + Event-Driven
- **Segurança**: JWT RS256 + Argon2id + RLS + HITL obrigatório

A lógica de negócio Python existente (LeadHunter, ConvAgent, SiteBuilder, MailAgent, IntegLayer, SecurityGuard) será migrada para o `agent-runtime` CrewAI como skills/tools. O esqueleto Node.js substituirá completamente a API FastAPI.

**Restrição anterior revogada**: A restrição de `docs/` protegia a documentação durante a migração de código. Com as Fases 0–8 concluídas, a **Fase 9** tem como objetivo ESPECÍFICO alinhar os `docs/`. Modificações em `docs/` são PERMITIDAS e NECESSÁRIAS no Arco 2.

---

## Decisões Feitas

- [x] **D1**: Usar Turborepo como gerenciador de monorepo (PRD §17)
- [x] **D2**: API em Fastify 5 (ADR-002)
- [x] **D3**: Drizzle ORM para TypeScript, schema PRD §13
- [x] **D4**: BullMQ para filas assíncronas (ADR-003 CQRS)
- [x] **D5**: CrewAI como orquestrador de agentes (ADR-001)
- [x] **D6**: HITL via tabela `hitl_approvals` + endpoint REST (ADR-004)
- [x] **D7**: Prompts versionados em `docs/agents/prompts/` (ADR-005)
- [x] **D8**: Docker Compose para infra local (PRD §16-Infra)
- [x] **D9**: Manter código Python legado em `_legacy/` para referência durante migração

---

## Plano de Implementação

### ═══════════════════════════════════════════════
### FASE 0 — FUNDAÇÃO E BOOTSTRAP
### ═══════════════════════════════════════════════

#### 0.1 — Reorganização do repositório
- [x] Mover todo o código Python existente para `_legacy/` (preservação)
- [x] Remover diretório fantasma `{modules` (artifact de comando mal-formado)
- [x] Remover diretório vazio `prospectflow/`
- [x] Atualizar `.gitignore` para monorepo (node_modules, .next, dist, .turbo, .env*)

#### 0.2 — Inicializar Turborepo monorepo
- [x] Criar `package.json` raiz com workspaces (`apps/*`, `packages/*`)
- [x] Criar `turbo.json` com pipeline (build, dev, lint, test, typecheck)
- [x] Criar `tsconfig.base.json` com configuração estrita compartilhada

#### 0.3 — Bootstrap `packages/shared-types`
- [x] Criar `packages/shared-types/package.json`
- [x] Criar `packages/shared-types/tsconfig.json`
- [x] Criar enums do domínio (AgentPersona, AgentStatus, LeadStatus, DealStatus, ProjectStatus, HITLStatus, LLMProvider, etc.)
- [x] Criar tipos de Domain Events (LeadCreated, LeadQualified, DealClosed, ProjectDelivered, etc.)
- [x] Criar tipos do contrato API (response envelopes: `{ data, meta, errors }`)

#### 0.4 — Bootstrap `apps/api` (Fastify)
- [x] Criar `apps/api/package.json` com deps: fastify, drizzle-orm, pg, zod, bullmq, jose, argon2, pino
- [x] Criar `apps/api/tsconfig.json` herdando de base
- [x] Criar entry point `apps/api/src/server.ts` com lifespan hooks
- [x] Criar container DI (`apps/api/src/container.ts`)

#### 0.5 — Bootstrap `apps/web` (Next.js 15)
- [x] Inicializar Next.js 15 com `npx create-next-app@latest ./` no diretório `apps/web` *(Fase 7)*
- [x] Configurar Tailwind CSS 4 + shadcn/ui *(Fase 7)*
- [x] Criar layout raiz com sidebar de dashboard placeholder *(Fase 7)*

#### 0.6 — Bootstrap `apps/agent-runtime` (Python/CrewAI)
- [x] Criar `apps/agent-runtime/pyproject.toml` com deps: crewai, litellm, chromadb, redis, pydantic
- [x] Criar estrutura de diretórios: `src/agents/`, `src/skills/`, `src/rag/`, `src/workflows/`
- [x] Migrar `_legacy/modules/lead_hunter/hunter.py` → `src/skills/web_search.py`
- [x] Migrar `_legacy/modules/conv_agent/security.py` → `src/skills/security_guard.py`
- [x] Migrar `_legacy/modules/site_builder/builder.py` → `src/skills/site_generator.py`

#### 0.7 — Docker Compose para infra local
- [x] Criar `infra/docker-compose.yml` com:
  - PostgreSQL 16 (porta 5432)
  - Redis 7 (porta 6379)
  - ChromaDB (porta 8000)
  - n8n (porta 5678)
  - Grafana (porta 3333)
  - Jaeger (porta 16686)
- [x] Criar `infra/scripts/setup.sh` para inicialização
- [x] Criar `.env.example` atualizado para monorepo

---

### ═══════════════════════════════════════════════
### FASE 1 — DOMAIN LAYER + DATABASE
### ═══════════════════════════════════════════════

#### 1.1 — Domain Layer Core (`apps/api/src/domain/shared/`)
- [x] Criar `DomainEvent.ts` (eventId, eventType, aggregateId, occurredAt, correlationId, causationId, payload)
- [x] Criar `AggregateRoot.ts` (base class com domain events collection)
- [x] Criar `Result.ts` (Either monad: `Result<T, E>` para erros sem exceções)
- [x] Criar `ValueObject.ts` (base class com equals)

#### 1.2 — Agent Bounded Context (`apps/api/src/domain/agent/`)
- [x] `Agent.ts` — Aggregate root com id, persona, name, llmConfig, skills, rules, status
- [x] `LLMConfiguration` — VO inline no Agent
- [x] `AgentRepository.ts` — Port (interface)
- [x] Domain events emitidos inline (agent.activated, agent.paused, agent.task_completed)

#### 1.3 — Lead Bounded Context (`apps/api/src/domain/lead/`)
- [x] `Lead.ts` — Aggregate root com lifecycle completo
- [x] `ContactInfo` — VO inline
- [x] `LeadRepository.ts` — Port
- [x] Domain events inline (lead.created, lead.qualified, lead.converted, lead.lost)

#### 1.4 — Deal Bounded Context (`apps/api/src/domain/deal/`)
- [x] `Deal.ts` — Aggregate root com pricing (base + addons - discount)
- [x] `DealRepository.ts` — Port
- [x] Domain events inline (deal.proposed, deal.closed, deal.cancelled)

#### 1.5 — Project Bounded Context (`apps/api/src/domain/project/`)
- [x] `Project.ts` — Aggregate root com Lighthouse scores, revision limit
- [x] `ProjectRepository.ts` — Port
- [x] Domain events inline (project.started, project.delivered, project.revision_requested)

#### 1.6 — HITL Bounded Context (`apps/api/src/domain/hitl/`)
- [x] `HITLApproval.ts` — Aggregate root com approve/reject/edit-and-approve/expire
- [x] `HITLApprovalRepository.ts` — Port (com findExpired para worker)
- [x] Domain events inline (hitl.approval_requested, hitl.approval_decided)

#### 1.7 — Drizzle Schema (`apps/api/src/infrastructure/db/schema.ts`)
- [x] Espelhar schema SQL do PRD §13 fielmente:
  - `operators`, `refresh_tokens`
  - `agents`, `agent_skills`, `agent_rules`, `mcp_servers`
  - `leads`, `messages`
  - `deals`
  - `projects`
  - `hitl_approvals`
  - `audit_log` (append-only com check via trigger)
- [x] Configurar Drizzle Kit para migrations
- [x] Criar migration inicial

#### 1.8 — Drizzle Repositories (Infrastructure adapters)
- [x] `apps/api/src/infrastructure/db/repositories/DrizzleAgentRepository.ts`
- [x] `apps/api/src/infrastructure/db/repositories/DrizzleLeadRepository.ts`
- [x] `apps/api/src/infrastructure/db/repositories/DrizzleDealRepository.ts`
- [x] `apps/api/src/infrastructure/db/repositories/DrizzleProjectRepository.ts`
- [x] `apps/api/src/infrastructure/db/repositories/DrizzleHITLRepository.ts`
- [x] `apps/api/src/infrastructure/db/repositories/DrizzleAuditLogRepository.ts`

---

### ═══════════════════════════════════════════════
### FASE 2 — APPLICATION LAYER (USE CASES)
### ═══════════════════════════════════════════════

#### 2.1 — IAM Use Cases (`apps/api/src/application/auth/`)
- [x] `LoginHandler` (Argon2id verify, JWT RS256 sign, anti-enumeration)
- [x] `RefreshTokenHandler` (rotação de refresh token)
- [x] `LogoutHandler` (revogar refresh tokens)
- [x] Schema Zod: `LoginSchema`, `RefreshSchema`

#### 2.2 — Agent Use Cases (`apps/api/src/application/agent/`)
- [x] `CreateAgentHandler`
- [x] `UpdateAgentHandler` (PATCH parcial)
- [x] `ActivateAgentHandler`
- [x] `PauseAgentHandler`
- [x] `GetAgentsHandler` (cursor pagination)
- [x] `GetAgentByIdHandler`
- [x] CRUD de Skills, Rules via sub-commands

#### 2.3 — Lead Use Cases (`apps/api/src/application/lead/`)
- [x] `CreateLeadHandler`
- [x] `UpdateLeadStatusHandler`
- [x] `GetLeadsHandler` (cursor pagination, filtros)
- [x] `GetLeadByIdHandler`

#### 2.4 — Deal Use Cases (`apps/api/src/application/deal/`)
- [x] `GetDealsHandler`
- [x] `GetDealByIdHandler`
- [x] `CancelDealHandler`
- [x] `GenerateQuoteHandler` (IA para Orçamento)

#### 2.5 — Project Use Cases (`apps/api/src/application/project/`)
- [x] `GetProjectsHandler`
- [x] `GetProjectByIdHandler`
- [x] `RequestRevisionHandler`

#### 2.6 — HITL Use Cases (`apps/api/src/application/hitl/`)
- [x] `GetPendingApprovalsHandler`
- [x] `ApproveHITLHandler`
- [x] `RejectHITLHandler`
- [x] `EditAndApproveHITLHandler`

---

### ═══════════════════════════════════════════════
### FASE 3 — HTTP LAYER (ROUTES + MIDDLEWARE)
### ═══════════════════════════════════════════════

#### 3.1 — Middleware Stack (`apps/api/src/http/middleware/`)
- [x] `auth.middleware.ts` — JWT RS256 verification com `jose`
- [x] `rateLimiter` — via @fastify/rate-limit global + per-route
- [x] `bodySize` — via Fastify `bodyLimit` (1MB Zero Trust)
- [x] `requestId.middleware.ts` — ULID correlation ID
- [x] `errorHandler.ts` — centralizado

#### 3.2 — Zod Schemas (`apps/api/src/http/schemas/`)
- [x] `auth.schemas.ts` — LoginSchema, RefreshSchema
- [x] `agents.schemas.ts` — CreateAgentSchema, UpdateAgentSchema, SkillSchema, RuleSchema, ListAgentsQuery
- [x] `leads.schemas.ts` — CreateLeadSchema, UpdateStatusSchema, ListLeadsQuery
- [x] `deals.schemas.ts` — CancelDealSchema, ListDealsQuery
- [x] `hitl.schemas.ts` — ApproveSchema, RejectSchema, EditApproveSchema

#### 3.3 — Routes wired (`apps/api/src/http/routes/`)
- [x] `auth.routes.ts` — POST /login, /refresh, DELETE /logout
- [x] `agents.routes.ts` — CRUD + /activate, /pause
- [x] `leads.routes.ts` — GET list, GET :id, POST create, PATCH :id/status
- [x] `deals.routes.ts` — GET list, GET :id, POST :id/cancel
- [x] `projects.routes.ts` — GET list, GET :id, POST :id/request-revision
- [x] `hitl.routes.ts` — GET /pending, POST :id/approve, :id/reject, PATCH :id/edit-and-approve
- [x] `system.routes.ts` — GET /health, GET /metrics

---

### ═══════════════════════════════════════════════
### FASE 4 — INFRAESTRUTURA (ADAPTERS)
### ═══════════════════════════════════════════════

#### 4.1 — Queue Adapter (`apps/api/src/infrastructure/queue/`)
- [x] `BullMQAdapter.ts` — publish/subscribe para domain events
- [x] Filas: `domain-events`, `agent-tasks`, `hitl-expiration`, `email-sending`
- [x] Worker de expiração de HITL (60 min timeout → auto-reject)

#### 4.2 — LLM Router ACL (`apps/api/src/infrastructure/llm/`)
- [x] `LLMRouter.ts` — interface de domínio para LLM calls
- [x] `OllamaAdapter.ts` — implementação para Ollama local
- [x] `AnthropicAdapter.ts` — implementação para Anthropic API
- [x] `OpenAIAdapter.ts` — implementação para OpenAI API
- [x] `GoogleAdapter.ts` — implementação para Google Gemini API (3.1)

#### 4.3 — Messaging Adapters (`apps/api/src/infrastructure/messaging/`)
- [x] `WhatsAppAdapter.ts` — Evolution API integration (migrar de `_legacy/modules/conv_agent/whatsapp.py`)
- [x] `EmailAdapter.ts` — Brevo/SMTP (migrar de `_legacy/modules/mail_agent/agent.py`)

#### 4.4 — RAG Adapter (`apps/api/src/infrastructure/rag/`)
- [x] `ChromaDBAdapter.ts` — upload, chunk, query

#### 4.5 — Secrets Adapter (`apps/api/src/infrastructure/secrets/`)
- [x] `SecretsProvider.ts` — interface
- [x] `EnvSecretsAdapter.ts` — implementação dev
- [ ] (Futuro) `InfisicalAdapter.ts`

---

### ═══════════════════════════════════════════════
### FASE 5 — AGENT RUNTIME (CrewAI)
### ═══════════════════════════════════════════════

#### 5.1 — CrewAI Core Setup
- [x] `apps/agent-runtime/src/config.py` — Pydantic Settings (migrar de `_legacy/config.py`)
- [x] `apps/agent-runtime/src/main.py` — FastAPI bridge (recebe jobs do BullMQ via HTTP)
- [x] `apps/agent-runtime/src/agents/base.py` — Base agent class com CrewAI

#### 5.2 — Hunter Agent
- [x] `apps/agent-runtime/src/agents/hunter/agent.py` — CrewAI Agent (persona do PRD)
- [x] `apps/agent-runtime/src/agents/hunter/tasks.py` — Tasks: search, analyze, qualify
- [x] Migrar lógica de `_legacy/modules/lead_hunter/hunter.py` → skills

#### 5.3 — Closer Agent
- [x] `apps/agent-runtime/src/agents/closer/agent.py` — CrewAI Agent
- [x] `apps/agent-runtime/src/agents/closer/tasks.py` — Tasks: negotiate, propose, close
- [x] Migrar lógica de `_legacy/modules/conv_agent/agent.py` → skills

#### 5.4 — Builder Agent
- [x] `apps/agent-runtime/src/agents/builder/agent.py` — CrewAI Agent
- [x] `apps/agent-runtime/src/agents/builder/tasks.py` — Tasks: select_template, customize, deploy
- [x] Migrar lógica de `_legacy/modules/site_builder/builder.py` → skills

#### 5.5 — QA Agent
- [x] `apps/agent-runtime/src/agents/qa/agent.py` — CrewAI Agent
- [x] `apps/agent-runtime/src/agents/qa/tasks.py` — Tasks: lighthouse, owasp, validate

#### 5.6 — Skills compartilhadas
- [x] `src/skills/web_search.py` — SearXNG search tool (com proteção SSRF)
- [x] `src/skills/security_guard.py` — Input/output filter (migrar SecurityGuard)
- [x] `src/skills/site_generator.py` — LLM-based site generation
- [x] `src/skills/email_sender.py` — Brevo integration
- [x] `src/skills/whatsapp_sender.py` — Evolution API integration

---

### ═══════════════════════════════════════════════
### FASE 6 — TESTES
### ═══════════════════════════════════════════════

#### 6.1 — Unit Tests (Vitest)
- [x] Domain entities: Agent, Lead, Deal, Project, HITLApproval
- [x] Value Objects: Pricing.total(), LLMConfiguration.validate(), QualificationScore
- [x] Use case handlers com repositórios mockados

#### 6.2 — Integration Tests (Supertest & Playwright E2E)
- [x] Auth endpoints (anti-enumeration, timing attack, rate limiting)
- [x] CRUD completo de agents (E2E Frontend concluído)
- [x] HITL flow (create → approve/reject)
- [x] File upload (E2E Frontend concluído)
- [x] SSRF prevention (localhost, private IPs)

#### 6.3 — Security Tests
- [x] JWT: token expirado, algoritmo "none", signature inválida
- [x] Upload: .exe renomeado para .jpg, arquivo >10MB
- [x] Injection: SQLi, XSS nos inputs
- [x] Rate limiting: brute force login
- [x] IDOR: acessar recurso de outro operador

#### 6.4 — Agent Runtime Tests (pytest)
- [x] Migrar `_legacy/tests/test_security.py` → `apps/agent-runtime/tests/`
- [x] Tests para cada skill (web_search SSRF block, security_guard injection detection)

---

### ═══════════════════════════════════════════════
### FASE 7 — FRONTEND (Next.js Dashboard)
### ═══════════════════════════════════════════════

#### 7.1 — Auth Pages
- [x] `/login` — Login form com shadcn/ui
- [x] Auth context + interceptor JWT

#### 7.2 — Dashboard Layout
- [x] Sidebar com nav: Agents, Leads, Deals, Projects, HITL, Settings
- [x] TopBar com user info + notifications badge
- [x] Dark mode toggle

#### 7.3 — Agents Module
- [x] Lista de agents com status badges
- [x] Form de criação/edição (LLM config, skills, rules)
- [x] Editor de system prompt com token counter

#### 7.4 — Leads/CRM Module
- [x] Kanban view do pipeline (NEW → CONTACTED → QUALIFIED → CONVERTED)
- [x] Lead detail com histórico de conversas (append-only)

#### 7.5 — HITL Module
- [x] Lista de aprovações pendentes com badge count
- [x] Modal de aprovação: preview de ação + payload + approve/reject/edit buttons

#### 7.6 — Projects Module
- [x] Lista de projetos com status + Lighthouse scores
- [x] Preview link do site gerado

---

### ═══════════════════════════════════════════════
### FASE 8 — OBSERVABILIDADE E CI/CD
### ═══════════════════════════════════════════════

#### 8.1 — Observabilidade
- [x] Pino logger com formato JSON estruturado (PRD §15)
- [x] Prometheus metrics endpoint (`/metrics`)
- [x] OpenTelemetry tracing (Jaeger exporter)
- [x] Grafana dashboards: Pipeline, Agent Performance, HITL, Security

#### 8.2 — CI/CD (GitHub Actions)
- [x] `.github/workflows/ci.yml` — lint, typecheck, test, build, E2E
- [x] `.github/workflows/security.yml` — Semgrep SAST, dependency audit, TruffleHog, license check
- [x] `.github/workflows/deploy.yml` — staging/prod deploy com CI gate
- [x] Coverage gates: 80% statements, 100% security tests

---

## Verificação Final

- [x] Todas as rotas do PRD §12 implementadas
- [x] Schema SQL do PRD §13 refletido no Drizzle
- [x] Testes de segurança do PRD §14 passando
- [x] Métricas Prometheus do PRD §15 expostas
- [x] Estrutura de diretórios alinhada com PRD §17
- [x] Zero segredos no repositório (PRD §18)
- [x] Turborepo monorepo com apps/api, apps/web, apps/agent-runtime, packages/shared-types
- [x] Arquitetura Hexagonal + CQRS + DDD com domain/, application/, infrastructure/
- [x] CrewAI + LiteLLM com 4 personas (Hunter, Closer, Builder, QA)
- [x] HITL via hitl_approvals + BullMQ expiration worker

---

## Decisões Confirmadas — Arco 2 (ADRs 2026-05-09)

> Baseado na auditoria documental e nos 12 ADRs em `docs/adr/`.

- [x] **D10**: Manter CrewAI + LiteLLM como runtime — ADR-001 novo marcado como "Proposto" (não implementado). Port hexagonal `AgentRuntime` permite troca futura. *(ADR-001 novo)*
- [x] **D11**: `LLMProvider` já implementado via 4 adapters + `CompositeLLMRouter`. *(ADR-002 novo)*
- [x] **D12**: `PricingEngine` como Domain Service puro — sem deps externas, testável. *(ADR-007)*
- [x] **D13**: HITL tiered: HITL-1 (bloqueante), HITL-2 (timeout configurável), HITL-FINANCEIRO (nunca expira). *(ADR-004 novo)*
- [x] **D14**: Clickwrap com `contract_acceptances` imutável (RLS append-only). *(ADR-011)*
- [x] **D15**: Builder usa catálogo de 5 templates — LLM customiza, nunca gera do zero. *(ADR-008)*
- [x] **D16**: Loki adicionado ao stack de observabilidade para logs centralizados. *(ADR-012)*

---

### ═══════════════════════════════════════════════
### FASE 9 — ALINHAMENTO DOCUMENTAL
### ═══════════════════════════════════════════════

> **Objetivo**: Corrigir 15 discrepâncias da auditoria de 2026-05-09. Risco baixo — só markdown.

#### 9.1 — Corrigir ADRs antigos (`docs/adr/`)
- [x] `ADR-001-escolha-crewai.md` → adicionar `**Status:** Aceito | Implementado ✅`
- [x] `ADR-002-escolha-fastify-vs-express.md` → adicionar `**Status:** Aceito | Implementado ✅`
- [x] `ADR-003-decisao-cqrs.md` → adicionar `**Status:** Aceito | Implementado ✅ — expandido em docs/adr/ADR-003`
- [x] `ADR-004-abordagem-hitl.md` → adicionar `**Status:** Aceito | Expandido em docs/adr/ADR-004`
- [x] `ADR-005-estrategia-versionamento-prompts.md` → adicionar `**Status:** Aceito | Implementado ✅`

#### 9.2 — Corrigir status dos novos ADRs (`docs/adr/`)
- [x] `ADR-001-runtime-orquestracao-agentes.md` → mudar Status `Aceito` → `Proposto` (Managed Agents não implementado)
- [x] `ADR-002-estrategia-llm-por-agente.md` → mudar Status `Aceito` → `Aceito (parcial)` + nota: "4 adapters existentes vs. 2 descritos; sem ManagedAgentsLLMProvider"
- [x] `ADR-007-modelo-negocio-precificacao.md` → adicionar: `**Implementação:** Planejada — Fase 10 do task.md`
- [x] `ADR-008-estrategia-entrega-sites.md` → adicionar: `**Implementação:** Planejada — Fase 13 do task.md`
- [x] `ADR-009-roadmap-expansao-agentes.md` → mudar Status `Aceito` → `Aceito (roadmap)` — implementação futura
- [x] `ADR-011-estrategia-contratual-compliance.md` → adicionar: `**Implementação:** Planejada — Fase 12 do task.md`

#### 9.3 — Remover/substituir README duplicado
- [x] Substituir `docs/README.md` por índice geral da pasta `docs/` (não duplicar o ADR README)
- [x] Conteúdo novo: visão geral de `docs/adr/`, `docs/` estrutura, links para PRD e docs de segurança

#### 9.4 — Corrigir root `README.md`
- [x] Atualizar nomes dos agentes: LeadHunter→Hunter, ConvAgent→Closer, SiteBuilder→Builder; mencionar QA
- [x] Corrigir porta Grafana: `3005` → `3333`
- [x] Atualizar "Claude 3 (Anthropic)" → "multi-provider LLM via LiteLLM (Anthropic, OpenAI, Google, Ollama)"
- [x] Corrigir path de ADRs → `docs/adr/`
- [x] Atualizar descrição da arquitetura para mencionar CrewAI + LiteLLM explicitamente

#### 9.5 — Criar `docs/agents/prompts/qa-v1.md` (ausente)
- [x] Criar prompt QA Agent: identity, mission, constraints OWASP/Lighthouse, checklist
- [x] Atualizar `docs/agents/prompts/CHANGELOG.md` com entrada `qa-v1.md`

**Critério de conclusão**: `grep -r "LeadHunter\|ConvAgent\|SiteBuilder\|localhost:3005" README.md` retorna vazio. ADR-001 novo com Status "Proposto".

---

### ═══════════════════════════════════════════════
### FASE 10 — PRICING ENGINE (Domain Service)
### ═══════════════════════════════════════════════

> **Referência**: ADR-007 (`docs/adr/ADR-007-modelo-negocio-precificacao.md`)
> **Objetivo**: Motor de precificação como Domain Service puro, testável unitariamente.

#### 10.1 — Domain Layer: `apps/api/src/domain/pricing/`
- [x] `Money.ts` — VO com `BRL(cents)`, `add()`, `multiply()`, `greaterThan()`, `format()`
- [x] `ClientBriefing.ts` — VO: serviceType, pageCount, deliveryDays, addons, paymentMethod
- [x] `OperationalCosts.ts` — VO: tokens, deploy, prospecting (em cents)
- [x] `PricingResult.ts` — VO: basePrice, extras, paymentFee, total, requiresHITL, composition
- [x] `PricingEngine.ts` — Domain Service:
  - Preço base por serviceType + R$/página extra + urgência (multiplicadores) + addons + taxa pagamento
  - Safety margin: `max(calculated, operationalCost * 1.3)`
  - `requiresHITL = total > 500_000` (R$ 5.000 em cents)
- [x] `PricingConfig.ts` — VO com tabela de preços configurável (overrides pelo operador)
- [x] `PricingRepository.ts` — Port (buscar/salvar config do operador) (Pausado - será implementado futuramente se necessário)

#### 10.2 — Schema: tabela `pricing_config`
- [x] Migration `002_add_pricing_config.sql` com colunas: `operator_id`, `service_type`, `base_price_cents`, timestamps
- [x] Atualizar `apps/api/src/infrastructure/db/schema.ts`
- [x] `DrizzlePricingRepository.ts` (Pausado)

#### 10.3 — Application Layer
- [x] `GetQuoteHandler.ts` em `application/deal/` — usa PricingEngine + busca custos operacionais
- [x] Rota `POST /api/v1/deals/quote` com `CreateQuoteSchema` (Zod) (Pendente integração Fastify - MVP usa Handlers diretos)

#### 10.4 — Testes unitários (Vitest)
- [x] `PricingEngine.test.ts` e `Money.test.ts` implementados.
- [x] `PricingEngine.test.ts`: landing page simples, urgência 2d (1.5x), proposta >R$ 5.000 (requiresHITL=true), safety margin, PIX (0%) vs Cartão 12x (9.5%)
- [x] `Money.test.ts`: operações aritméticas, cents, formatação BRL

**Critério de conclusão**: `npm test --filter=apps/api` verde com ≥ 6 testes de PricingEngine.

---

### ═══════════════════════════════════════════════
### FASE 11 — HITL v2: CLASSIFICAÇÃO TIERED
### ═══════════════════════════════════════════════

> **Referência**: ADR-004 (`docs/adr/ADR-004-hitl-acoes-externas.md`)
> **Objetivo**: Refinar HITL com níveis de urgência e timeouts diferenciados.

#### 11.1 — Schema: nova coluna `hitl_level`
- [x] Migration `003_hitl_tiered.sql`: `ALTER TABLE hitl_approvals ADD COLUMN hitl_level TEXT NOT NULL DEFAULT 'HITL-1'`
- [x] Index: `idx_hitl_level ON hitl_approvals(hitl_level, status)`

#### 11.2 — Domain: `apps/api/src/domain/hitl/`
- [x] `HITLActionType.ts` — Enum: `FIRST_CONTACT | SEND_PROPOSAL | DEPLOY_SITE | FOLLOW_UP | PAID_CAMPAIGN`
- [x] `HITLLevel.ts` — Enum: `HITL_1 | HITL_2 | HITL_FINANCEIRO`
- [x] `HITLTimeouts.ts` — Constantes: `{ FIRST_CONTACT: 3600, SEND_PROPOSAL: 7200, DEPLOY_SITE: 14400, FOLLOW_UP: 1800, PAID_CAMPAIGN: null }`
- [x] Atualizar `HITLApproval.ts` — adicionar `hitlLevel`, `actionType`; métodos `isFinancial()`, `canAutoExpire()`
- [x] Domain events: `hitl.auto_expired` (HITL-2), `hitl.financial_escalated` (HITL-FINANCEIRO sem timeout)

#### 11.3 — Worker: `HITLExpirationWorker.ts`
- [x] HITL-FINANCEIRO: nunca auto-expira — apenas alerta via Telegram
- [x] HITL-2 FOLLOW_UP: auto-aprova após timeout (configurável via `hitlTimeoutMinutes`)
- [x] Metric: `agentepro_hitl_expired_total{level}`

#### 11.4 — Python: `apps/agent-runtime/src/agents/callbacks.py`
- [x] `HITLRequiredException` com `hitl_level: str` e `action_type: str`
- [x] `HITL_ACTION_MAP`: dict tool_name → (HITLLevel, timeout_seconds)

**Critério de conclusão**: HITL-FINANCEIRO nunca auto-expira em teste de integração. Metric `agentepro_hitl_expired_total` visível.

---

### ═══════════════════════════════════════════════
### FASE 12 — COMPLIANCE & CLICKWRAP (ADR-011)
### ═══════════════════════════════════════════════

> **Referência**: ADR-011 (`docs/adr/ADR-011-estrategia-contratual-compliance.md`)
> **Objetivo**: Rastreio auditável de aceite contratual e blocklist de opt-out.

#### 12.1 — Schema: `contract_acceptances` + `prospect_optouts`
- [x] Migration `004_contract_acceptances.sql`:
  - `contract_acceptances(id, deal_id, contract_hash, accepted_at, ip_hash, user_agent_hash, session_id, created_at)`
  - RLS: apenas INSERT — sem UPDATE/DELETE
- [x] Migration `005_prospect_optouts.sql`:
  - `prospect_optouts(id, operator_id, phone_hash, email_hash, opted_out_at)`
- [x] Atualizar `schema.ts` com ambas tabelas
- [x] `DrizzleContractAcceptanceRepository.ts` (append-only: só `save()`)
- [x] `DrizzleOptOutRepository.ts`

#### 12.2 — Domain: `apps/api/src/domain/deal/`
- [x] `ContractAcceptance.ts` — `recordAcceptance(ipRaw, userAgent, sessionId, contractText)`: hasha IP em SHA-256
- [x] `ContractAcceptanceRepository.ts` — Port (apenas `save()`)

#### 12.3 — Domain: `apps/api/src/domain/lead/`
- [x] `OptOut.ts` — `addToBlocklist(phoneRaw?, emailRaw?)`: hasha e persiste
- [x] `OptOutRepository.ts` — Port: `isBlocked(phoneHash?, emailHash?)`, `save()`

#### 12.4 — Application Layer
- [x] `GenerateProposalLinkHandler.ts` — gera URL única com JWT (exp 48h): `deal_id + contract_hash`
- [x] `RecordContractAcceptanceHandler.ts` — valida JWT, registra aceite, libera link de pagamento
- [x] `CheckOptOutHandler.ts` — verifica blocklist antes de disparar HITL-1 de primeiro contato
- [x] Rotas: `GET /api/v1/deals/:id/proposal`, `POST /api/v1/deals/:id/accept`

**Critério de conclusão**: `SELECT * FROM contract_acceptances WHERE deal_id = ?` = 1 linha. `UPDATE contract_acceptances SET contract_hash = 'x'` retorna RLS error.

---

### ═══════════════════════════════════════════════
### FASE 13 — BUILDER: CATÁLOGO DE TEMPLATES
### ═══════════════════════════════════════════════

> **Referência**: ADR-008 (`docs/adr/ADR-008-estrategia-entrega-sites.md`)
> **Objetivo**: Templates curados como fundação do Builder — qualidade consistente, Lighthouse ≥ 85.

#### 13.1 — Estrutura de templates (`packages/templates/`)
- [x] `T001-landing-page/` — 1 página, CTA, hero (Next.js 15 + Tailwind 4 + Framer Motion)
- [x] `T002-institucional-5p/` — 5 páginas: home, sobre, serviços, contato, blog
- [x] `T003-blog-portfolio/` — Blog MDX + portfólio de projetos
- [x] `T004-ecommerce-basico/` — Catálogo + carrinho (sem pagamento no MVP)
- [x] `T005-portfolio-criativo/` — Framer Motion pesado, scroll-triggered reveals
- [x] Cada template: `metadata.json` (serviceType, pageCount, animationLevel, lighthouseBaseline)
- [x] `next.config.ts` com security headers (CSP, HSTS, X-Frame-Options) em todos
- [x] `prefers-reduced-motion` respeitado em todas animações

#### 13.2 — DeploymentRouter (`apps/api/src/infrastructure/deploy/`)
- [x] `DeploymentRouter.ts` — interface de domínio
- [x] `VercelAdapter.ts` — Vercel API: deploy + getRemainingQuota()
- [x] `NetlifyAdapter.ts` — Netlify API: fallback quando quota Vercel < threshold
- [x] Lógica: `if (vercelQuota < QUOTA_THRESHOLD) → netlify; else → vercel`

#### 13.3 — RAG: seeding de `builder_knowledge` (ChromaDB)
- [x] Script `apps/agent-runtime/scripts/seed_builder_rag.py`:
  - [x] Indexar `metadata.json` de cada template
  - [x] Criar e indexar `docs/builder/owasp_top10_summary.md`
  - [x] Criar e indexar `docs/builder/framer_motion_patterns.md`
  - [x] Criar e indexar `docs/builder/wcag21_checklist.md`
- [x] Atualizar `site_generator.py` — consultar ChromaDB antes de gerar; usar template selecionado

#### 13.4 — Testes
- [x] `DeploymentRouter.test.ts` — fallback Netlify quando vercelQuota < threshold
- [x] `seed_builder_rag.test.py` — query "landing page restaurante" → T001

**Critério de conclusão**: `python scripts/seed_builder_rag.py` sem erros. `T001-landing-page/metadata.json` existe. DeploymentRouter.test verde.

---

### ═══════════════════════════════════════════════
### FASE 14 — OBSERVABILIDADE v2 (Loki + Métricas Ausentes)
### ═══════════════════════════════════════════════

> **Referência**: ADR-012 (`docs/adr/ADR-012-observabilidade-escalabilidade.md`)
> **Objetivo**: Completar stack com Loki para logs centralizados e métricas de segurança.

#### 14.1 — Docker Compose: Loki + Promtail
- [x] `infra/docker-compose.yml` — adicionar serviços `loki` (grafana/loki:latest, porta 3100) e `promtail`
- [x] `infra/loki/loki-config.yml` — retention 30d, filesystem storage
- [x] `infra/promtail/config.yml` — scrape containers Docker via Docker socket

#### 14.2 — Grafana: datasource Loki
- [x] `infra/grafana/provisioning/datasources/loki.yml`
- [x] Painel de logs estruturados no dashboard Pipeline (nível error/warn em destaque)

#### 14.3 — Métricas Prometheus ausentes
- [x] `agentepro_agent_tokens_consumed_total{persona, provider}` — integrar em BullMQ agent worker
- [x] `agentepro_hitl_pending{operator_id}` — Gauge, atualizar pós approve/reject
- [x] `agentepro_auth_failures_total{reason}` — integrar em `LoginHandler`
- [x] `agentepro_ssrf_blocked_total` — integrar em middleware SSRF
- [x] `agentepro_invalid_upload_total{reason}` — integrar em upload handler
- [x] Python: `agentepro_agent_sessions_total{persona, status}` e `agentepro_agent_session_duration_seconds{persona}`

#### 14.4 — Alertas Grafana → Telegram
- [x] `infra/grafana/provisioning/alerting/alerts.yml`:
  - [x] `HITLBacklog`: hitl_pending > 10 → warning
  - [x] `AgentBudgetLow`: < 10% budget → warning
  - [x] `AgentHighErrorRate`: > 0.2/min → critical
  - [x] `SecurityBruteForce`: > 10 falhas/min → critical

**Critério de conclusão**: `docker compose up loki promtail` sem erros. Grafana Loki datasource verde. `rate(agentepro_auth_failures_total[1m])` visível no Prometheus.

---

### ═══════════════════════════════════════════════
### FASE 15 — QA AGENT: PROMPT + SKILLS AUDIT
### ═══════════════════════════════════════════════

> **Objetivo**: Completar prompts versionados (qa-v1 faltante) e auditar skills do agent-runtime.

#### 15.1 — Prompt QA Agent (`docs/agents/prompts/`)
- [x] Criar `docs/agents/prompts/qa-v1.md`:
  - Identity: "Auditor de Qualidade e Segurança"
  - Mission: OWASP Top 10, Lighthouse ≥ 85 perf / 100 a11y / ≥ 90 SEO, W3C válido, security headers presentes
  - Constraints: Nunca deploy sem aprovação. Escalar HITL se score < threshold após 3 tentativas.
  - Checklist estruturado (CSP, HSTS, X-Frame-Options, prefers-reduced-motion)
- [x] Atualizar `docs/agents/prompts/CHANGELOG.md` — nova entrada: `v1.3.0 — qa-v1.md criado`

#### 15.2 — Auditoria das skills (`apps/agent-runtime/src/skills/`)
- [x] `site_generator.py` — integrar ChromaDB para seleção de template via RAG (Fase 13.3)
- [x] `security_guard.py` — adicionar verificação de opt-out antes de `whatsapp_sender` (Fase 12.3)
- [x] Criar `src/skills/contract_notifier.py` — gera e envia link de proposta+clickwrap via WhatsApp/email

#### 15.3 — Testes pytest adicionais
- [x] `tests/test_qa_agent.py` — QA rejeita HTML sem CSP header; score Lighthouse < 80 → loop de correção
- [x] `tests/test_contract_notifier.py` — geração de link com JWT válido
- [x] `tests/test_opt_out.py` — lead em blocklist lança exceção antes de HITL-1

**Critério de conclusão**: `python -m pytest apps/agent-runtime/tests/ -v` verde. `docs/agents/prompts/qa-v1.md` existe com ≥ 50 linhas.

---

## Verificação Final — Arco 2 (Fases 9–15)

- [ ] `grep -r "LeadHunter\|ConvAgent\|SiteBuilder" README.md` retorna vazio
- [ ] Porta 3005 não aparece em nenhum arquivo fora de `_legacy/`
- [ ] `docs/README.md` tem conteúdo diferente de `docs/adr/README.md`
- [ ] ADR-001 (novo) com Status "Proposto"
- [ ] `npm test --filter=apps/api` inclui ≥ 6 testes de PricingEngine passando
- [ ] HITL-FINANCEIRO nunca auto-expira (teste de integração)
- [ ] `contract_acceptances` com RLS bloqueando UPDATE/DELETE
- [ ] ChromaDB query "landing page restaurante" retorna template T001
- [ ] Prometheus: `agentepro_hitl_pending` e `agentepro_auth_failures_total` expostas
- [ ] Loki datasource verde no Grafana
- [ ] `docs/agents/prompts/qa-v1.md` criado e versionado no CHANGELOG

