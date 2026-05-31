# ADR-006: Fastify 5 sobre Express

**Status:** Aceito  
**Data:** 2026-05-29  

## Contexto

Framework HTTP para a API Node.js.

## Decisão

Usar **Fastify 5**.

## Justificativa

- **Performance:** Fastify é ~3x mais rápido que Express em throughput de JSON
- **Schema-first:** Validação e serialização via JSON Schema — integra com Zod via `@fastify/zod-to-json-schema`
- **Plugin system:** Encapsulamento real de plugins (contexto isolado por plugin)
- **TypeScript:** Suporte nativo e tipos corretos sem configuração adicional
- **Pino:** Logger embutido (o mesmo que usamos)
- **requestId:** Geração automática de IDs por request (correlationId)

## Alternativas

- Express: descartado — sem tipos nativos, performance inferior, callback hell
- Hono: promissor mas ecossistema menor
- Elysia (Bun): descartado — Bun não é LTS, risco operacional

---