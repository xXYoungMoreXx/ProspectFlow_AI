# ProspectFlow AI - Task & Milestone Tracker

Este documento rastreia o progresso do desenvolvimento, dividido em "Arcos" e "Fases".
Ele serve como a fonte da verdade para o estado atual do projeto após a transição da arquitetura legada (Python Monolith) para a nova arquitetura (Turborepo).

---

## Arco 1: Fundação e Autenticação (Fases 0 a 8) - ✅ CONCLUÍDO

Este arco estabeleceu a base do monorepo, banco de dados, e o sistema completo de autenticação e gestão de agentes, além da base de integração com RAG (ChromaDB) e LLM.

- **Fase 0:** Setup do Monorepo (Turborepo, Fastify, Drizzle, etc.) - ✅
- **Fase 1:** Database Schema Básico (Agents, Logs, RLS) - ✅
- **Fase 2:** Autenticação JWT RS256 e Argon2id - ✅
- **Fase 3:** Segurança e Middleware (Rate Limit, Anti-Brute Force) - ✅
- **Fase 4:** Agent Management CRUD - ✅
- **Fase 5:** Infraestrutura RAG (ChromaDB local) - ✅
- **Fase 6:** Worker System (BullMQ) para processamento em background - ✅
- **Fase 7:** LLM Router (OpenAI/Ollama/Anthropic) - ✅
- **Fase 8:** HITL Base e Eventos de Domínio - ✅

> 📝 **Nota:** A transição do legado foi concluída com sucesso no Arco 1. O foco agora é o desenvolvimento das regras de negócio do CRM e fluxos de negociação.

---

## Arco 2: Domínio de Negócios e Orquestração (Fases 9 a 15) - 🚧 EM ANDAMENTO

### Fase 9: Refatoração do Domínio de Lead e CRM

> Objetivo: Solidificar as entidades de Lead, garantindo que o ciclo de vida do pipeline seja respeitado e eventos de domínio sejam disparados.

- [x] Atualizar Entity `Lead.ts` para usar Value Objects (`LeadId`, `Email`, `Phone`).
- [x] Criar Enum `LeadStatus` (`NEW`, `QUALIFYING`, `QUALIFIED`, `DISQUALIFIED`, `IN_NEGOTIATION`, `WON`, `LOST`).
- [x] Implementar DrizzleRepository para Leads (leitura e escrita).
- [x] Criar UseCase `CreateLeadHandler.ts` (idempotente por email/telefone).
- [x] Criar UseCase `UpdateLeadStatusHandler.ts` (garantir transições de estado válidas).
- [x] Expor endpoints HTTP `/api/v1/leads/*` com validação Zod.
- [x] Testes Unitários de transição de estado.
- [x] (Opcional) Testes de Integração com Drizzle SQLite in-memory.

### Fase 10: Domínio de Negociação (Deals) e Pricing Engine

> Objetivo: Implementar a lógica de orçamentação dinâmica e ciclo de vida de contratos. Requer extrema precisão matemática.

- [x] Atualizar Entity `Deal.ts` (relacionamento com `LeadId` e `AgentId`).
- [x] Criar `PricingEngine.ts` puro (domain service sem dependências DB).
  - [x] Definir base rate, multipliers (complexidade, urgência).
  - [x] Calcular margem de segurança (buffer).
- [x] Criar UseCase `GenerateQuoteHandler.ts` usando a `PricingEngine`.
- [x] Expor rota de simulação de preços `POST /api/v1/deals/quote`. (Pendente Integração)
- [x] Expor endpoints HTTP `/api/v1/deals/*`.
- [x] Implementar Repository para Persistência (`DealRepository.ts` / `DrizzleDealRepository.ts`). ✅ Concluído.

### Fase 11: HITL Tiered System (Aprovação Financeira)

> Objetivo: Extender o sistema HITL (Fase 8) para suportar aprovações críticas de negócio (ex: descontos agressivos, envio de proposta).

- [x] Criar Enum `HITLSeverity` (`LOW`, `MEDIUM`, `HIGH`, `CRITICAL_FINANCIAL`).
- [x] Modificar `HITLRequest.ts` para incluir payload de contexto financeiro.
- [x] Criar worker `HITLExpirationWorker.ts` (BullMQ) para requests expirados.
- [x] HITL-FINANCEIRO: nunca auto-expira — apenas alerta via Telegram.
- [x] Expor `/api/v1/hitl/approve` e `/api/v1/hitl/reject` para o front-end.
- [x] Garantir que `Deal.sendProposal()` requer obrigatoriamente clearance do HITL.

### Fase 12: Contract Acceptances & Compliance (Clickwrap)

> Objetivo: Garantir segurança jurídica no aceite de propostas geradas pelos agentes.

- [x] Criar Entity `ContractAcceptance.ts` com hash SHA-256 da proposta.
- [x] Coletar IP e User-Agent do Lead no momento do aceite (via Headers).
- [x] Criar rota pública `POST /api/v1/deals/:id/accept` (requer token JWT temporário gerado para a proposta).
- [x] Disparar evento de domínio `ContractAcceptedEvent`.
- [x] Atualizar status do Deal para `WON`.
- [x] Worker para gerar log imutável da transação (AuditLog).

### Fase 13: Project Generation (Hand-off)

> Objetivo: A transição entre o fechamento do negócio e o início do desenvolvimento (Agent Builder).

- [x] Escutar `ContractAcceptedEvent`.
- [x] Criar Entity `Project.ts` vinculada ao `DealId`.
- [x] Selecionar Template de arquitetura com base no tipo de Deal (Landing Page, Institucional, E-commerce).
- [x] Criar UseCase `InitializeProjectWorkspace.ts`.
- [x] Disparar job no BullMQ para o agent-runtime iniciar a geração de código.

### Fase 14: Finalização da Arquitetura e Monitoramento

> Objetivo: Implementar a estrutura de logging e tracing para produção, e alinhar Fases 9-15.

#### 14.1 — Estruturação de Logs

- [x] Log estruturado (JSON) no Fastify.
- [x] Implementação Padrão: `{ level, timestamp, service, traceId, message, context }`.
- [x] Remoção de `console.log` legados no `agent-runtime`.

#### 14.2 — OpenTelemetry / Distributed Tracing (Pausado p/ MVP)

- [ ] Adicionar otel-instrumentation no Fastify.
- [ ] Propagar Trace ID nas mensagens do BullMQ.
- [ ] Interceptar Trace ID no Python agent-runtime.

#### 14.3 — Configuração Loki + Grafana (Infraestrutura)

- [x] Adicionar promtail e loki no `docker-compose.yml`.
- [x] Adicionar grafana provisionado com Loki datasource.

#### 14.4 — Alertas Grafana → Telegram (Novo Canal)

- [x] Alerta: Alta latência na LLM.
- [x] Alerta: Brute-force auth (> X tentativas).
- [x] Alerta: HITL Financeiro Pendente.

### Fase 15: Agent-Runtime V2 Integration

> Objetivo: Conectar de forma robusta o worker Python com a API Node.

- [x] Refatorar worker Python para escutar BullMQ (usando `redis-py` ou via endpoint Fastify).
- [x] Garantir que o Python runtime reporte progresso de volta para a API (Webhooks / HTTP callback).
- [x] Migração dos scripts standalone (`lead_hunter.py`, `conversational_agent.py`) para classes modulares baseadas em LangChain/CrewAI.
- [x] Definir modelo estrito de Payload JSON de ida e volta.

---

## Arco 2: Verificação Final (Para Concluir Arco 2)

- [x] Todos os testes unitários do domínio rodam? (`npm run test:domain`)
- [x] A API liga sem erros locais? (`npm run dev`)
- [x] O Swagger/OpenAPI reflete as rotas de Leads e Deals corretamente?
- [x] O RLS do Supabase (ou local Drizzle) está blindando acesso a Leads de outros agentes?
- [x] O agent-runtime levanta e se conecta ao Redis do BullMQ?
- [x] Os jobs de HITL timeout estão funcionando?
- [x] O Acceptance Clickwrap gera um log com hash imutável?
- [x] Pricing Engine lança exceção em desconto > 50% sem HITL High Severity?
- [x] PricingConfigRepository implementado? (Using Hardcoded MVP defaults)
- [x] Rota `POST /api/v1/deals/:id/quote` integrada com Repositories?
- [x] Loki/Promtail recebendo logs de todos os containers?

---

## Arco 3: Funcionalidades Ausentes e Simplificação (NOVO)

Este arco engloba as fases identificadas pela Auditoria Cirúrgica (ADR-005, PRD e features de negócio não mapeadas).

### Fase 16: Auth Refactor Completo

> Objetivo: Implementar os fluxos de criação de conta, verificação de email e reset de senha para o operador, garantindo a gestão do ciclo de vida da conta. _(Ref: `auth-refactor.md`)_

- [x] Criar UseCase `RegisterOperator.ts` (hash de senha + criação de usuário inativo).
- [x] Implementar envio de e-mail de verificação (Token temporário 24h).
- [x] Criar rota `POST /api/v1/auth/verify-email`.
- [x] Implementar fluxo de "Esqueci minha senha" (geração de token).
- [x] Criar rota `POST /api/v1/auth/reset-password`.
- [x] Criar páginas no Frontend (Next.js): `/register`, `/verify-email`, `/forgot-password`, `/reset-password`.
- [x] Testes de integração (verificar expiração de token e tentativas limitadas).

### Fase 17: Prospecção via CNPJ

> Objetivo: Expandir as capacidades do Hunter Agent para prospectar ativamente empresas baseadas em dados da Receita Federal / APIs do governo (MCP Brasil).

- [x] Configurar conexão com o MCP Brasil (`TRANSPARENCIA_API_KEY`).
- [x] Modificar Schema Drizzle de `Leads` para incluir `cnpj` (VARCHAR) e `company_data` (JSONB).
- [x] Criar nova Skill Python no `agent-runtime`: `cnpj_lookup.py` (busca inicial).
- [x] Criar nova Skill Python: `cnpj_enricher.py` (buscar sócios, capital social, cnae).
- [x] Atualizar o prompt do Hunter Agent para utilizar essas skills quando o alvo for B2B no Brasil.

### Fase 18: Integração com Telegram

> Objetivo: Implementar o canal Telegram para Alertas Críticos (Operador) e como canal alternativo de Prospecção/Comunicação.

- [x] Adicionar variáveis `TELEGRAM_BOT_TOKEN` e `TELEGRAM_CHAT_ID` ao `.env` e validadores de config.
- [x] Criar infraestrutura `TelegramAdapter.ts` na API (implementando uma interface comum de notificação).
- [x] Modificar `HITLExpirationWorker.ts` e serviços de notificação para despachar mensagens via Telegram.
- [x] Atualizar Enum `MessageChannel` (ou equivalente) no BD para suportar `TELEGRAM` nas mensagens de Leads.
- [x] Adicionar botões/comandos de aprovação inline no Telegram (opcional para o MVP, mas planejado).

### Fase 19: Simplificação da Infraestrutura (Localhost-First)

> Objetivo: Remover a complexidade prematura de deploy em Vercel+Railway para um MVP single-user, priorizando a estabilidade local via Docker Compose.

- [x] Atualizar `ADR-005` confirmando a estratégia Localhost-First (ou VPS única com Coolify).
- [x] Remover ou arquivar `railway.toml`.
- [x] Ajustar `Dockerfile.api` para garantir que foca apenas na execução limpa via Docker Compose, removendo configs específicas do Cloud Run (se não usadas).
- [x] Atualizar `deploy.yml` para refletir o novo modelo (ou desativar os placeholders se não houver deploy cloud imediato).
- [x] Documentar o fluxo de "Subir tudo com 1 comando" (`docker-compose up`) de forma cristalina no `README.md`.

---

## Arco 4: Settings Hub — Configuração via UI (Fases 20-21)

> Este arco implementa o painel de configurações completo na UI, eliminando a necessidade do operador editar manualmente arquivos `.env`. _(Ref: `settings-hub-plan.md`)_

### Fase 20: Settings Hub Core — Backend + Frontend

> Objetivo: Criar toda a infraestrutura de persistência, criptografia e API para settings configuráveis via UI, e o frontend com tabs de configuração.

#### 20.1 — Schema e Migration

- [x] Adicionar tabela `system_settings` ao `schema.ts` (uuid, operator_id FK, category, key, value, is_secret, is_active, metadata JSONB, timestamps).
- [x] Criar migration Drizzle para `system_settings`.
- [x] Adicionar constraint `UNIQUE(operator_id, key)` e index `(operator_id, category)`.

#### 20.2 — Criptografia de Secrets (AES-256-GCM)

- [x] Criar `SettingsCrypto.ts` com `encrypt(plaintext)` e `decrypt(ciphertext)`.
- [x] Usar AES-256-GCM com IV aleatório, derivando key de `SETTINGS_ENCRYPTION_KEY` (env).
- [x] Adicionar `SETTINGS_ENCRYPTION_KEY` ao `config.ts` (Zod, obrigatório) e `.env.example`.
- [x] Testes unitários para encrypt/decrypt roundtrip + tamper detection.

#### 20.3 — Repository de Settings

- [x] Criar `DrizzleSettingsRepository.ts` com: `upsert(operatorId, key, value, opts)`, `getByKey(operatorId, key)`, `listByCategory(operatorId, category)`, `listAll(operatorId)`, `delete(operatorId, key)`.
- [x] Secrets são criptografados antes do INSERT e decriptografados no SELECT.
- [x] Testes de integração (upsert idempotente, mascaramento de secrets no response).

#### 20.4 — CompositeSecretsProvider (DB-first + ENV fallback)

- [x] Criar `CompositeSecretsProvider.ts` implementando `SecretsProvider`.
- [x] Fluxo: `try DB (decrypt) → fallback process.env → throw if required`.
- [x] Cache in-memory com TTL de 60s para evitar queries repetidas.
- [x] Testes unitários: DB hit, ENV fallback, cache invalidation.

#### 20.5 — SettingsService (Application Layer)

- [x] Criar `SettingsService.ts` com lógica de negócio: validação por categoria, mascaramento de secrets no response (`sk-****xxxx`), e merge com defaults.
- [x] Método `testConnection(category, key)` — testa conectividade real com o serviço (LLM ping, Telegram getMe, SMTP verify, etc.).
- [x] Testes unitários com mocks.

#### 20.6 — API Routes (`settings.routes.ts`)

- [x] `GET /api/v1/settings` — lista todas (secrets mascarados).
- [x] `GET /api/v1/settings/:category` — filtra por categoria.
- [x] `PUT /api/v1/settings` — upsert em lote (`{ settings: [{ key, value, category, is_secret }] }`).
- [x] `DELETE /api/v1/settings/:key` — remove uma configuração.
- [x] `POST /api/v1/settings/test-connection` — testa conectividade do serviço.
- [x] Criar Zod schemas de validação em `settings.schemas.ts`.
- [x] Todas as rotas protegidas por JWT (operador autenticado).

#### 20.7 — Atualizar Container e Config

- [x] Refatorar `container.ts`: trocar `EnvSecretsAdapter` por `CompositeSecretsProvider`.
- [x] Registrar `SettingsService`, `DrizzleSettingsRepository`, `SettingsCrypto` no container.
- [x] Registrar rotas de settings em `app.ts`.
- [x] Verificar que LLM, WhatsApp, Email e Telegram adapters agora resolvem credenciais via `CompositeSecretsProvider`.

#### 20.8 — Ollama Docker Sidecar

- [x] Adicionar service `ollama` no `docker-compose.yml` (image: `ollama/ollama`, GPU passthrough opcional, volume persistente).
- [x] Configurar health check (`/api/tags`).
- [x] Atualizar `OllamaAdapter.ts` para apontar para `http://ollama:11434` via `OLLAMA_BASE_URL` env quando em Docker.

#### 20.9 — OllamaProxyService

- [x] Criar `OllamaProxyService.ts` que proxya comandos para o Ollama container.
- [x] Endpoints: `listModels()`, `pullModel(name)` (SSE streaming), `deleteModel(name)`, `getStatus()`.
- [x] Adicionar rotas Ollama em `settings.routes.ts` (`/api/v1/settings/ollama/*`).
- [x] Testes de integração (mock do Ollama API).

#### 20.10 — Frontend: Settings Store (Zustand)

- [x] Criar `settings-store.ts` com: `fetchSettings()`, `updateSettings(batch)`, `testConnection(category, key)`.
- [x] Criar `ollama-store.ts` com: `fetchModels()`, `pullModel()`, `deleteModel()`, `fetchStatus()`.
- [x] Tipagens TypeScript alinhadas com o backend (`SettingCategory`, `SettingEntry`).

#### 20.11 — Frontend: Tab AI Providers

- [x] Reescrever `settings/page.tsx` com layout de tabs (Tabs component do shadcn/ui).
- [x] Criar `AIProvidersTab.tsx`: cards para OpenAI, Anthropic, Google, Groq com inputs de API Key (mascarados), selector de modelo default, toggle de ativação, botão [Test].
- [x] Criar `OllamaManager.tsx`: status do container, lista de modelos, botão [Pull], progress de download, botão [Remove].
- [x] Seção "Agent ↔ Provider Assignment": tabela editável (Agent → Provider dropdown → Model dropdown).

#### 20.12 — Frontend: Tab Messaging

- [x] Criar `MessagingTab.tsx`: cards para WhatsApp (Evolution API URL, API Key, Instance), Email (Brevo API Key, From Name, From Address), Telegram (Bot Token, Chat ID).
- [x] Cada card com botão [Test Connection] e indicador de status (🟢/🔴).

#### 20.13 — Frontend: Tab Integrations

- [x] Criar `IntegrationsTab.tsx`: cards para MCP Brasil (3 API keys), Webhooks (URL + Secret), ChromaDB (URL).
- [x] Cada card com botão [Test Connection].

#### 20.14 — Frontend: Tab System + Components Compartilhados

- [x] Criar `SystemTab.tsx`: HITL Timeout config, Max Body Size, Export/Import settings (JSON).
- [x] Criar `SecretInput.tsx`: input com toggle de visibilidade, auto-mascaramento, copy-to-clipboard.
- [x] Responsividade mobile para todas as tabs.

#### 20.15 — Testes E2E e Validação

- [ ] Teste E2E: operador configura API Key do OpenAI via UI → agente usa essa key para LLM call.
- [ ] Teste E2E: operador puxa modelo Ollama via UI → modelo aparece na lista.
- [ ] Teste E2E: operador configura Telegram Bot Token → envia mensagem de teste com sucesso.
- [ ] Teste de segurança: API nunca retorna secret em plaintext (somente mascarado).
- [ ] Teste de segurança: secrets são criptografados no DB (verificar diretamente no PostgreSQL).

---

### Verificação Final do Arco 4

- [x] Settings page renderiza com 4 tabs funcionais?
- [x] API Keys são criptografadas no banco e mascaradas no response?
- [x] `CompositeSecretsProvider` faz fallback correto para ENV?
- [x] Ollama está no docker-compose e gerenciável pela UI?
- [x] Botões de [Test Connection] funcionam para todos os serviços?
- [x] Operador NÃO precisa editar `.env` para configurar AI/Messaging/Integrations?

---

## Próximos Passos (Imediatos)

1. **Testes E2E Settings Hub**: Iniciar containers com `docker compose -f infra/docker-compose.yml up -d`, abrir `/settings` e testar todas as abas.
2. **Testes 20.15**: Implementar testes E2E Playwright para o fluxo de configurações.
3. **Arco 5**: Iniciar a implementação do *Skill Registry* no `agent-runtime`.

---

## Arco 5: Agentic Architecture Integration (Fases 22-25) - 🚧 EM ANDAMENTO

> Este arco implementa os padrões arquiteturais extraídos da auditoria de projetos open-source e das diretrizes oficiais da Anthropic ("Building Effective Agents" e "Managed Agents"). Foco em transparência, simplicidade (redução de frameworks complexos) e ACI (Agent-Computer Interface) rigorosa. _(Ref: `docs/architectural_analysis_agents.md`)_

### Fase 22: Auditoria e Planejamento Arquitetural - ✅ CONCLUÍDO

- [x] Analisar projetos referência (`goose-skills`, `agency-agents`, `opensquad`, `paperclip`, `hermes-agent`, `claude-code`, `mcp-brasil`).
- [x] Extrair padrões aplicáveis ao ecossistema DDD/Hexagonal do ProspectFlow.
- [x] Documentar findings e action plan em `docs/architectural_analysis_agents.md`.
- [x] Incorporar padrões "Anthropic Effective Agents" (Desacoplamento Cérebro/Mãos, State-Driven Loops, e Poka-yoke em tools).

### Fase 23: Skill Registry & Metadata Contract - ✅ CONCLUÍDO

> Objetivo: Padronizar a criação e injeção de tools (capabilities, composites, playbooks) via um contrato estrito de metadados (`skill.meta.json`). Alinhado ao conceito de "Agent Skills" (Anthropic).

- [x] Definir o schema base (`skill.meta.json`) para skills suportadas.
- [x] Criar o `LocalFileSystemSkillRegistry` no `agent-runtime` para carregar dinamicamente as skills.
- [x] Refatorar skills existentes (`cnpj_lookup`, `cnpj_enricher`) para adotar o novo contrato.

### Fase 24: Pivot Arquitetural & HITL Orchestration (O "Desbloqueio")

> Objetivo: Substituir a complexidade opaca do CrewAI por um loop de execução focado em Estado (LangGraph ou LLM Tool Calling puro) para viabilizar "Checkpoints" reais (suspensão e reidratação de estado) exigidos pelo HITL via Telegram. _Baseado no padrão "Managed Agents: wake(sessionId)"._

- [ ] **Desidratação de Framework:** Remover a dependência pesada do `CrewAI` no `base.py`. Transicionar para um *Event-Driven Loop* (LangGraph) ou orquestrador simples focado em Tool Calling para garantir total transparência ("showing planning steps").
- [ ] Implementar a capacidade de Suspensão de Estado Real: quando o agente chamar uma tool crítica, o estado salva no Redis e o worker hiberna (HITL).
- [ ] Conectar os Checkpoints de estado aos eventos do Telegram Adapter (retomando o estado via `wake(session_id)` após o clique).
- [ ] Migrar prompts dos agentes (Hunter, Closer, Builder) para o formato Markdown extensivo (`docs/agents/personas/`), tratando "Prompts as Code".

### Fase 25: MCP Ecosystem & Agent-Computer Interface (ACI)

> Objetivo: Configurar o acesso aos dados abertos via MCP Brasil e integrar ao Hunter. Foco intenso em "Prompt Engineering your Tools" (Poka-yoke e documentação estrita de *tools*) conforme a Anthropic exige.

- [ ] Adicionar `mcp-brasil` ao `mcp_config.json` e garantir inicialização automática.
- [ ] Criar ferramentas wrapper no `agent-runtime` para as queries do MCP Brasil (Receita, Portal da Transparência) aplicando as melhores práticas de **ACI**: *docstrings* perfeitas, limites de contexto, sumários de dados longos (Context Trimming) e tratamento estrito de exceções.
- [ ] Atualizar o prompt (Markdown) do Hunter Agent para utilizar essa pipeline nativamente durante as pesquisas B2B.
