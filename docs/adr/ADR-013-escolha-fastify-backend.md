# ADR-013: Escolha do Framework Backend HTTP (Fastify vs Express)

**Status:** Aceito | Implementado ✅
**Data original:** 2026-05-01
**Nota:** Fastify 5 com Zod está em produção em `apps/api`. Decisão consolidada e sem plano de revisão.

## Contexto

O núcleo de aplicação do Hefesto, que lida com autenticação, CRM, e interface com os clientes e operadores, necessita de um backend robusto em Node.js para atuar como o principal servidor da API.

## Opções Consideradas

1. **Fastify**: Framework web rápido e de baixa sobrecarga para Node.js, com validação de schema embutida e tipagem forte via TypeScript.
2. **Express**: Framework tradicional, amplamente adotado, flexível, mas com performance base inferior e sem integração nativa de schema-first routing.
3. **NestJS**: Framework opinativo baseado em Express/Fastify.

## Decisão Tomada

Escolhemos o **Fastify**.

## Consequências

- **Positivas**:
  - Performance superior para APIs JSON intensivas.
  - Integração nativa e elegante de validação JSON Schema (com Zod/TypeBox), garantindo segurança rigorosa na porta de entrada (Zero Trust / validação de payload).
  - Arquitetura baseada em plugins favorece modularização de middlewares e features.
- **Negativas**:
  - Ecossistema de middlewares é um pouco menor comparado ao vasto repositório histórico do Express.
  - Documentação e exemplos na comunidade podem requerer adaptações comparado ao padrão dominante do Express.
