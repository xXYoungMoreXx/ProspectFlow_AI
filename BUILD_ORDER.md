# BUILD_ORDER.md — Ordem de Implementação e Grafo de Dependências

> **Estado atual (2026-06-01):** Sprints 0–3 concluídas. MVP funcional em localhost.
> Próximas iniciativas: frontend avançado (S3-05/06 feitos), testes de carga, deploy cloud.
>
> O agente DEVE seguir esta ordem. Implementar fora de sequência
> cria acoplamentos que violam a arquitetura hexagonal.
> Última atualização: 2026-06-01 | Versão: 2.1.0

---

## Regra Fundamental

```
Se o arquivo A importa o arquivo B, então B deve estar implementado antes de A.
Se você precisar "pular" uma camada para resolver uma dependência, é sinal
de que está faltando uma interface/port entre as duas camadas.
```

---

## Fase 0 — Fundação (Semanas 1–2)

### 0.1 — Monorepo e Configuração Base

```
Ordem:  package.json (raiz) → turbo.json → .gitignore → .nvmrc
        tsconfig.base.json → apps/api/tsconfig.json
        apps/api/package.json → apps/web/package.json
        apps/agent-runtime/pyproject.toml

Sem dependências entre si — implementar em qualquer ordem.
Critério: `turbo build` passa sem erros de configuração.
```

### 0.2 — Shared Types (packages/shared-types)

```
Ordem:  packages/shared-types/src/errors.types.ts
        packages/shared-types/src/pagination.types.ts
        packages/shared-types/src/agent.types.ts
        packages/shared-types/src/lead.types.ts
        packages/shared-types/src/deal.types.ts
        packages/shared-types/src/briefing.types.ts
        packages/shared-types/src/project.types.ts
        packages/shared-types/src/hitl.types.ts
        packages/shared-types/src/index.ts (re-exporta tudo)

Sem dependências entre si.
Critério: `tsc --noEmit` passa no pacote shared-types.
```

### 0.3 — Domain Layer Camada 0 (sem dependências)

```
Ordem:  domain/shared/Result.ts
        domain/shared/Money.ts
        domain/shared/Timestamp.ts
        domain/shared/UUID.ts
        domain/shared/AggregateRoot.ts
        domain/shared/DomainEvent.ts
        domain/shared/errors.ts

Sem dependências internas — apenas TypeScript stdlib.
Critério: todos os unit tests desta camada passam.
```

### 0.4 — Domain Layer Camada 1 (Value Objects de ID)

```
Depende de: 0.3

Ordem:  domain/agent/AgentId.ts
        domain/agent/SubAgentId.ts
        domain/lead/LeadId.ts
        domain/deal/DealId.ts
        domain/briefing/BriefingId.ts
        domain/project/ProjectId.ts
        domain/hitl/HITLApprovalId.ts

Critério: cada ID valida UUID v4, rejeita string vazia.
```

### 0.5 — Domain Layer Camada 2 (Value Objects de dados)

```
Depende de: 0.3, 0.4

Ordem:  domain/agent/AgentPersona.ts       (enum type)
        domain/agent/AgentStatus.ts         (enum type)
        domain/agent/LLMConfiguration.ts    (VO complexo)
        domain/agent/LLMProvider.ts         (enum type)
        domain/agent/TokenBudget.ts
        domain/agent/ParallelConfig.ts
        domain/lead/LeadStatus.ts
        domain/lead/LeadSource.ts
        domain/lead/QualificationScore.ts   (0-100, validado)
        domain/lead/EnrichmentData.ts       (CNPJ, Maps data)
        domain/lead/FollowUpSchedule.ts     (cadência)
        domain/lead/MessageChannel.ts       (enum type)
        domain/deal/DealStatus.ts
        domain/deal/ServiceType.ts
        domain/deal/Pricing.ts              (Money + breakdown)
        domain/briefing/BriefingStatus.ts
        domain/briefing/SiteType.ts
        domain/briefing/ClientBriefingDTO.ts (interface)
        domain/project/ProjectStatus.ts
        domain/hitl/HITLStatus.ts
        domain/hitl/ActionType.ts

Critério: todos os VOs imutáveis e com validação testada.
```

### 0.6 — Domain Layer Camada 3 (Aggregates)

```
Depende de: 0.3, 0.4, 0.5

Ordem:  domain/agent/SubAgent.ts           (aggregate menor)
        domain/agent/Agent.ts              (aggregate principal)
        domain/lead/Lead.ts
        domain/deal/Deal.ts
        domain/briefing/Briefing.ts
        domain/project/Project.ts
        domain/hitl/HITLApproval.ts

IMPORTANTE: Cada aggregate DEVE:
  - Estender AggregateRoot
  - Ter método pullEvents() que esvazia a lista interna
  - Emitir DomainEvents em toda mudança de estado
  - Usar Result<T> para operações que podem falhar
  - NÃO ter imports de infrastructure/ ou application/

Critério: unit tests de invariantes de domínio passam.
```

### 0.7 — Repository Interfaces (Ports)

```
Depende de: 0.6

Ordem:  domain/agent/AgentRepository.ts
        domain/lead/LeadRepository.ts
        domain/deal/DealRepository.ts
        domain/briefing/BriefingRepository.ts
        domain/project/ProjectRepository.ts
        domain/hitl/HITLRepository.ts

São apenas interfaces TypeScript — sem implementação ainda.
Critério: interfaces compilam sem erros.
```

### 0.8 — External Ports (Interfaces de infra)

```
Depende de: 0.5, 0.6

Ordem:  domain/media/MediaGenerationPort.ts
        domain/scheduling/SchedulingPort.ts
        infrastructure/messaging/MessagingPort.ts
        infrastructure/llm/LLMPort.ts
        infrastructure/maps/GoogleMapsPort.ts
        infrastructure/mcp/MCPBrasilPort.ts
        infrastructure/deploy/DeployPort.ts
        infrastructure/video/VideoGenerationPort.ts
        infrastructure/secrets/SecretsPort.ts
        infrastructure/cache/CachePort.ts
        infrastructure/events/EventBus.ts

São interfaces — sem implementação.
Critério: interfaces compilam sem erros.
```

### 0.9 — Infrastructure: Config e Secrets

```
Depende de: 0.8

Ordem:  infrastructure/config/env.ts        (Zod schema + parse)
        infrastructure/config/constants.ts
        infrastructure/secrets/InfisicalAdapter.ts
        infrastructure/secrets/EnvSecretsAdapter.ts  (dev)

IMPORTANTE: env.ts valida TODAS as env vars no startup.
Se uma obrigatória está ausente → crash imediato (fail fast).

Critério: app não sobe com env inválida; sobe com env completa.
```

### 0.10 — Infrastructure: Database

```
Depende de: 0.9

Ordem:  infrastructure/db/schema.ts         (Drizzle schema)
        infrastructure/db/migrations/        (0001_initial.sql → ...)
        infrastructure/db/connection.ts      (pgbouncer pool)
        infrastructure/db/repositories/LeadRepositoryImpl.ts
        infrastructure/db/repositories/AgentRepositoryImpl.ts
        infrastructure/db/repositories/DealRepositoryImpl.ts
        infrastructure/db/repositories/BriefingRepositoryImpl.ts
        infrastructure/db/repositories/ProjectRepositoryImpl.ts
        infrastructure/db/repositories/HITLRepositoryImpl.ts

ORDEM DAS MIGRATIONS É CRÍTICA — seguir exatamente:
  0001_initial_schema.sql       (tabelas base: operators, agents)
  0002_add_sub_agents.sql
  0003_add_leads_messages.sql
  0004_add_deals.sql
  0005_add_briefings.sql
  0006_add_projects_assets.sql
  0007_add_hitl.sql
  0008_add_scheduling.sql
  0009_add_cost_tracking.sql
  0010_add_audit_log.sql

Critério: migrations rodam sem erro em banco limpo; repos passam em testes de integração.
```

### 0.11 — Infrastructure: Cache e Queue

```
Depende de: 0.9

Ordem:  infrastructure/cache/RedisAdapter.ts
        infrastructure/cache/CacheService.ts
        infrastructure/queue/BullMQAdapter.ts
        infrastructure/queue/SubAgentQueue.ts

Critério: cache get/set/TTL funciona; job enqueue/dequeue funciona.
```

### 0.12 — Infrastructure: Logger e Tracing

```
Depende de: 0.9

Ordem:  infrastructure/logger/PinoLogger.ts
        infrastructure/tracing/OpenTelemetryAdapter.ts

Critério: log estruturado com redact de PII; traceId propagado.
```

### 0.13 — Container DI

```
Depende de: 0.7, 0.8, 0.10, 0.11, 0.12

Arquivo: apps/api/src/container.ts

Registrar TUDO neste arquivo. Ordem: infrastructure → application → http.
Critério: container.resolve(QualifyLeadUseCase) não lança erro.
```

### 0.14 — HTTP: Middlewares Base

```
Depende de: 0.9, 0.12

Ordem:  http/middleware/requestId.middleware.ts
        http/middleware/auth.middleware.ts
        http/middleware/rateLimiter.middleware.ts
        http/middleware/bodySize.middleware.ts
        http/errorHandler.ts

Critério: request sem token retorna 401; rate limit retorna 429.
```

### 0.15 — Auth Use Cases e Rotas

```
Depende de: 0.6, 0.10, 0.14

Ordem:  application/auth/LoginUseCase.ts
        application/auth/RefreshTokenUseCase.ts
        application/auth/LogoutUseCase.ts
        http/routes/auth.routes.ts
        tests/integration/auth/login.test.ts
        tests/security/auth.security.test.ts

Critério: login OK, login errado = 401 genérico, brute force = 429, timing < 200ms diferença.
```

---

## Fase 1 — MVP v0: Hunter + Closer (Semanas 3–6)

### 1.1 — Agent Management

```
Depende de: 0.10, 0.13, 0.14

Ordem:  application/agent/CreateAgentUseCase.ts
        application/agent/UpdateAgentUseCase.ts
        application/agent/GetAgentQuery.ts
        application/agent/ListAgentsQuery.ts
        application/agent/AddSubAgentUseCase.ts
        application/agent/UpdateSubAgentUseCase.ts
        http/routes/agents.routes.ts
        http/routes/sub-agents.routes.ts

Critério: CRUD completo de agentes e sub-agentes com validação.
```

### 1.2 — HITL Infrastructure

```
Depende de: 0.10, 0.11

Ordem:  infrastructure/messaging/TelegramHITLBot.ts
        application/hitl/CreateHITLApprovalUseCase.ts
        application/hitl/ApproveHITLUseCase.ts
        application/hitl/RejectHITLUseCase.ts
        application/hitl/HITLTimeoutUseCase.ts
        application/hitl/HITLPayloadMasker.ts
        http/routes/hitl.routes.ts

IMPORTANTE: HITL deve funcionar ANTES de qualquer mensageria.
Critério: criar HITL, aprovar via API, rejeitar via API, timeout automático.
```

### 1.3 — Google Maps + MCP Brasil Adapters

```
Depende de: 0.8, 0.9, 0.11

Ordem:  infrastructure/maps/GoogleMapsAdapter.ts
        infrastructure/mcp/MCPBrasilAdapter.ts
        infrastructure/mcp/MCPBrasilSkill.ts

Critério: testes com mocks retornam GooglePlace[] e CNPJData corretos.
```

### 1.4 — Lead Domain: Score e Enriquecimento

```
Depende de: 0.6, 1.3

Ordem:  domain/lead/LeadQualificationService.ts  (scoring logic)
        application/lead/EnrichLeadUseCase.ts
        application/lead/QualifyLeadUseCase.ts
        application/lead/ScheduleFollowUpUseCase.ts
        http/routes/leads.routes.ts
        http/routes/prospecting.routes.ts

Critério: lead sem site + CNPJ ativo → score >= 60; CNPJ suspenso → bloqueado.
```

### 1.5 — WhatsApp + Telegram (Sales) Adapters

```
Depende de: 0.8, 0.9, 1.2

Ordem:  infrastructure/messaging/WhatsAppAdapter.ts
        infrastructure/messaging/TelegramSalesBot.ts
        infrastructure/messaging/EmailAdapter.ts
        infrastructure/messaging/MessagingRouter.ts

IMPORTANTE: todos exigem HITL antes de enviar. Testar que sem HITL = HITLRequiredError.
Critério: mock de envio funciona; sem HITL aprovado = 403 HITL_REQUIRED.
```

### 1.6 — Agent Runtime Base (Python)

```
Depende de: 0.9 (secrets), 1.5

Ordem:  agent-runtime/src/main.py           (FastAPI app)
        agent-runtime/src/config/llm_routing.py
        agent-runtime/src/agents/base_sub_agent.py
        agent-runtime/src/skills/web_search.py
        agent-runtime/src/skills/scraping.py
        agent-runtime/src/skills/google_maps.py
        agent-runtime/src/skills/mcp_brasil.py

Critério: /health retorna 200 com status de Ollama e ChromaDB.
```

### 1.7 — Hunter Agent (Python)

```
Depende de: 1.6, 1.4

Ordem:  agent-runtime/src/agents/hunter/sub_agents/prospector.py
        agent-runtime/src/agents/hunter/sub_agents/site_inspector.py
        agent-runtime/src/agents/hunter/sub_agents/data_enricher.py
        agent-runtime/src/agents/hunter/hunter_agent.py

Critério: Hunter executa via API, retorna leads qualificados, cria HITL.
```

### 1.8 — Deal Domain

```
Depende de: 0.6, 0.10

Ordem:  application/deal/ProposeDealUseCase.ts
        application/deal/CloseDealUseCase.ts
        application/deal/CancelDealUseCase.ts
        application/deal/RecordFollowUpUseCase.ts
        http/routes/deals.routes.ts

Critério: deal fechado emite DealClosed event; follow-up incrementa contador.
```

### 1.9 — Closer Agent (Python)

```
Depende de: 1.6, 1.8, 1.5

Ordem:  agent-runtime/src/agents/closer/sub_agents/outreach_writer.py
        agent-runtime/src/agents/closer/sub_agents/conv_handler.py
        agent-runtime/src/agents/closer/sub_agents/proposal_writer.py
        agent-runtime/src/agents/closer/sub_agents/deal_tracker.py
        agent-runtime/src/agents/closer/closer_agent.py

Critério: outreach personalizado com enrichmentData; HITL criado antes de enviar.
```

### 1.10 — CRM Queries

```
Depende de: 1.4, 1.8

Ordem:  application/lead/ListLeadsQuery.ts
        application/lead/GetLeadQuery.ts
        application/deal/ListDealsQuery.ts
        application/deal/GetDealQuery.ts
        http/routes/leads.routes.ts (endpoints de leitura)
        http/routes/deals.routes.ts (endpoints de leitura)

Critério: funil com contagem por status; filtros funcionando; paginação por cursor.
```

### 1.11 — n8n Workflows Fase 1

```
Depende de: 1.7, 1.9

Ordem:  infra/n8n/workflows/hunter_daily_prospection.json
        infra/n8n/workflows/closer_negotiation_loop.json
        infra/n8n/workflows/deal_tracker_cron.json

Critério: workflows importam no n8n sem erro; execução manual funciona.
```

---

## Fase 2 — MVP v1: Builder, QA, Delivery (Semanas 7–13)

### 2.1 — Briefing Domain

```
Depende de: 0.6, 0.10, 1.5

Ordem:  application/briefing/StartBriefingUseCase.ts
        application/briefing/CompleteBriefingUseCase.ts
        application/briefing/ApproveBriefingUseCase.ts
        application/briefing/UploadBriefingAssetUseCase.ts
        http/routes/briefings.routes.ts

Critério: magic bytes validados em upload; briefing JSON válido segundo ClientBriefingDTO.
```

### 2.2 — Briefing Agent (Python)

```
Depende de: 1.6, 2.1

Ordem:  agent-runtime/src/agents/briefing/sub_agents/interviewer.py
        agent-runtime/src/agents/briefing/sub_agents/brief_extractor.py
        agent-runtime/src/agents/briefing/briefing_agent.py
        agent-runtime/src/rag/briefing_templates_loader.py

Critério: perguntas adaptativas por nicho (restaurant ≠ clinic ≠ salon).
```

### 2.3 — Media Generation Service

```
Depende de: 0.8, 0.9

Ordem:  infrastructure/media/NanaBananaAdapter.ts    (primário)
        infrastructure/media/DalleAdapter.ts          (fallback)
        infrastructure/media/OllamaVisionAdapter.ts   (dev)
        infrastructure/media/MediaGenerationRouter.ts (ACL + fallback chain)
        infrastructure/design/ClaudeDesignAdapter.ts
        http/routes/media.routes.ts
        application/media/GenerateProjectAssetsUseCase.ts

OBRIGATÓRIO: magic bytes em imagens geradas também. Testar com mock de bytes inválidos.
Critério: NanaBanana falha → DALL-E automaticamente; magic bytes inválidos → 400.
```

### 2.4 — Builder Agent (Python) — Paralelismo Grupo 1

```
Depende de: 1.6, 2.2, 2.3

Ordem:  agent-runtime/src/agents/builder/sub_agents/copywriter.py
        agent-runtime/src/agents/builder/sub_agents/designer.py
        agent-runtime/src/agents/builder/sub_agents/imager.py
        (acima rodam em parallel_group=1 — implementar junto)

        agent-runtime/src/agents/builder/sub_agents/coder.py
        (depende dos 3 acima)

        agent-runtime/src/agents/builder/sub_agents/seo_optimizer.py
        agent-runtime/src/agents/builder/sub_agents/deployer.py
        (rodam em parallel_group=3 — implementar junto)

        agent-runtime/src/agents/builder/builder_agent.py
        agent-runtime/src/skills/deploy.py              (multi-platform)
        agent-runtime/src/skills/image_gen.py

Critério: copywriter + designer + imager rodam simultaneamente; coder espera os 3.
```

### 2.5 — Deploy Adapters

```
Depende de: 0.8, 0.9

Ordem:  infrastructure/deploy/VercelAdapter.ts
        infrastructure/deploy/CloudflarePagesAdapter.ts
        infrastructure/deploy/RenderAdapter.ts
        infrastructure/deploy/HostingerAdapter.ts
        infrastructure/deploy/DeployRouter.ts

Critério: deploy staging funciona; HITL de aprovação criado antes de produção.
```

### 2.6 — QA Agent (Python) — Paralelismo Grupo 2

```
Depende de: 1.6, 2.4

Ordem:  agent-runtime/src/agents/qa/sub_agents/sec_auditor.py
        agent-runtime/src/agents/qa/sub_agents/perf_auditor.py
        agent-runtime/src/agents/qa/sub_agents/content_check.py
        (rodam em parallel_group=1 — implementar junto)

        agent-runtime/src/agents/qa/qa_agent.py

Critério: sec + perf + content rodam simultaneamente; QA falha bloqueia deploy.
```

### 2.7 — Delivery Agent (Python)

```
Depende de: 1.6, 2.6

Ordem:  agent-runtime/src/skills/heygen.py
        agent-runtime/src/agents/delivery/sub_agents/tutorial_generator.py
        agent-runtime/src/agents/delivery/sub_agents/doc_generator.py
        agent-runtime/src/agents/delivery/sub_agents/notifier.py
        agent-runtime/src/agents/delivery/delivery_agent.py

Critério: tutorial HeyGen + PDF gerados em paralelo; enviados ao cliente após os dois.
```

### 2.8 — Orchestrator

```
Depende de: 1.7, 1.9, 2.2, 2.4, 2.6, 2.7

Arquivo: agent-runtime/src/agents/orchestrator/orchestrator_agent.py

Implementa a máquina de estados completa do PRD seção 8.
Critério: ciclo completo lead → site entregue sem intervenção humana (exceto HITL).
```

### 2.9 — Cal.com Integration

```
Depende de: 0.8, 0.9

Ordem:  infrastructure/scheduling/CalComAdapter.ts
        application/scheduling/CreateBookingLinkUseCase.ts
        application/scheduling/GetBookingsQuery.ts
        http/routes/scheduling.routes.ts

Critério: link de agendamento gerado; webhook recebido cria MeetingScheduled event.
```

### 2.10 — n8n Workflows Fase 2

```
Depende de: 2.2, 2.4, 2.6, 2.7

Ordem:  infra/n8n/workflows/builder_parallel_creation.json
        infra/n8n/workflows/qa_parallel_audit.json
        infra/n8n/workflows/delivery_complete.json

Critério: workflows completos; paralelismo verificado nos logs de execução.
```

---

## Fase 3 — Qualidade e Polimento (Semanas 14–17)

### 3.1 — Cost Tracking

```
Depende de: 0.10, 1.6

Ordem:  infrastructure/db/repositories/TokenUsageRepositoryImpl.ts
        application/costs/GetCostDashboardQuery.ts
        http/routes/costs.routes.ts

Critério: custo por site calculado corretamente; dashboard mostra breakdown.
```

### 3.2 — Observabilidade

```
Depende de: 0.12

Ordem:  infra/prometheus/prometheus.yml
        infra/prometheus/rules/hefesto.yml
        infra/grafana/dashboards/pipeline.json
        infra/grafana/dashboards/agents.json
        infra/grafana/dashboards/costs.json
        infra/grafana/dashboards/hitl.json
        infra/grafana/dashboards/security.json
        infra/grafana/dashboards/quality.json

Critério: 6 dashboards funcionando; alertas disparando em condições de teste.
```

### 3.3 — Frontend Web

```
Depende de: 0.14, 1.10, 1.2

Ordem:  web/src/app/(auth)/login/page.tsx
        web/src/app/(dashboard)/page.tsx          (overview)
        web/src/app/(dashboard)/hitl/page.tsx     (crítico — primeiro)
        web/src/app/(dashboard)/leads/page.tsx
        web/src/app/(dashboard)/agents/page.tsx
        web/src/app/(dashboard)/agents/[id]/page.tsx
        web/src/app/(dashboard)/projects/[id]/page.tsx

ORDEM DO FRONTEND: HITL primeiro (mais usado), depois leads, depois agentes.
Critério: aprovação HITL funcional; funil de leads visual; editor de agentes completo.
```

---

## Fase 4 — Agent Capability Studio + Service Catalog (SPEC-13, SPEC-14)

> Estado: planejado | Início após Fase 3 completa

### 4.1 — Service Types e Skills Catalog

```
Depende de: 0.5 (domain/deal/ServiceType.ts já existe), 1.1 (AgentSkill)

Ordem:  packages/shared-types/src/service.types.ts
        infrastructure/db/migrations/XXXX_service_type_prospecting.sql
        infrastructure/db/migrations/XXXX_skill_catalog.sql
        infrastructure/db/migrations/XXXX_seed_skill_catalog.sql
        infrastructure/db/migrations/XXXX_workflow_definitions.sql
        domain/lead/LeadQualificationService.ts        (scoring por ServiceType)
        http/routes/service-types.routes.ts
        http/routes/skill-catalog.routes.ts

Critério: 8 skills builtin no banco; calculateScore() usa SCORING_WEIGHTS[serviceType].
```

### 4.2 — Google Maps Full Data Enrichment

```
Depende de: 1.3 (GoogleMapsAdapter), 4.1

Ordem:  infrastructure/maps/GoogleMapsAdapter.ts       (extend: novos campos SPEC-03 v2.1)
        domain/lead/EnrichmentData.ts                  (extend: photos, summary, businessStatus)
        infrastructure/db/schema.ts                    (extend: companyData jsonb)

Critério: GooglePlace retorna photos[], editorialSummary, priceLevel, businessStatus,
          types[], internationalPhoneNumber, googleMapsUri, currentOpeningHours.
          Photos cacheadas 7 dias. Lead card mostra fotos e horário.
```

### 4.3 — MCP Server Management + Workflow Definitions

```
Depende de: 1.1 (Agent domain), 4.1

Ordem:  domain/agent/MCPServer.ts
        domain/agent/WorkflowDefinition.ts
        infrastructure/db/repositories/MCPServerRepositoryImpl.ts
        infrastructure/db/repositories/WorkflowDefinitionRepositoryImpl.ts
        application/agent/AddMCPServerUseCase.ts
        application/agent/TestMCPServerUseCase.ts
        application/agent/SaveWorkflowUseCase.ts       (validação DAG)
        application/agent/TestWorkflowUseCase.ts       (sandbox)
        http/routes/mcp-servers.routes.ts
        http/routes/workflow.routes.ts
        container.ts                                   (registrar novos repos)

Critério: SSRF check bloqueia RFC1918; ciclo no workflow → 422 WORKFLOW_HAS_CYCLE;
          workflow test executa sem persistir leads (sandbox).
```

### 4.4 — Agent Capability Studio Frontend

```
Depende de: 3.3 (Frontend base), 4.1, 4.2, 4.3

Ordem:  apps/web/src/components/agents/capability-studio/AgentCapabilityStudio.tsx
        apps/web/src/components/agents/capability-studio/tabs/  (8 abas)
        apps/web/src/components/agents/capability-studio/SkillCatalogModal.tsx
        apps/web/src/components/agents/capability-studio/WorkflowBuilder/
        apps/web/src/app/(dashboard)/agents/[id]/page.tsx  (REPLACE: AgentCapabilityStudio)
        apps/web/src/components/prospecting/ProspectingConfigTab.tsx  (ADD: serviceType)
        apps/web/src/components/prospecting/LeadCard.tsx   (ADD: photos, businessStatus)

Critério: 8 abas; workflow builder visual (DAG); skills catalog filtrado;
          lead card com fotos e serviço sugerido; serviceType altera pesos de score.
```

---

## Regras de Ouro do BUILD_ORDER

```
1. NUNCA pular uma camada. Se precisa de algo de infrastructure no domain,
   crie uma interface (Port) no domain e implemente o adapter em infrastructure.

2. NUNCA implementar um aggregate sem seus testes de invariantes de domínio.

3. NUNCA implementar um adapter sem mock do serviço externo nos testes.

4. SEMPRE implementar o HITL antes de qualquer mensageria ou deploy.
   Sem HITL funcionando, os agentes não podem fazer nada externamente.

5. SEMPRE seguir a ordem das migrations. Migrations fora de ordem corrompem
   o schema e exigem reset manual do banco.

6. Para o Python runtime, SEMPRE implementar base_sub_agent.py antes de
   qualquer sub-agente específico.

7. O container DI (container.ts) é atualizado a cada novo adapter/use case.
   Nunca esquecer de registrar novas dependências.
```
