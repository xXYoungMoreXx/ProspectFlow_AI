# Hefesto 🔨

> **Você é o artífice. Os agentes são seus autômatos. A forja nunca para.**

_Hefesto, o deus ferreiro, forjava autômatos de ouro que trabalhavam sozinhos.
Você acende a forja uma vez — os **Autômatos** cuidam do resto: prospecção,
contato, fechamento e entrega do serviço. Automação séria, código aberto, com
você no controle do quanto quer intervir. Sem promessa de enriquecimento rápido._

> 📖 **Identidade de marca:** [BRAND.md](BRAND.md) · **Arquitetura:** [ARCHITECTURE.md](ARCHITECTURE.md) · **Setup detalhado:** [SETUP.md](SETUP.md) · **Lançamento:** [LAUNCH.md](LAUNCH.md)

> **Status (2026-06-12):** Sprints S5–S11 + Agent Capability Studio entregues; correções E2E B1–B5 aplicadas
> (deploy real Vercel/Netlify, mensageria outbound, prompts Builder 2026). MVP v1 funcional em localhost —
> pendências para produção na seção [Limitações e Roadmap](#limitações-e-roadmap).
> Branch de integração: `develop` → `main` via PR com CI obrigatório.

---

## O que é a Forja?

O **Hefesto** automatiza o ciclo completo de uma agência digital — da prospecção
de leads ao site entregue ao cliente — com custo operacional de ~$1.59 USD por
site e margem superior a 99%. Quatro peças, todas com nome no mito:

- **A Fornalha** (`apps/api`) — o motor que orquestra, valida e enfileira o trabalho.
- **Os Autômatos** (`apps/agent-runtime`) — os agentes de IA: Hunter, Closer,
  Briefing, Builder, QA, Delivery.
- **A Bigorna** (`apps/web`) — o painel onde você observa a forja e acompanha tudo.
- **A Mão do Artífice** (HITL) — você aprova antes de cada envio externo ou deploy.

> "A Fornalha processa. Os Autômatos agem. Você colhe."

---

## Rodar localmente (local-first)

Cada usuário roda o **backend na própria máquina** — não há hospedagem paga nem
necessidade de expor a máquina via túnel. A interface web pode opcionalmente ser
servida pela Vercel apenas como página de onboarding; o app de fato roda local.

**Pré-requisitos:** Docker Desktop + Node 22.

```bash
cp .env.example .env.local          # 1. configure (mantenha APP_MODE=local)
docker compose -f infra/docker-compose.yml up -d   # 2. Postgres, Redis, etc.
npm install                          # 3. dependências
npm run dev                          # 4. sobe API (3001) + web (3000)
```

Abra <http://localhost:3000>. Com `NEXT_PUBLIC_APP_MODE=local`, a web te **guia**:

- **Backend desligado** → tela com os comandos acima e botão “Tentar de novo”.
- **Primeira execução** → tela cria o **admin local** (e-mail + senha, sem SMTP)
  e já te autentica. O login usa token Bearer emitido pela sua API local.
- **Execuções seguintes** → login normal e-mail/senha (ou auto-login opt-in via
  `NEXT_PUBLIC_DEV_AUTO_LOGIN=true`).

> Em produção gerenciada, defina `APP_MODE=cloud` para desativar o `local-login`
> e exigir verificação de e-mail completa.

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

| Variável                                  | Funcionalidade                                                                                                     |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `TELEGRAM_BOT_TOKEN`                      | HITL inline com botões no Telegram                                                                                 |
| `EVOLUTION_API_URL` + `EVOLUTION_API_KEY` | Canal WhatsApp via Evolution API                                                                                   |
| `GOOGLE_MAPS_API_KEY`                     | Prospecção por categoria e região                                                                                  |
| `CALCOM_API_KEY`                          | Agendamento de reuniões (Cal.com)                                                                                  |
| `HEYGEN_API_KEY`                          | Tutoriais em vídeo personalizados para clientes                                                                    |
| `SETTINGS_ENCRYPTION_KEY`                 | Criptografia de credenciais armazenadas no banco                                                                   |
| `VERCEL_TOKEN` / `NETLIFY_TOKEN`          | Deploy real dos sites gerados (fallback chain)                                                                     |
| `INTERNAL_API_TOKEN`                      | Secret das rotas internas `/api/v1/internal/*` — deve ser **idêntico** ao `API_TOKEN` em `apps/agent-runtime/.env` |

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
  Hefesto — Verificação de Pré-Requisitos
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
[✔]    DATABASE_URL = postgresql://hefesto:...
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
npm run test:unit -w @hefesto/api

# Integração com Testcontainers — requer Docker
npm run test:integration -w @hefesto/api

# Segurança (bypass, injection, autenticação)
npm run test:security -w @hefesto/api

# Python — orchestrator, builder, agentes, LLM routing
cd apps/agent-runtime && python -m pytest tests/ -v

# E2E Playwright — requer sistema rodando (npm run init)
cd apps/web && npx playwright test
```

**CI (GitHub Actions):** Lint ✅ · Typecheck ✅ · Testes Node (216) ✅ · Testes Python (81) ✅ · Build ✅ · E2E Playwright ✅ (bloqueante — roda com Postgres/Redis como `services` do Actions)

---

## Limitações e Roadmap

> Resolvidos em versões anteriores: persistência de retries do Orchestrator em Redis (antes era em memória)
> e E2E bloqueante no CI (antes `continue-on-error`).

### 1. Preencher chaves reais no `.env` (bloqueia o ciclo completo)

O código está pronto, mas estas integrações só funcionam com as chaves do operador:
`GOOGLE_MAPS_API_KEY` (prospecção), `VERCEL_TOKEN` e/ou `NETLIFY_TOKEN` (deploy real do site),
`EVOLUTION_API_*` (WhatsApp), `BREVO_API_KEY` (email). Sem elas, cada etapa retorna **erro explícito**
(nunca sucesso simulado).

> Também resolvidos (2026-06-12): Cloudflare Pages com Direct Upload real (fallback chain completa
> Vercel → CF → Render → Netlify), imagens do IMAGER geradas automaticamente no APPROVE_MOCKUP e
> incluídas no site/deploy, e secret do aceite de contrato alinhado (`JWT_SECRET ?? INTERNAL_API_TOKEN`).

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
    config/         llm_routing.py — mapa de 22 sub-agentes para modelos LLM
    skills/         places_search, cnpj_lookup, email_sender, whatsapp_sender, site_generator...
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
specs/                    Especificações por módulo (00–14)
docs/
  PRD_Hefesto_v2.md     Product Requirements Document (fonte da verdade)
  adr/                    Architecture Decision Records
```

---

## Tiers de poder (poder de forja)

Modelo de **núcleo aberto e gratuito** (código-fonte público e auditável, sob
licença de uso não-comercial): o núcleo é livre e o "poder de forja" — quantos
Autômatos trabalham em paralelo — escala por tier.

| Tier             | Poder de forja                          | Para quem                               |
| ---------------- | --------------------------------------- | --------------------------------------- |
| **Forja Aberta** | 1 Autômato por vez · self-host completo | Quem quer rodar tudo na própria máquina |
| **Bronze**       | Múltiplos Autômatos em paralelo         | Operador solo escalando o funil         |
| **Ouro**         | Paralelismo ampliado + suporte          | Agência com volume                      |

> O tier gratuito (Forja Aberta) já entrega o ciclo completo. Os tiers pagos
> amplificam a escala — nunca destravam "a única forma de funcionar".
> Licença: código aberto e auditável sob uso não-comercial — ver [Licença](#licença).

---

## Conformidade (LGPD e outreach ético)

O Hefesto foi desenhado para prospecção **ética**:

- **Dados públicos / opt-in.** O Hunter trabalha com dados públicos (ex.: Google
  Maps, CNPJ) — o produto **não** promove envio em massa nem listas compradas.
- **A Mão do Artífice é obrigatória** antes de qualquer envio externo: você revisa
  e aprova a abordagem. Nada sai da forja sem passar por um gate HITL configurável.
- **LGPD.** Trate os dados de leads conforme a Lei 13.709/2018: base legal
  adequada, finalidade clara, e canal de opt-out em toda comunicação. O e-mail de
  exemplo em `content/email/` já inclui `{{unsubscribe_link}}`.
- **Sem promessa de renda.** A comunicação posiciona o Hefesto como poder de
  automação, jamais como esquema de enriquecimento.

---

## Licença

Copyright (c) 2026 Hefesto / Hefesto AI — Licença Hefesto de Uso Não-Comercial
(código aberto e auditável, _source-available_). Não é uma licença OSI "open
source": o código é público e livre para usar e modificar, mas a revenda do
software é restrita. Ver [LICENSE](LICENSE).

**Permitido:** Usar e modificar o sistema para automatizar as suas próprias vendas e prospecção de clientes — inclusive comercialmente, nas suas operações.

**Proibido:** Vender, alugar ou distribuir o software como produto, ou oferecê-lo como SaaS a terceiros, sem autorização explícita e prévia.
