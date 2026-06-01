# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> Este arquivo é lido pelo agente de IA em **todo** prompt de código.
> Representa a lei do projeto — seguir sem exceção, sem criatividade própria.
> Última atualização: 2026-05-29 | Versão: 2.0.0

> **As seções 0-A e 0-B abaixo descrevem comandos e arquitetura reais do repositório.**
> **As seções numeradas 1+ são o charter de padrões de código — também obrigatório.**

---

## 0-A. COMANDOS DE DESENVOLVIMENTO

Monorepo npm workspaces + Turborepo. `node >= 22`, `npm@10.9.0`. Rode os comandos da raiz salvo indicação.

### Raiz (orquestra todos os workspaces via Turbo)

```bash
npm run init          # node scripts/init.js — bootstrap inicial do projeto
npm run dev           # turbo dev — sobe api (tsx watch) + web (next dev) em paralelo
npm run build         # turbo build — respeita o grafo de dependências (^build)
npm run lint          # turbo lint
npm run typecheck     # turbo typecheck
npm run test          # turbo test
npm run format        # prettier --write em todo o repo
```

### API (`apps/api`, Fastify + Drizzle)

```bash
npm run dev      -w @agentepro/api   # tsx watch src/server.ts
npm run test     -w @agentepro/api   # vitest run (toda a suíte)
npm run test:unit       -w @agentepro/api   # só src/domain
npm run test:integration -w @agentepro/api  # usa Testcontainers (Docker obrigatório)
npm run test:security    -w @agentepro/api  # tests/security/
npm run test:watch       -w @agentepro/api
npm run db:generate -w @agentepro/api   # drizzle-kit generate (gera migration do schema.ts)
npm run db:migrate  -w @agentepro/api   # aplica migrations
npm run db:studio   -w @agentepro/api   # Drizzle Studio
```

Rodar **um único teste**: `npx vitest run path/to/file.test.ts -t "nome do it/describe"` (dentro de `apps/api`).
Configs Vitest separadas: `vitest.config.ts` (unit), `vitest.integration.config.ts` (integration+security), `vitest.sentinel.config.ts`.

### Web (`apps/web`, Next.js 16 + React 19 + Tailwind 4)

```bash
npm run dev  -w @agentepro/web   # next dev
npm run build -w @agentepro/web
npx playwright test              # E2E (dentro de apps/web)
```

> ⚠️ `apps/web/AGENTS.md` avisa: esta versão do Next.js tem breaking changes vs. conhecimento prévio.
> Consultar `node_modules/next/dist/docs/` antes de escrever código de Next.

### Agent Runtime (`apps/agent-runtime`, Python 3.12 + CrewAI + FastAPI)

```bash
pip install -e ".[dev]"                     # instala deps + dev (pytest, ruff)
python -m src.main                          # sobe FastAPI (uvicorn, reload) em runtime_host:runtime_port
pytest                                      # asyncio_mode=auto, testpaths=tests
pytest tests/path/test_x.py::test_name      # um único teste
ruff check src                              # lint
ruff format src                             # format (line-length=120)
python scripts/seed_builder_rag.py          # popula ChromaDB com knowledge do Builder
```

### Infraestrutura local (`infra/docker-compose.yml`)

```bash
docker compose -f infra/docker-compose.yml up -d
```
Sobe: PostgreSQL 16 (5432), Redis 7 (6379), ChromaDB (8000), Ollama (11434), n8n (5678),
e a stack de observabilidade — Prometheus (9090), Grafana (3333), Jaeger (16686 UI / 4318 OTLP), Loki (3100), Promtail.

---

## 0-B. ARQUITETURA — VISÃO GERAL

### Três runtimes, um monorepo

```
apps/api            Node.js/Fastify — API pública, regras de negócio, orquestração, fila
apps/agent-runtime  Python/FastAPI  — runtime de agentes CrewAI (Hunter/Closer/Builder/QA)
apps/web            Next.js         — frontend (App Router, React Query, Zustand)
packages/shared-types  Tipos/enums/eventos TS compartilhados entre api e web (@agentepro/shared-types)
```

**Fluxo de uma tarefa de agente:** HTTP → `apps/api` valida (Zod) e enfileira na BullMQ (Redis) →
worker do api chama `apps/agent-runtime` `POST /tasks` (`task_type` = `domain.action`, ex. `hunter.search`) →
`main.py` despacha para `agents/<persona>/agent.py` + `tasks.py`, monta um `Crew` do CrewAI e executa →
resposta volta como `completed | failed | pending_hitl`. Aprovações HITL voltam via `POST /tasks/approve`.
LLM **sempre** via LiteLLM no Python e via `CompositeLLMRouter` (Anthropic/OpenAI/Google/Ollama) no Node — nunca SDK direto.

### Camadas da API (Clean/Hexagonal — ver seção 4 para a Dependency Rule)

```
apps/api/src/
  domain/         agent, deal, hitl, lead, pricing, project, shared  ← entidades, VOs, eventos, ports
  application/    use cases / handlers / serviços (CQRS)             ← orquestra domínio
  infrastructure/ db (Drizzle), llm, messaging, queue (BullMQ), rag (ChromaDB), secrets, deploy, metrics
  http/           routes, middleware, schemas (Fastify)
  app.ts          buildApp() — registra plugins, hooks, rotas e injeta o container
  container.ts    createContainer() — wiring de DI
  server.ts       entry point
```

> **⚠️ Discrepância importante doc × código:** a seção 15 deste charter manda usar **tsyringe**.
> O código atual **não usa tsyringe** — `container.ts` é uma factory manual (`createContainer()`)
> que instancia tudo na mão e devolve um objeto, exposto via `app.decorate("container", ...)`
> e resolvido nas rotas com `app.container.<dep>`. Siga o padrão **existente** (factory manual)
> ao tocar nesses arquivos; não introduza tsyringe sem alinhar com o time.

Rotas montadas em `app.ts` sob `/api/v1/*`: `auth`, `agents`, `leads`, `deals` (+ `deals.public`),
`projects`, `hitl`, `upload`, `settings`, `telegram` (webhook), `system`. Hooks globais: `requestId`
(correlationId por request), `ssrf` (preHandler), `errorHandler` (mapeia `DomainError.code` → HTTP, ver seção 7).
Workers iniciados no boot: `hitlWorker`, `emailWorker`, `agentExecutionService`.

### Agent Runtime (Python)

```
apps/agent-runtime/src/
  main.py        FastAPI: /health, /metrics (Prometheus), /tasks, /tasks/approve
  config.py      pydantic-settings
  agents/        base.py, state.py (AgentSessionManager), callbacks.py (RequiresApprovalException → HITL)
                 hunter/ closer/ builder/ qa/  (cada um: agent.py + tasks.py)
  skills/        registry.py + skills (places_search, cnpj_lookup, cnpj_enricher, site_generator,
                 web_search, email_sender, whatsapp_sender, contract_notifier, security_guard)
  rag/ + chroma_db/  ChromaDB para knowledge do Builder
```

HITL no runtime: uma skill que exige aprovação lança `RequiresApprovalException`; a task retorna
`pending_hitl`; o operador aprova no Node, que chama `/tasks/approve` liberando o `AgentSessionManager`.

### Persistência e migrations

Drizzle ORM sobre `postgres-js`. Schema único em `infrastructure/db/schema.ts`; migrations em
`infrastructure/db/migrations`. `drizzle.config.ts` lê `DATABASE_URL`. Sempre `db:generate` após mudar o
schema e revisar a migration (ver seção 18: nunca remover coluna sem migration de backup).

### Documentação de processo (Spec-Driven Development)

O fluxo de trabalho é guiado por documentos — leia na ordem antes de implementar:
`BUILD_ORDER.md` (grafo de dependências/ordem) → `context/phase_N.md` (estado da fase) →
`specs/NN_*.spec.md` (spec do módulo) → `tasks/phase_N_*.md` (tarefa atômica). `ENV.md` documenta variáveis
de ambiente; `TEST_STRATEGY.md`, a estratégia de testes; `docs/adr/`, decisões arquiteturais (ADRs).
`README.md` resume esse fluxo. (Veja também `GEMINI.md` para instruções de outro agente.)

---

## 1. IDENTIDADE DO PROJETO

```
Projeto:       AgentePro
Descrição:     Plataforma de agentes de IA para prospecção e entrega de sites
Stack API:     Node.js 22 LTS + TypeScript 5.5 + Fastify 5 + Drizzle ORM
Stack Agents:  Python 3.12 + CrewAI + LiteLLM
Stack Web:     Next.js 15 (App Router) + Tailwind CSS 4 + shadcn/ui
DB:            PostgreSQL 16 (Drizzle schema) + Redis 7 (BullMQ + Cache)
RAG:           ChromaDB + Ollama nomic-embed-text
Mensageria:    Evolution API (WhatsApp) + Telegram Bot API
```

---

## 2. VERSÕES FIXAS — NUNCA ATUALIZAR SEM APROVAÇÃO

```json
{
  "node": "22.x LTS",
  "typescript": "^5.5.0",
  "fastify": "^5.0.0",
  "drizzle-orm": "^0.32.0",
  "zod": "^3.23.0",
  "bullmq": "^5.0.0",
  "jose": "^5.0.0",
  "argon2": "^0.31.0",
  "tsyringe": "^4.8.0",
  "vitest": "^2.0.0",
  "pino": "^9.0.0",
  "python": "3.12.x",
  "crewai": "^0.65.0",
  "litellm": "^1.40.0",
  "fastapi": "^0.115.0",
  "next": "^15.0.0",
  "tailwindcss": "^4.0.0"
}
```

---

## 3. ESTRUTURA DE DIRETÓRIOS — NUNCA DESVIAR

```
apps/
  api/src/
    domain/           ← Entidades, Value Objects, Events, Repos (interfaces)
    application/      ← Use Cases, Commands, Queries, Handlers
    infrastructure/   ← Adapters, DB, Queue, Cache, External services
    http/             ← Routes, Middleware, Schemas (Fastify)
    container.ts      ← Wiring de DI (tsyringe)
    main.ts           ← Entry point

  agent-runtime/src/
    agents/           ← Agentes primários + sub-agentes
    config/           ← LLM routing, model config
    skills/           ← Implementação de cada skill type
    rag/              ← ChromaDB, embeddings
    main.py           ← FastAPI entry point

  web/src/
    app/              ← Next.js App Router
    components/       ← Componentes reutilizáveis
    hooks/            ← Custom React hooks
    lib/              ← Utilitários, API client
```

---

## 4. DEPENDENCY RULE — VIOLAÇÃO = REJEIÇÃO IMEDIATA

```
http → application → domain     ✅ CORRETO
http → domain                   ✅ CORRETO (para tipos apenas)
infrastructure → application    ✅ CORRETO (implementa portas)
infrastructure → domain         ✅ CORRETO (implementa repos)
domain → application            ❌ PROIBIDO
domain → infrastructure         ❌ PROIBIDO
application → infrastructure    ❌ PROIBIDO (usar interfaces/ports)
application → http              ❌ PROIBIDO
```

**Teste rápido:** se um arquivo em `domain/` tem um import de `infrastructure/` ou `application/`, está errado. Rejeitar e refatorar.

---

## 5. TYPESCRIPT — REGRAS ESTRITAS

```typescript
// tsconfig.json — não alterar estas flags
{
  "strict": true,           // Obrigatório
  "noImplicitAny": true,    // Obrigatório
  "strictNullChecks": true, // Obrigatório
  "noUncheckedIndexedAccess": true,
  "exactOptionalPropertyTypes": true
}
```

### Proibido sem exceção:
```typescript
// ❌ NUNCA usar 'any' explícito
const data: any = ...;

// ❌ NUNCA usar 'as' para contornar tipagem
const user = response as User;

// ❌ NUNCA usar non-null assertion desnecessário
const user = maybeUser!;

// ❌ NUNCA importar de outro layer violando a Dependency Rule
// em domain/lead/Lead.ts:
import { db } from '../../infrastructure/db'; // PROIBIDO

// ❌ NUNCA usar console.log em código de produção
console.log('debug');

// ❌ NUNCA usar process.env diretamente no domain/application
process.env.ANTHROPIC_API_KEY; // PROIBIDO fora de infrastructure/config
```

### Obrigatório:
```typescript
// ✅ Tipos explícitos em assinaturas públicas
async function findById(id: LeadId): Promise<Lead | null> { ... }

// ✅ Union types em vez de enums de string
type LeadStatus = 'NEW' | 'CONTACTED' | 'QUALIFIED' | 'NEGOTIATING' | 'CONVERTED' | 'LOST';

// ✅ Readonly em Value Objects
class EnrichmentData {
  constructor(
    readonly cnpj: string | undefined,
    readonly googleRating: number,
    // ...
  ) {}
}

// ✅ Result type para operações que podem falhar (sem throw no domain)
type Result<T, E = DomainError> =
  | { success: true; value: T }
  | { success: false; error: E };
```

---

## 6. NOMENCLATURA — SEGUIR EXATAMENTE

| Artefato | Convenção | Exemplo |
|---|---|---|
| Arquivos TypeScript | kebab-case | `lead-repository.ts` |
| Arquivos Python | snake_case | `lead_repository.py` |
| Classes | PascalCase | `LeadRepository` |
| Interfaces | PascalCase sem prefixo I | `LeadRepository` (não `ILeadRepository`) |
| Funções/métodos | camelCase | `findByEmail()` |
| Variáveis | camelCase | `qualificationScore` |
| Constantes de módulo | SCREAMING_SNAKE_CASE | `MAX_FILE_SIZE_MB` |
| Tipos/Enums TypeScript | PascalCase | `LeadStatus`, `AgentPersona` |
| Domain Events | PascalCase + sufixo | `LeadQualified`, `DealClosed` |
| Use Cases | PascalCase + sufixo UC | `QualifyLeadUseCase` |
| Commands | PascalCase + sufixo Command | `QualifyLeadCommand` |
| Handlers | PascalCase + sufixo Handler | `QualifyLeadHandler` |
| Adapters | PascalCase + Adapter | `GoogleMapsAdapter` |
| Ports (interfaces) | PascalCase + Port | `MediaGenerationPort` |
| Tabelas SQL | snake_case plural | `leads`, `sub_agents`, `hitl_approvals` |
| Colunas SQL | snake_case | `qualification_score`, `created_at` |
| Rotas HTTP | kebab-case plural | `/api/v1/sub-agents` |
| Variáveis de ambiente | SCREAMING_SNAKE_CASE | `GOOGLE_MAPS_API_KEY` |

---

## 7. PADRÃO DE ERROS — HIERARQUIA OBRIGATÓRIA

```typescript
// domain/shared/errors.ts — usar sempre estas classes, nunca Error genérico

export class DomainError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly context?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'DomainError';
  }
}

export class ValidationError extends DomainError {
  constructor(message: string, readonly field?: string) {
    super(message, 'VALIDATION_ERROR', { field });
    this.name = 'ValidationError';
  }
}

export class AuthenticationError extends DomainError {
  constructor() {
    // SEMPRE mensagem genérica — anti-enumeração
    super('Credenciais inválidas', 'AUTHENTICATION_ERROR');
    this.name = 'AuthenticationError';
  }
}

export class NotFoundError extends DomainError {
  constructor(resource: string, id: string) {
    super(`${resource} não encontrado`, 'NOT_FOUND', { resource, id });
    this.name = 'NotFoundError';
  }
}

export class HITLRequiredError extends DomainError {
  constructor(actionType: string) {
    super(`Ação requer aprovação HITL: ${actionType}`, 'HITL_REQUIRED', { actionType });
    this.name = 'HITLRequiredError';
  }
}

export class QuotaExceededError extends DomainError {
  constructor(service: string, limit: number) {
    super(`Quota excedida: ${service}`, 'QUOTA_EXCEEDED', { service, limit });
    this.name = 'QuotaExceededError';
  }
}

export class SecurityError extends DomainError {
  constructor(message: string) {
    super(message, 'SECURITY_ERROR');
    this.name = 'SecurityError';
  }
}
```

### Mapeamento de erros para HTTP (no errorHandler do Fastify):
```typescript
const HTTP_STATUS_MAP: Record<string, number> = {
  'VALIDATION_ERROR':    400,
  'AUTHENTICATION_ERROR':401,
  'HITL_REQUIRED':       403,
  'NOT_FOUND':           404,
  'QUOTA_EXCEEDED':      429,
  'SECURITY_ERROR':      400,
  'DOMAIN_ERROR':        422,
  // Qualquer outro: 500 (sem expor detalhes)
};
```

---

## 8. LOGGING — PINO ESTRUTURADO

```typescript
// infrastructure/logger.ts — usar sempre este logger, nunca console.*

import pino from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  redact: [
    'email', 'password', 'contactPhone', 'contactEmail',
    'cpf', 'cnpj', '*.apiKey', '*.token', 'authorization'
  ],
  serializers: {
    err: pino.stdSerializers.err,
  },
});

// COMO USAR:
const log = logger.child({
  correlationId: request.id,
  agentId: agent.id.value,
  module: 'LeadQualificationUseCase',
});

log.info({ leadId: lead.id.value, score: 78 }, 'lead_qualified');
log.warn({ source: 'google_maps', remaining: 150 }, 'maps_quota_low');
log.error({ err: error, leadId }, 'lead_qualification_failed');

// PROIBIDO:
console.log('lead qualificado:', lead);      // ❌
logger.info('lead qualificado ' + lead.id);  // ❌ interpolação
log.info({ email: lead.email });             // ❌ PII sem redact
```

---

## 9. TESTES — TDD OBRIGATÓRIO

### Ordem obrigatória para toda feature:
```
1. Escrever o teste (RED — falha esperada)
2. Escrever código mínimo para passar (GREEN)
3. Refatorar sem quebrar os testes (REFACTOR)
4. NUNCA commitar código sem testes cobrindo o happy path
```

### Estrutura de teste obrigatória:
```typescript
// tests/unit/domain/lead/Lead.test.ts

describe('Lead', () => {
  describe('qualify()', () => {
    it('deve qualificar lead quando score >= 40', () => {
      const lead = LeadFactory.create({ status: 'NEW' });
      const score = new QualificationScore(75);

      const event = lead.qualify(score);

      expect(lead.status).toBe('QUALIFIED');
      expect(lead.qualificationScore.value).toBe(75);
      expect(event.eventType).toBe('LeadQualified');
      expect(event.payload.score).toBe(75);
    });

    it('deve lançar ValidationError quando score < 0', () => {
      const lead = LeadFactory.create();

      expect(() => lead.qualify(new QualificationScore(-1)))
        .toThrow(ValidationError);
    });

    it('deve lançar DomainError quando lead já foi convertido', () => {
      const lead = LeadFactory.createConverted();

      expect(() => lead.qualify(new QualificationScore(80)))
        .toThrow(expect.objectContaining({ code: 'INVALID_STATE' }));
    });
  });
});
```

### Factories obrigatórias (nunca criar objetos "na mão" nos testes):
```typescript
// tests/factories/lead.factory.ts

export class LeadFactory {
  static create(overrides: Partial<LeadProps> = {}): Lead {
    return Lead.create({
      id: new LeadId(randomUUID()),
      contactName: 'João Silva',
      source: 'GOOGLE_MAPS',
      status: 'NEW',
      preferredChannel: 'WHATSAPP',
      enrichmentData: EnrichmentDataFactory.createActive(),
      ...overrides,
    });
  }

  static createQualified(overrides: Partial<LeadProps> = {}): Lead {
    const lead = LeadFactory.create(overrides);
    lead.qualify(new QualificationScore(75));
    return lead;
  }

  static createWithSuspendedCNPJ(): Lead {
    return LeadFactory.create({
      enrichmentData: EnrichmentDataFactory.createSuspended(),
    });
  }
}
```

---

## 10. SEGURANÇA — CHECKLIST EM TODO COMMIT

Antes de cada commit, verificar:

- [ ] Nenhum `process.env.KEY` fora de `infrastructure/config/` ou `infrastructure/secrets/`
- [ ] Magic bytes validados em todo upload de arquivo
- [ ] Magic bytes validados em imagens geradas pela IA
- [ ] SSRF prevention em toda URL de configuração externa
- [ ] Rate limiting aplicado em endpoints públicos
- [ ] Input validado com Zod antes de entrar no use case
- [ ] PII mascarado antes de ir para logs ou payloadPreview HITL
- [ ] Domain Events não contêm PII nos campos de payload públicos
- [ ] Nenhuma chave de API hardcoded (nem em comentários)
- [ ] Erros de autenticação com mensagem genérica (anti-enumeração)

### Hooks git automáticos (pré-configurados)

Os seguintes checks rodam automaticamente via Husky antes de qualquer commit/push:

- **pre-commit**: lint-staged (ESLint + Prettier + Ruff), arquivos >1MB, conflict markers, secrets hardcoded, `console.log` em produção
- **commit-msg**: commitlint (Conventional Commits obrigatório — ver seção 17)
- **pre-push**: bloqueia push direto a `main`, valida nome do branch, typecheck, unit tests
- **post-merge/checkout**: auto-`npm install` se `package-lock.json` mudou

Para pular em emergências: `git commit --no-verify` / `git push --no-verify` — documente motivo no PR.

---

## 11. PADRÃO DE DOMAIN EVENT

```typescript
// domain/shared/DomainEvent.ts

export interface DomainEvent<T = Record<string, unknown>> {
  readonly eventId: string;           // UUID v4
  readonly eventType: string;         // 'LeadQualified'
  readonly aggregateId: string;       // ID da entidade principal
  readonly aggregateType: string;     // 'Lead'
  readonly occurredAt: string;        // ISO 8601
  readonly correlationId: string;     // UUID — rastreia o fluxo
  readonly causationId?: string;      // UUID — evento que causou este
  readonly schemaVersion: string;     // '1.0.0'
  readonly payload: T;
}

// Como emitir eventos no aggregate:
// 1. O aggregate adiciona o evento a uma lista interna (_events)
// 2. O use case chama aggregate.pullEvents() após salvar
// 3. O use case publica os eventos no EventBus
// 4. NUNCA publicar eventos antes de confirmar a persistência

class Lead extends AggregateRoot {
  private _events: DomainEvent[] = [];

  qualify(score: QualificationScore): void {
    // ... lógica de domínio
    this.status = 'QUALIFIED';
    this._events.push(createLeadQualifiedEvent(this));
  }

  pullEvents(): DomainEvent[] {
    const events = [...this._events];
    this._events = [];
    return events;
  }
}
```

---

## 12. PADRÃO DE USE CASE (CQRS)

```typescript
// application/lead/QualifyLeadUseCase.ts

// COMMAND — sempre um objeto com dados necessários
export interface QualifyLeadCommand {
  readonly leadId: string;
  readonly operatorId: string;
  readonly correlationId: string;
}

// USE CASE — sem estado, sem efeitos colaterais fora do método execute()
export class QualifyLeadUseCase {
  constructor(
    private readonly leadRepo: LeadRepository,         // interface, não impl
    private readonly mapsAdapter: GoogleMapsPort,      // interface, não impl
    private readonly mcpBrasil: MCPBrasilPort,         // interface, não impl
    private readonly scoringService: LeadScoringService,
    private readonly hitlService: HITLService,
    private readonly eventBus: EventBus,
    private readonly logger: Logger,
  ) {}

  async execute(command: QualifyLeadCommand): Promise<QualifyLeadResult> {
    const log = this.logger.child({
      useCase: 'QualifyLeadUseCase',
      correlationId: command.correlationId,
    });

    // 1. Buscar aggregate
    const lead = await this.leadRepo.findById(new LeadId(command.leadId));
    if (!lead) throw new NotFoundError('Lead', command.leadId);

    // 2. Enriquecer dados
    const enrichment = await this.mcpBrasil.consultarCNPJ(lead.cnpjHint);

    // 3. Calcular score
    const score = this.scoringService.calculate(lead, enrichment);

    // 4. Aplicar lógica de domínio
    lead.enrich(enrichment);
    lead.qualify(score);

    // 5. Persistir (ANTES de publicar eventos)
    await this.leadRepo.save(lead);

    // 6. Publicar domain events
    const events = lead.pullEvents();
    await this.eventBus.publishAll(events);

    log.info({ leadId: command.leadId, score: score.value }, 'lead_qualified');

    return { leadId: lead.id.value, score: score.value };
  }
}
```

---

## 13. PADRÃO DE ADAPTER (ACL)

```typescript
// infrastructure/maps/GoogleMapsAdapter.ts

// SEMPRE implementar uma interface de domínio — nunca usar o SDK externo diretamente

// 1. Interface de domínio (em domain/ ou application/)
export interface GoogleMapsPort {
  searchLeads(params: LeadSearchParams): Promise<GooglePlace[]>;
}

// 2. Implementação (em infrastructure/)
export class GoogleMapsAdapter implements GoogleMapsPort {
  constructor(
    private readonly apiKey: string,
    private readonly rateLimiter: RateLimiter,
    private readonly cache: CacheService,
    private readonly logger: Logger,
  ) {}

  async searchLeads(params: LeadSearchParams): Promise<GooglePlace[]> {
    // Rate limiting ANTES da chamada
    await this.rateLimiter.consume('maps_daily', 1);

    // Cache check
    const cacheKey = this.cache.mapsKey(params.category, params.region);
    const cached = await this.cache.get<GooglePlace[]>(cacheKey);
    if (cached) return cached;

    // Validar SSRF (se URL vier de configuração externa)
    // validateExternalUrl(this.baseUrl); // já fixo, não necessário aqui

    const response = await fetch(this.BASE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': this.apiKey,
        'X-Goog-FieldMask': REQUIRED_FIELDS.join(','),
      },
      body: JSON.stringify(this.buildRequest(params)),
      signal: AbortSignal.timeout(10_000), // timeout de 10s
    });

    if (!response.ok) {
      throw new ExternalServiceError('Google Maps', response.status, await response.text());
    }

    const data = await response.json() as GoogleMapsResponse;
    const places = this.mapToPlaces(data.places ?? []);

    // Cachear por 24h
    await this.cache.set(cacheKey, places, CacheTTL.MAPS_SEARCH_RESULT);

    return places;
  }

  private mapToPlaces(raw: RawGooglePlace[]): GooglePlace[] {
    // Mapeamento isolado — mudança na API externa só afeta aqui
    return raw.map(p => ({
      id: p.id,
      displayName: p.displayName?.text ?? '',
      phone: p.nationalPhoneNumber,
      website: p.websiteUri,
      rating: p.rating,
      reviewsCount: p.userRatingCount,
      address: p.formattedAddress,
    }));
  }
}
```

---

## 14. PADRÃO DE ROTA HTTP (Fastify)

```typescript
// http/routes/leads.routes.ts

import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authMiddleware } from '../middleware/auth.middleware';
import { CreateLeadCommand } from '../../application/lead/CreateLeadUseCase';

// Schema Zod — compartilhado com frontend via @agentepro/shared-types
const CreateLeadSchema = z.object({
  contactName:   z.string().min(2).max(100),
  contactPhone:  z.string().regex(/^\+55\d{10,11}$/).optional(),
  contactEmail:  z.string().email().optional(),
  businessName:  z.string().min(2).max(200),
  source:        z.enum(['MANUAL', 'GOOGLE_MAPS', 'SCRAPED', 'REFERRAL', 'APOLLO']),
}).refine(
  data => data.contactPhone || data.contactEmail,
  { message: 'Ao menos telefone ou email é obrigatório', path: ['contactPhone'] }
);

export async function leadsRoutes(app: FastifyInstance): Promise<void> {
  // Aplicar auth em todas as rotas deste plugin
  app.addHook('preHandler', authMiddleware);

  app.post('/leads', {
    schema: {
      body: CreateLeadSchema,
      // Response schema para documentação automática
      response: {
        201: LeadResponseSchema,
        400: ValidationErrorSchema,
        429: RateLimitErrorSchema,
      },
    },
  }, async (request, reply) => {
    const command: CreateLeadCommand = {
      ...request.body,
      operatorId: request.operator.id,
      correlationId: request.id, // Fastify gera UUID por request
    };

    const result = await app.container
      .resolve(CreateLeadUseCase)
      .execute(command);

    return reply.status(201).send({ data: result });
  });
}
```

---

## 15. CONTAINER DE DI (tsyringe)

```typescript
// container.ts — todo wiring de dependências em um único lugar

import 'reflect-metadata';
import { container } from 'tsyringe';

// Infrastructure
container.register<LeadRepository>('LeadRepository',
  { useClass: DrizzleLeadRepository });

container.register<GoogleMapsPort>('GoogleMapsPort',
  { useClass: GoogleMapsAdapter });

container.register<MCPBrasilPort>('MCPBrasilPort',
  { useClass: MCPBrasilAdapter });

container.register<MediaGenerationPort>('MediaGenerationPort',
  { useClass: MediaGenerationRouter }); // Router usa fallback chain

// Use Cases (transient — nova instância a cada resolve)
container.register(QualifyLeadUseCase, { useClass: QualifyLeadUseCase });
container.register(EnrichLeadUseCase, { useClass: EnrichLeadUseCase });

// REGRA: Nunca instanciar use cases ou adapters fora do container
// REGRA: Injetar sempre por interface (string token), não por classe concreta
```

---

## 16. PYTHON — AGENT RUNTIME

```python
# Equivalente ao CLAUDE.md para o agent-runtime Python

# Formatação: Black (line-length=100)
# Linting: Ruff
# Type hints: obrigatórios em todas as assinaturas públicas
# Docstrings: Google style

# IMPORTS — ordem obrigatória (isort)
# 1. stdlib
# 2. third-party (crewai, litellm, fastapi)
# 3. local (relativo)

from typing import Optional
from pydantic import BaseModel, Field
from crewai import Agent, Task

# CLASSES — sempre BaseModel do Pydantic para DTOs
class SubAgentInput(BaseModel):
    briefing: dict = Field(..., description="ClientBriefingDTO serializado")
    correlation_id: str = Field(..., description="UUID de rastreamento")
    agent_id: str
    project_id: Optional[str] = None

# ASYNC — usar httpx para HTTP (não requests)
import httpx

async def call_api(url: str, payload: dict) -> dict:
    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(url, json=payload)
        response.raise_for_status()
        return response.json()

# PROIBIDO em Python:
# - requests (usar httpx)
# - print() em código de produção (usar structlog)
# - LLM SDK diretamente (sempre via LiteLLM)
# - Chamar APIs externas sem timeout
# - Armazenar API keys em variáveis (usar secrets service)
```

---

## 17. COMMITS — CONVENTIONAL COMMITS OBRIGATÓRIO

```
<tipo>(<escopo>): <descrição curta>

Tipos:
  feat:     nova funcionalidade
  fix:      correção de bug
  test:     adicionar/corrigir testes
  refactor: refatoração sem mudança de comportamento
  docs:     documentação
  chore:    configuração, CI, dependências
  security: correção de vulnerabilidade

Exemplos:
  feat(hunter): add GoogleMapsAdapter with rate limiting and cache
  test(lead): add unit tests for Lead.qualify() domain method
  fix(hitl): prevent duplicate HITL creation on retry
  security(upload): add magic bytes validation for AI-generated images
  feat(closer): implement DealTracker sub-agent with follow-up cadence

PROIBIDO:
  "fix bug"              ← sem escopo e vago
  "WIP"                  ← não commitar WIP
  "update stuff"         ← não descritivo
  "added feature"        ← tempo errado (usar imperativo)
```

---

## 18. O QUE O AGENTE NUNCA DEVE FAZER

```
❌ Criar um novo padrão arquitetural não descrito no PRD ou neste CLAUDE.md
❌ Adicionar uma dependência npm/pip sem verificar BUILD_ORDER.md
❌ Usar uma versão diferente das fixadas na seção 2
❌ Escrever código sem teste correspondente
❌ Ignorar o BUILD_ORDER.md e implementar na ordem "lógica" própria
❌ Criar um arquivo em diretório diferente do especificado na seção 3
❌ Usar 'any' em TypeScript
❌ Usar 'console.log' em produção
❌ Armazenar segredo em variável de instância sem SecretsProvider
❌ Fazer chamada HTTP sem timeout configurado
❌ Criar migration sem verificar se não quebra dados existentes
❌ Remover campo de tabela sem migration de backup
❌ Usar magic string onde existe enum ou type alias
❌ Lançar Error genérico onde existe classe de domínio específica
❌ Publicar DomainEvent antes de confirmar persistência
❌ Instanciar Use Cases fora do container DI
❌ Chamar API externa de dentro do domain layer
❌ Checar segredos em código (usar secrets provider)
❌ Hardcodar URLs, timeouts, limites em código (usar config)
```

---

## 19. O QUE O AGENTE SEMPRE DEVE FAZER

```
✅ Ler BUILD_ORDER.md antes de criar qualquer arquivo
✅ Ler o SPEC.md do módulo correspondente antes de implementar
✅ Escrever o teste ANTES do código (TDD — RED primeiro)
✅ Usar a factory correspondente para criar objetos em testes
✅ Validar magic bytes em todo arquivo recebido/gerado
✅ Checar SSRF em toda URL de configuração externa
✅ Aplicar rate limiting antes de chamar APIs externas
✅ Usar correlationId em todos os logs
✅ Emitir DomainEvent após mudanças de estado no aggregate
✅ Usar tsyringe container para resolver dependências
✅ Retornar Result<T> para operações que podem falhar no domínio
✅ Mascarar PII antes de logar ou salvar em payloadPreview
✅ Documentar decisões não óbvias com comentário WHY (não WHAT)
✅ Verificar se existe ADR para a decisão sendo tomada
✅ Seguir Conventional Commits em cada commit
```
