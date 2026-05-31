# CONTEXT — Fase 0: Fundação

> Leia este arquivo no início de cada sessão de desenvolvimento da Fase 0.
> Ele contém o estado atual do projeto e tudo que o agente precisa saber.
> Versão: 2.0.0

---

## Estado Atual

```
Fase atual:    0 — Fundação
Status:        A INICIAR
Próxima fase:  1 (Hunter + Closer)
```

## O que AINDA NÃO existe (não referenciar código que não foi criado)

```
❌ Nenhuma feature de agente
❌ Nenhuma integração com APIs externas
❌ Nenhum agente Python
❌ Sem frontend web
❌ Sem métricas Prometheus
❌ Sem RAG
❌ Sem WhatsApp/Telegram
```

## O que vamos criar nesta fase

```
✅ Monorepo Turborepo (TASK-001)
✅ Shared Types package (TASK-002)
✅ API setup: Fastify + TypeScript (TASK-003)
✅ Docker Compose: postgres + redis + chromadb + n8n + ollama + searxng (TASK-004)
✅ Domain shared primitives: Result, DomainEvent, AggregateRoot, errors (TASK-005)
✅ Value Objects de ID: AgentId, LeadId, DealId, etc. (TASK-006)
✅ Env validation com Zod (TASK-007)
✅ Drizzle schema + migrations base (TASK-008)
✅ Logger Pino com redact de PII (TASK-009)
✅ Auth: Login, Refresh, Logout (TASK-010)
✅ Fastify setup + auth routes + health (TASK-011)
✅ Container DI (TASK-012)
✅ CI pipeline base (TASK-013)
```

## Decisões já tomadas (não questionar)

- Node.js 22 + TypeScript 5.5 + Fastify 5 (ver ADR-006)
- Drizzle ORM (ver ADR-005)
- BullMQ + Redis para filas (ver ADR-004)
- Argon2id para senhas (memoryCost=65536, timeCost=3)
- JWT RS256 (nunca HS256)
- PostgreSQL 16 (não MySQL, não SQLite)
- Docker Compose self-hosted (não Kubernetes ainda)

## Padrões que DEVEM ser seguidos

```
1. TDD: teste ANTES do código (sem exceção na Fase 0)
2. Conventional Commits em cada commit
3. Domain layer sem imports de infrastructure
4. Zod valida TUDO que vem de fora (HTTP, env, upload)
5. Nenhum console.log — usar logger Pino
6. Nenhum process.env direto — usar env.ts
```

## Como verificar que a Fase 0 está completa

```bash
# 1. Build
turbo build   # sem erros

# 2. Unit tests
npm run test:unit
# Resultado esperado: todos passando, coverage domain/ >= 90%

# 3. Security tests (BLOQUEANTE)
npm run test:security
# Resultado esperado: TODOS passando

# 4. Infra
docker-compose up -d
docker-compose ps   # todos healthy após 60s

# 5. Migrations
npx drizzle-kit push   # sem erros

# 6. Auth
curl -X POST http://localhost:3001/api/v1/auth/login \
  -d '{"email":"admin@dev.local","password":"dev-password-123"}'
# Resultado: { data: { accessToken, refreshToken } }

# 7. CI
git push origin develop
# GitHub Actions: verde
```

---