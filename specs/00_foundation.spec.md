# SPEC-00: Fundação — Infraestrutura Base

> Antes de qualquer feature, esta fundação deve estar funcionando.
> Versão: 2.0.0 | Fase: 0 | Semanas: 1–2

---

## Escopo

Tudo que precisa existir antes de escrever qualquer linha de código de feature:
- Monorepo configurado
- Docker Compose com todos os serviços
- Schema de banco e migrations
- Auth funcional (login/logout/refresh)
- Logger, tracing, DI container
- CI rodando

---

## 1. Monorepo (Turborepo)

### Estrutura obrigatória
```
agentepro/
├── apps/
│   ├── api/              (Fastify — Node.js)
│   ├── web/              (Next.js)
│   └── agent-runtime/    (FastAPI — Python)
├── packages/
│   └── shared-types/     (tipos compartilhados TS)
├── infra/
│   ├── docker-compose.yml
│   ├── docker-compose.test.yml
│   ├── prometheus/
│   ├── grafana/
│   └── scripts/
├── turbo.json
├── package.json          (workspaces)
└── CLAUDE.md
```

### turbo.json
```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build":    { "dependsOn": ["^build"], "outputs": [".next/**","dist/**"] },
    "test":     { "dependsOn": ["^build"] },
    "test:unit":{ "cache": false },
    "lint":     { "dependsOn": ["^build"] },
    "dev":      { "cache": false, "persistent": true }
  }
}
```

### package.json raiz
```json
{
  "name": "agentepro",
  "private": true,
  "workspaces": ["apps/*", "packages/*"],
  "scripts": {
    "dev":       "turbo dev",
    "build":     "turbo build",
    "test":      "turbo test",
    "test:unit": "turbo test:unit",
    "lint":      "turbo lint",
    "db:migrate":"cd apps/api && npx drizzle-kit push",
    "setup":     "bash infra/scripts/setup.sh"
  },
  "devDependencies": {
    "turbo": "^2.0.0"
  }
}
```

### Critérios de aceite
- [ ] `turbo build` passa sem erros em todos os apps
- [ ] `turbo test:unit` roda e reporta cobertura
- [ ] `npm run lint` sem warnings

---

## 2. Docker Compose Dev

### Serviços obrigatórios no `infra/docker-compose.yml`
```yaml
# Todos os serviços já documentados no PRD seção 30
# Healthchecks obrigatórios em todos os serviços de infra
# Networks: todos na mesma rede 'agentepro-network'
# Volumes: nomeados (não bind mounts) para persistência
```

### Healthchecks obrigatórios
```
postgres:     pg_isready -U agentepro
redis:        redis-cli ping
chromadb:     curl -f http://localhost:8000/api/v1/heartbeat
n8n:          curl -f http://localhost:5678/healthz
ollama:       curl -f http://localhost:11434/api/tags
mcp-brasil:   curl -f http://localhost:8000/health
evolution-api:curl -f http://localhost:8080/
```

### Critérios de aceite
- [ ] `docker-compose up -d` sem erros
- [ ] Todos os healthchecks verdes após 60s
- [ ] `docker-compose down && docker-compose up -d` funciona (dados persistem)

---

## 3. Schema do Banco — Migrations

### Ordem das migrations (CRÍTICA — não alterar)
```
migrations/
  0001_initial_schema.sql       ← operators, refresh_tokens
  0002_add_agents.sql           ← agents, agent_skills, agent_rules
  0003_add_sub_agents.sql       ← sub_agents
  0004_add_mcp_servers.sql      ← mcp_servers
  0005_add_leads_messages.sql   ← leads, messages, enums
  0006_add_deals.sql            ← deals
  0007_add_briefings.sql        ← briefings, briefing_assets
  0008_add_projects.sql         ← projects, generated_assets
  0009_add_hitl.sql             ← hitl_approvals
  0010_add_scheduling.sql       ← scheduled_meetings
  0011_add_cost_tracking.sql    ← token_usage_log
  0012_add_audit_log.sql        ← audit_log (append-only + RLS)
```

### Critérios de aceite
- [ ] `drizzle-kit push` sem erros em banco limpo
- [ ] Migrations idempotentes (rodar 2x não quebra)
- [ ] `drizzle-kit push` falha com erro claro se banco inconsistente

---

## 4. Shared Types Package

### Interface obrigatória
```typescript
// packages/shared-types/src/index.ts

// Exportar todos os tipos compartilhados entre API e Web
export * from './api-responses';
export * from './lead.types';
export * from './agent.types';
export * from './hitl.types';
export * from './deal.types';
export * from './briefing.types';
export * from './project.types';
export * from './errors.types';
export * from './pagination.types';
```

```typescript
// packages/shared-types/src/pagination.types.ts
export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    cursor: { next: string | null; prev: string | null };
    total: number;
    limit: number;
  };
}

// packages/shared-types/src/errors.types.ts
export interface ApiError {
  code: string;
  message: string;
  field?: string;
  requestId: string;
}

export interface ApiErrorResponse {
  errors: ApiError[];
}
```

---

## 5. Configuração e Variáveis de Ambiente

### Zod Schema do env.ts (interface exata)
```typescript
// apps/api/src/infrastructure/config/env.ts

export const envSchema = z.object({
  NODE_ENV:          z.enum(['development','test','production']),
  DATABASE_URL:      z.string().url('DATABASE_URL inválida'),
  REDIS_URL:         z.string().url('REDIS_URL inválida'),
  JWT_PRIVATE_KEY:   z.string().min(100, 'JWT_PRIVATE_KEY muito curta — não é RSA?'),
  JWT_PUBLIC_KEY:    z.string().min(100, 'JWT_PUBLIC_KEY muito curta'),
  CHROMA_URL:        z.string().url().default('http://chromadb:8000'),
  OLLAMA_BASE_URL:   z.string().url().default('http://ollama:11434'),
  AGENT_RUNTIME_URL: z.string().url().default('http://agent-runtime:8000'),
  API_PORT:          z.coerce.number().default(3001),
  LOG_LEVEL:         z.enum(['debug','info','warn','error']).default('info'),
  FRONTEND_URL:      z.string().url().default('http://localhost:3000'),
  API_PUBLIC_URL:    z.string().url().default('http://localhost:3001'),

  // Opcionais — não crasham o app
  ANTHROPIC_API_KEY: z.string().optional(),
  GEMINI_API_KEY:    z.string().optional(),
  OPENAI_API_KEY:    z.string().optional(),
  GOOGLE_MAPS_API_KEY: z.string().optional(),
  EVOLUTION_API_URL: z.string().url().optional(),
  EVOLUTION_API_KEY: z.string().optional(),
  WPP_INSTANCE:      z.string().optional(),
  TELEGRAM_HITL_BOT_TOKEN:   z.string().optional(),
  TELEGRAM_SALES_BOT_TOKEN:  z.string().optional(),
  TELEGRAM_OPERATOR_CHAT_ID: z.string().optional(),
  HEYGEN_API_KEY:    z.string().optional(),
  HEYGEN_AVATAR_ID:  z.string().optional(),
  CAL_BASE_URL:      z.string().url().optional(),
  CAL_API_KEY:       z.string().optional(),
  MCP_BRASIL_URL:    z.string().url().default('http://mcp-brasil:8000'),
  BREVO_API_KEY:     z.string().optional(),
  VERCEL_TOKEN:      z.string().optional(),
  CLOUDFLARE_PAGES_TOKEN: z.string().optional(),
  OPERATOR_NAME:     z.string().optional(),
  OPERATOR_EMAIL:    z.string().email().optional(),
});

export type Env = z.infer<typeof envSchema>;
export const env = envSchema.parse(process.env);
```

---

## 6. Logger (Pino)

### Interface obrigatória
```typescript
// apps/api/src/infrastructure/logger/logger.ts

import pino from 'pino';
import { env } from '../config/env';

export const logger = pino({
  level: env.LOG_LEVEL,
  redact: {
    paths: [
      'email', 'password', 'contactPhone', 'contactEmail',
      'cpf', 'cnpj', '*.apiKey', '*.token', '*.password',
      'authorization', 'cookie', 'x-api-key',
    ],
    censor: '***REDACTED***',
  },
  formatters: {
    level: (label) => ({ level: label }),
  },
  timestamp: pino.stdTimeFunctions.isoTime,
});

// Uso obrigatório — sempre criar child logger com contexto
export function createLogger(context: Record<string, string>) {
  return logger.child(context);
}
```

### Critérios de aceite
- [ ] `email` e `password` aparecem como `***REDACTED***` nos logs
- [ ] Timestamp ISO 8601 em todos os logs
- [ ] `level` como string (não número)
- [ ] Child logger propaga contexto em todos os logs filhos

---

## 7. DI Container (tsyringe)

### Ordem de registro obrigatória
```typescript
// apps/api/src/container.ts

import 'reflect-metadata';
import { container } from 'tsyringe';

// 1. Configuração e secrets
container.registerSingleton<SecretsPort>('SecretsPort', InfisicalAdapter);
container.registerSingleton<Logger>('Logger', PinoLogger);
container.registerSingleton<EventBus>('EventBus', InMemoryEventBus);

// 2. Infrastructure - Cache e Queue
container.registerSingleton<CachePort>('CachePort', RedisCacheAdapter);
container.registerSingleton<QueuePort>('QueuePort', BullMQAdapter);

// 3. Infrastructure - Database
container.registerSingleton<LeadRepository>('LeadRepository', DrizzleLeadRepository);
container.registerSingleton<AgentRepository>('AgentRepository', DrizzleAgentRepository);
// ... demais repositórios

// 4. Infrastructure - External services
container.registerSingleton<GoogleMapsPort>('GoogleMapsPort', GoogleMapsAdapter);
container.registerSingleton<MCPBrasilPort>('MCPBrasilPort', MCPBrasilAdapter);
container.registerSingleton<MessagingPort>('WhatsAppPort', WhatsAppAdapter);
container.registerSingleton<MessagingPort>('TelegramSalesPort', TelegramSalesBot);
container.registerSingleton<MediaGenerationPort>('MediaGenerationPort', MediaGenerationRouter);
container.registerSingleton<SchedulingPort>('SchedulingPort', CalComAdapter);

// 5. Domain Services
container.registerSingleton(LeadQualificationService);
container.registerSingleton(HITLPayloadMasker);

// 6. Use Cases (transient — nova instância a cada resolve)
container.register(LoginUseCase,         { useClass: LoginUseCase });
container.register(QualifyLeadUseCase,   { useClass: QualifyLeadUseCase });
container.register(EnrichLeadUseCase,    { useClass: EnrichLeadUseCase });
container.register(CreateHITLUseCase,    { useClass: CreateHITLUseCase });
// ... demais use cases
```

---

## 8. Auth — Especificação Completa

### POST /api/v1/auth/login

**Request:**
```typescript
{
  email:    string;  // email válido
  password: string;  // mín 8 chars
}
```

**Response 200:**
```typescript
{
  data: {
    accessToken:  string;  // JWT RS256, exp 1h
    refreshToken: string;  // opaque token, exp 7d
    expiresIn:    3600;
  }
}
```

**Response 401:**
```typescript
{ errors: [{ code: 'AUTHENTICATION_ERROR', message: 'Credenciais inválidas' }] }
// SEMPRE a mesma mensagem, independente se email existe ou não
```

**Fluxo interno:**
```
1. Validar input com Zod (400 se inválido)
2. Buscar operator por email
3. SEMPRE executar argon2.verify (mesmo se operator null — usar hash dummy)
4. Se operator null OU hash não bate → AuthenticationError (401 genérico)
5. Gerar accessToken (RS256, 1h, issuer, audience)
6. Gerar refreshToken (crypto.randomBytes(32).toString('hex'))
7. Hash do refreshToken → salvar na tabela refresh_tokens
8. Registrar no audit_log: OPERATOR_LOGIN
9. Retornar tokens
```

**Hashing do refresh token:**
```typescript
const tokenRaw = crypto.randomBytes(32).toString('hex');
const tokenHash = createHash('sha256').update(tokenRaw).digest('hex');
// Salvar tokenHash no banco, retornar tokenRaw ao cliente
```

### POST /api/v1/auth/refresh

```
1. Receber refreshToken no body
2. Hash do token recebido
3. Buscar por hash — 401 se não encontrar
4. Verificar se não está revogado (revokedAt null) — 401 se revogado
5. Verificar expiresAt > now() — 401 se expirado
6. Revogar token atual (revokedAt = now())
7. Gerar novo par de tokens
8. Retornar novos tokens
```

### DELETE /api/v1/auth/logout

```
1. Extrair refreshToken do body (opcional — se não informado, apenas blacklist do access)
2. Se refreshToken: revogar no banco
3. Retornar 204 No Content
```

### Rate Limiting de Login

```typescript
// 5 tentativas por IP por 15 minutos
// Usar sliding window no Redis
// Key: `rl:login:${ip}`
// Resposta 429: { errors: [{ code: 'RATE_LIMIT', message: 'Muitas tentativas. Tente em 15 minutos.' }] }
// Header: Retry-After: ${segundosRestantes}
```

### Critérios de aceite
- [ ] Login com credenciais corretas retorna 200 com tokens
- [ ] Login com email errado retorna 401 IDÊNTICO ao com senha errada
- [ ] Timing entre erro de email e erro de senha: diferença < 200ms
- [ ] 5ª tentativa em 15 min retorna 429
- [ ] Refresh com token válido retorna novos tokens e invalida o anterior
- [ ] Logout invalida o refresh token
- [ ] Token expirado retorna 401 TOKEN_EXPIRED (não AUTHENTICATION_ERROR)

---

## 9. Fastify Setup

### Plugins obrigatórios e ordem
```typescript
// apps/api/src/main.ts

const app = Fastify({
  logger: pinoLogger,
  genReqId: () => ulid(),  // ULID como requestId
  trustProxy: true,         // Para rate limiting por IP real atrás de proxy
});

// Plugins — ORDEM IMPORTA
await app.register(import('@fastify/helmet'), {
  contentSecurityPolicy: { directives: { defaultSrc: ["'self'"] } },
});
await app.register(import('@fastify/cors'), {
  origin: [env.FRONTEND_URL],
  credentials: true,
});
await app.register(import('@fastify/rate-limit'), {
  global: true,
  max: 100,
  timeWindow: '1 minute',
  redis: redisClient,
});
await app.register(import('@fastify/swagger'));
await app.register(import('@fastify/swagger-ui'), { routePrefix: '/docs' });

// Error handler global
app.setErrorHandler(errorHandler);

// Rotas
await app.register(authRoutes,         { prefix: '/api/v1' });
await app.register(agentsRoutes,       { prefix: '/api/v1' });
await app.register(leadsRoutes,        { prefix: '/api/v1' });
await app.register(dealsRoutes,        { prefix: '/api/v1' });
await app.register(briefingsRoutes,    { prefix: '/api/v1' });
await app.register(projectsRoutes,     { prefix: '/api/v1' });
await app.register(hitlRoutes,         { prefix: '/api/v1' });
await app.register(webhooksRoutes,     { prefix: '/webhooks' });
await app.register(healthRoutes,       { prefix: '/' });
```

### GET /health — resposta obrigatória
```typescript
{
  status: 'ok' | 'degraded' | 'down',
  version: '2.0.0',
  timestamp: '2026-05-29T10:00:00Z',
  dependencies: {
    postgres:   { status: 'ok' | 'down', latencyMs: number },
    redis:      { status: 'ok' | 'down', latencyMs: number },
    chromadb:   { status: 'ok' | 'down', latencyMs: number },
    ollama:     { status: 'ok' | 'down', latencyMs: number },
    agentRuntime: { status: 'ok' | 'down', latencyMs: number },
  }
}
// status 'degraded' se alguma dep opcional está down
// status 'down' se postgres ou redis estão down
// HTTP 200 para ok/degraded, HTTP 503 para down
```
