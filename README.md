# AgentePro 🤖

> **Status:** Sprints S5-07 a S5-10 entregues — MVP v1 funcional em localhost.
> Branch de integração: `develop` → `main` via PR com CI obrigatório.

> _"E se o seu melhor vendedor nunca dormisse, falasse todos os idiomas e qualificasse mil leads antes do seu café da manhã?"_ ☕

O **AgentePro** automatiza o ciclo completo de uma agência digital: da prospecção de leads ao site entregue ao cliente, com custo operacional de ~$1.59 USD por site e margem superior a 99%.

---

## Pipeline End-to-End

```
Google Maps / MCP Brasil
        │
    [Hunter] ─── qualifica leads → HITL aprovação (Telegram)
        │
    [Closer] ─── WhatsApp / Telegram / Email → deal fechado
        │
    [Briefing] ── entrevista conversacional WhatsApp → JSON estruturado
                  → HITL aprovação do briefing
        │
    [Builder]
    │  Fase 1 — paralelo:
    │    COPYWRITER (textos) + DESIGNER (mockup visual) + IMAGER (prompts de imagem)
    │    → HITL APPROVE_MOCKUP — operador vê preview antes de uma linha de HTML
    │
    │  Fase 2 — sequencial (após aprovação do mockup):
    │    CODER (HTML/CSS final) → SEO_OPTIMIZER + DEPLOYER (staging)
    │    → HITL APPROVE_STAGING
        │
      [QA] ──── SEC_AUDITOR + PERF_AUDITOR + CONTENT_CHECK (em paralelo)
        │
  [Delivery] ── TUTORIAL_GENERATOR (HeyGen) + DOC_GENERATOR (PDF) em paralelo
              → NOTIFIER (WhatsApp + Email + Telegram ao cliente)
              → follow-up automático: 7 dias + NPS 30 dias
```

O operador controla tudo via **HITL inline no Telegram** — aprovações e rejeições com botões, sem abrir o painel web.

---

## Arquitetura

### Runtimes

```
monorepo (npm workspaces + Turborepo)
├── apps/api            Node.js 22 + Fastify 5 + Drizzle ORM + BullMQ
├── apps/web            Next.js 16 + React 19 + Tailwind 4 + shadcn/ui
├── apps/agent-runtime  Python 3.12 + CrewAI + LiteLLM + FastAPI
└── packages/shared-types  Tipos/enums TS compartilhados
```

### Camadas da API (Hexagonal)

```
http → application → domain ← infrastructure
```

### Infra local (Docker)

PostgreSQL 16 · Redis 7 · ChromaDB · Ollama · n8n · Prometheus · Grafana · Jaeger · Loki · Promtail

### LLM por sub-agente (PRD v2 §9)

| Tier | Custo/1k tokens | Modelo                          | Sub-agentes                                     |
| ---- | --------------- | ------------------------------- | ----------------------------------------------- |
| 0    | $0.00           | Ollama Llama 3.2 3B             | Orchestrator, DATA_ENRICHER, DEAL_TRACKER       |
| 1–2  | ~$0.003         | Gemini Flash / Claude Haiku 4.5 | PROSPECTOR, SEO_OPTIMIZER, DEPLOYER, QA         |
| 3    | ~$0.015         | Claude Sonnet 4.6               | OUTREACH, CONV_HANDLER, COPYWRITER, INTERVIEWER |
| 4a   | ~$0.025         | Claude Opus 4.8                 | CODER, SEC_AUDITOR                              |
| 4b   | ~$0.025         | Claude Opus 4.7 Design          | DESIGNER (mockup visual)                        |

---

## Segurança

- **JWT RS256 + Argon2id** — tokens de curta duração, rotação de refresh token
- **Magic bytes** validados em uploads E em todos os retornos de mídia gerada por IA
- **SSRF prevention** em toda URL de configuração externa
- **RBAC/IDOR** — operador A nunca vê dados do operador B
- **Rate limiting** em endpoints públicos
- **HITL obrigatório** antes de qualquer envio externo ou deploy em produção

---

## Observabilidade

| Ferramenta | URL local              | Para que serve                                                       |
| ---------- | ---------------------- | -------------------------------------------------------------------- |
| Grafana    | http://localhost:3333  | 6 dashboards: pipeline, agentes, HITL, qualidade, mensageria, custos |
| Jaeger     | http://localhost:16686 | Distributed tracing (OpenTelemetry)                                  |
| Prometheus | http://localhost:9090  | Métricas da API e do agent runtime                                   |
| Loki       | http://localhost:3100  | Logs centralizados via Promtail                                      |

---

## Guia de Instalação

### Requisitos obrigatórios

| Ferramenta     | Versão                 | Link               |
| -------------- | ---------------------- | ------------------ |
| Node.js        | ≥ 22 LTS               | https://nodejs.org |
| Docker Desktop | ≥ 4.x (com Compose v2) | https://docker.com |
| Python         | ≥ 3.12                 | https://python.org |

### Passo 1 — Clonar e instalar dependências

```bash
git clone <url-do-repositorio>
cd ProspectFlow_AI
npm install
```

### Passo 2 — Configurar o `.env`

```bash
cp .env.example .env
```

Edite `.env` com seus valores reais. Veja as seções abaixo.

#### Variáveis obrigatórias

| Variável            | Como obter                                      |
| ------------------- | ----------------------------------------------- |
| `JWT_PRIVATE_KEY`   | Ver seção [Configuração JWT](#configuração-jwt) |
| `JWT_PUBLIC_KEY`    | Ver seção [Configuração JWT](#configuração-jwt) |
| `DATABASE_URL`      | Já preenchido para Docker local                 |
| `REDIS_URL`         | Já preenchido para Docker local                 |
| `AGENT_RUNTIME_URL` | Já preenchido (`http://localhost:8001`)         |

#### Pelo menos 1 provedor LLM (obrigatório)

| Variável            | Provedor                      |
| ------------------- | ----------------------------- |
| `ANTHROPIC_API_KEY` | https://console.anthropic.com |
| `OPENAI_API_KEY`    | https://platform.openai.com   |
| `GEMINI_API_KEY`    | https://aistudio.google.com   |

#### Integrações opcionais

| Variável                                  | Funcionalidade                                   |
| ----------------------------------------- | ------------------------------------------------ |
| `TELEGRAM_BOT_TOKEN`                      | HITL inline com botões no Telegram               |
| `EVOLUTION_API_URL` + `EVOLUTION_API_KEY` | Canal WhatsApp via Evolution API                 |
| `GOOGLE_MAPS_API_KEY`                     | Prospecção por categoria e região                |
| `CALCOM_API_KEY`                          | Agendamento de reuniões (Cal.com)                |
| `HEYGEN_API_KEY`                          | Tutoriais em vídeo personalizados para clientes  |
| `SETTINGS_ENCRYPTION_KEY`                 | Criptografia de credenciais armazenadas no banco |

### Passo 3 — Verificar pré-requisitos

```bash
npm run check
```

Valida: Node.js ≥ 22, Docker em execução, Python 3.12+, `.env` preenchido corretamente, chaves JWT válidas, e pelo menos 1 LLM configurado.

### Passo 4 — Iniciar o sistema

```bash
npm run init
```

O inicializador executa automaticamente:

1. Valida Docker e `.env` (aborta com diagnóstico se algo estiver errado)
2. Sobe todos os containers Docker em background
3. Aguarda PostgreSQL ficar pronto (healthcheck com polling de 2s × 30)
4. Aplica migrations de banco de dados
5. Inicia todos os dev servers via Turbo
6. Exibe as URLs de acesso

### Passo 5 — Acessar o sistema

| Serviço          | URL                        |
| ---------------- | -------------------------- |
| 💻 Dashboard CRM | http://localhost:3000      |
| ⚙️ API Fastify   | http://localhost:3001      |
| 🤖 Agent Runtime | http://localhost:8001/docs |
| 📊 Grafana       | http://localhost:3333      |
| 🔍 Jaeger UI     | http://localhost:16686     |

---

## Comandos do Inicializador

Todos os comandos rodam na raiz do projeto:

```bash
npm run init       # Inicia todo o sistema (Docker + migrations + dev servers)
npm run stop       # Para containers Docker com segurança (dados preservados nos volumes)
npm run restart    # Para e reinicia tudo
npm run check      # Valida pré-requisitos sem iniciar nada (ideal para diagnóstico)
npm run status     # Mostra containers e portas em tempo real
npm run dev        # Apenas dev servers, sem subir infra (use quando Docker já está rodando)
```

### Exemplo: `npm run check`

```
──────────────────────────────────────────────────────────────────────
  AgentePro — Verificação de Pré-Requisitos
──────────────────────────────────────────────────────────────────────

[1/7] Node.js
[✔]    Node.js v22.14.0

[2/7] Docker
[✔]    Docker version 27.x.x, build xxxxxxx
[✔]    Docker Compose version v2.x.x

[3/7] Python
[✔]    Python 3.12.7

[4/7] Arquivo .env
[✔]    .env encontrado e carregado.

[5/7] Variáveis obrigatórias
[✔]    DATABASE_URL = postgresql://agentepro:...
[✔]    JWT_PRIVATE_KEY = -----BEGIN PRIVATE KE...

[6/7] Provedores LLM
[✔]    LLMs ativos: Anthropic, Google

[7/7] Integrações opcionais
[✔]    TELEGRAM_BOT_TOKEN — HITL Telegram
[AVISO] CALCOM_API_KEY — Agendamento Cal.com (não configurado)

[✔]    Todos os pré-requisitos críticos satisfeitos. Pronto para: npm run init
```

### Exemplo: `npm run stop`

```bash
npm run stop
# [✔]    Containers parados. Dados preservados nos volumes Docker.

# Para destruir os dados completamente (reset total):
docker compose -f infra/docker-compose.yml down -v
```

### Exemplo: `npm run status`

```
  ●  Web (Next.js)          http://localhost:3000
  ●  API (Fastify)          http://localhost:3001
  ●  Agent Runtime          http://localhost:8001
  ●  PostgreSQL             http://localhost:5432
  ●  Redis                  http://localhost:6379
  ○  ChromaDB               (offline)
```

---

## Configuração JWT

Gere o par de chaves RSA e adicione ao `.env`:

```bash
# Gerar chave privada RSA 2048 bits
openssl genpkey -algorithm RSA -out jwt.key -pkeyopt rsa_keygen_bits:2048

# Extrair chave pública
openssl rsa -in jwt.key -pubout -out jwt.pub

# Ver para copiar (cole no .env com \n escapados)
cat jwt.key
cat jwt.pub
```

No `.env`:

```dotenv
JWT_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvgIBADA...\n-----END PRIVATE KEY-----"
JWT_PUBLIC_KEY="-----BEGIN PUBLIC KEY-----\nMIIBIjANBg...\n-----END PUBLIC KEY-----"
```

---

## Testes

```bash
# Unitários de domínio — rápido, sem Docker
npm run test:unit -w @agentepro/api

# Integração com Testcontainers — requer Docker
npm run test:integration -w @agentepro/api

# Segurança (bypass, injection, autenticação)
npm run test:security -w @agentepro/api

# Python — orchestrator, builder, agentes, LLM routing
cd apps/agent-runtime && python -m pytest tests/ -v

# E2E Playwright — requer sistema rodando (npm run init)
cd apps/web && npx playwright test
```

**CI (GitHub Actions):** Lint ✅ · Typecheck ✅ · Unit Tests (102) ✅ · Build ✅ · Agent Runtime ✅
E2E: `continue-on-error` — ver [roadmap](#limitações-e-roadmap).

---

## Limitações e Roadmap

### 1. Orchestrator sem persistência de estado entre restarts

**Situação atual:** O `OrchestratorAgent` (Python) armazena `retry_counts` em memória. Um restart do processo limpa o histórico de tentativas dos estados `BUILDING`, `DESIGNING` e `QA`.

**Impacto:** Após restart, o Orchestrator pode tentar mais vezes do que o limite definido (3x para BUILDING, 2x para DESIGNING). Aceitável no MVP onde restarts são raros.

**Solução planejada (sem nova infra):** Persistir o estado em Redis (já presente na stack) com TTL de 24h:

```python
# apps/agent-runtime/src/agents/orchestrator/agent.py
async def record_retry(self, state_name: str) -> None:
    key = f"orchestrator:{self.payload.get('project_id', self.agent_id)}"
    async with aioredis.from_url(self.redis_url) as r:
        await r.hincrby(key, state_name, 1)
        await r.expire(key, 86400)  # auto-limpa após 24h

async def can_retry(self, state_name: str) -> bool:
    key = f"orchestrator:{self.payload.get('project_id', self.agent_id)}"
    async with aioredis.from_url(self.redis_url) as r:
        count = int(await r.hget(key, state_name) or 0)
    return count < _RETRY_LIMITS.get(state_name, 999)
```

### 2. E2E tests não bloqueiam CI

**Situação atual:** O job `test-e2e` usa `continue-on-error: true` porque a stack completa (API + DB + Redis + Web) não sobe nos runners do GitHub Actions.

**Solução planejada:** Usar `services:` nativos do GitHub Actions:

```yaml
# .github/workflows/ci.yml
test-e2e:
  services:
    postgres:
      image: postgres:16-alpine
      env:
        {
          POSTGRES_USER: test,
          POSTGRES_PASSWORD: test,
          POSTGRES_DB: agentepro_test,
        }
      options: --health-cmd pg_isready --health-interval 5s --health-retries 10
    redis:
      image: redis:7-alpine
      options: --health-cmd "redis-cli ping" --health-interval 5s
  steps:
    - run: npm run db:migrate
    - run: npm run dev &
    - run: npx wait-on http://localhost:3001/api/v1/health
    - run: npx playwright test
```

Resultado: remove `continue-on-error`, E2E bloqueia merge em falha. Custo: ~3 minutos a mais por run.

---

## Estrutura de Diretórios

```
apps/
  api/src/
    domain/         Entidades, Value Objects, Events, Ports (interfaces)
    application/    Use Cases, Commands, Queries, Handlers
    infrastructure/ DB (Drizzle), Queue (BullMQ), LLM router, Deploy, Metrics
    http/           Routes, Middleware, Schemas (Fastify)
  agent-runtime/src/
    agents/         orchestrator/ hunter/ closer/ briefing/ builder/ qa/ delivery/
    config/         llm_routing.py — mapa de 24 sub-agentes para modelos LLM
    skills/         google_maps, cnpj_lookup, email_sender, whatsapp_sender...
    rag/            ChromaDB + Ollama nomic-embed-text
  web/src/
    app/            Next.js App Router — (dashboard)/ e (auth)/
    components/     shadcn/ui + PaginationControls + componentes customizados
    hooks/          usePagination, useAuthStore
    lib/            api client, stores (Zustand)
infra/
  docker-compose.yml      Stack local completa
  grafana/dashboards/     6 dashboards JSON provisionados
scripts/
  init.js                 Inicializador (start | stop | restart | check | status)
docs/
  PRD_AgentePro_v2.md     Product Requirements Document (fonte da verdade)
  adr/                    Architecture Decision Records
  specs/                  Especificações por módulo (00–11)
```

---

## Licença

Copyright (c) 2026 AgentePro / ProspectFlow AI — Licença Proprietária de Uso Restrito.

**Permitido:** Usar o sistema para automatizar as suas próprias vendas e prospecção de clientes.

**Proibido:** Vender, alugar, distribuir o código ou oferecê-lo como SaaS para terceiros sem autorização explícita e prévia.
