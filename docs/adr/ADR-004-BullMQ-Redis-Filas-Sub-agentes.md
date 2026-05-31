# ADR-004: BullMQ + Redis para Filas de Sub-agentes

**Status:** Aceito  
**Data:** 2026-05-29  

## Contexto

Sub-agentes precisam executar de forma assíncrona, com retry, prioridade e rastreamento de status.

## Decisão

Usar **BullMQ** com **Redis** como backend de filas para despacho de sub-agentes.

## Justificativa

- BullMQ é o padrão de facto para Node.js com Redis
- Suporte nativo a: prioridade, delay, retry com backoff exponencial, jobs repetitivos (cron)
- UI (Bull Board) para debugging
- Persistência — jobs não perdem-se se o servidor reiniciar
- Concorrência configurável por worker

## Prioridade de Jobs

```
1 — NOTIFIER (entrega ao cliente)
2 — SEC_AUDITOR (segurança crítica)
3 — CODER
4 — CONV_HANDLER (negociação ativa)
5 — OUTREACH_WRITER
6 — COPYWRITER, DESIGNER, IMAGER
10 — PROSPECTOR (background)
```

## Alternativas

- RabbitMQ: descartado — mais complexo de operar self-hosted
- SQS (AWS): descartado — dependência de cloud, custo
- In-process queue: descartado — sem persistência, sem retry

---