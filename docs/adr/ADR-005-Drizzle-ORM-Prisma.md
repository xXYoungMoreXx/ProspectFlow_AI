# ADR-005: Drizzle ORM sobre Prisma

**Status:** Aceito  
**Data:** 2026-05-29  

## Contexto

Precisamos de ORM TypeScript para PostgreSQL com suporte a queries complexas, migrations e type safety.

## Decisão

Usar **Drizzle ORM** em vez de Prisma.

## Justificativa

- **Performance:** Drizzle gera SQL mais eficiente — sem overhead do Prisma Client
- **Type safety:** Inferência de tipos direto do schema sem geração de código
- **SQL-like API:** Mais próxima do SQL real — mais fácil para queries complexas
- **Bundle size:** ~30KB vs ~5MB do Prisma (importante para cold starts)
- **Migrations:** `drizzle-kit push` mais simples para desenvolvimento
- **JSONB:** Suporte nativo e type-safe para os campos JSONB do schema

## Trade-offs

- Menos popular que Prisma — menos recursos na internet
- Sem geração automática de CRUD (intencional — repositórios explícitos)
- Menos plugins do ecossistema

## Alternativas

- Prisma: descartado — overhead, geração de código, edge runtime issues
- Knex: descartado — sem type safety nativo
- TypeORM: descartado — decoradores, overhead de reflection

---