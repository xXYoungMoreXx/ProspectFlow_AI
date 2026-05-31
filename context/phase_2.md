# CONTEXT — Fase 2: Builder, QA, Delivery (MVP v1)

> Pré-requisito: Fase 1 completa + pelo menos 1 venda real concluída.
> Versão: 2.0.0

## Estado Atual

```
Fase atual:    2 — Builder + QA + Delivery
Objetivo:      Briefing aprovado → Site entregue ao cliente
```

## O que JÁ EXISTE (não recriar)

```
✅ Toda a infraestrutura da Fase 0 e Fase 1
✅ Hunter prospecta leads via Google Maps + MCP Brasil
✅ Closer negocia e fecha deals
✅ HITL completo com Telegram inline
✅ WhatsApp, Telegram, Email adapters
✅ Todos os aggregates de domínio: Agent, Lead, Deal, HITLApproval
✅ Repositórios Drizzle para todas as entidades existentes
✅ Agent Runtime Python base funcionando
✅ n8n workflows de Hunter e Closer
```

## O que vamos criar nesta fase

```
Domain:
  ✅ Briefing aggregate (TASK-201)
  ✅ Project aggregate (TASK-202)

Python Agents:
  ✅ Briefing Agent: INTERVIEWER + BRIEF_EXTRACTOR (TASK-203)
  ✅ Builder Agent: COPYWRITER + DESIGNER + IMAGER + CODER + SEO + DEPLOYER (TASK-205)
  ✅ QA Agent: SEC_AUDITOR + PERF_AUDITOR + CONTENT_CHECK (TASK-206)
  ✅ Delivery Agent: TUTORIAL_GENERATOR + DOC_GENERATOR + NOTIFIER (TASK-207)

Infrastructure:
  ✅ MediaGenerationService: NanaBanana + DALL-E + Ollama (TASK-204)
  ✅ CalComAdapter (TASK-208)
  ✅ HeyGenAdapter (TASK-207)
  ✅ Deploy adapters: Vercel + CF Pages + Render + Hostinger (TASK-205)

Observabilidade:
  ✅ Prometheus + 6 Grafana dashboards (TASK-210)
  ✅ Cost dashboard API (TASK-211)
```

## Contratos críticos desta fase

```
1. NUNCA iniciar o CODER sem MockupApproved event (HITL obrigatório)
2. NUNCA fazer deploy em produção sem StagingApproved event (HITL obrigatório)
3. NUNCA entregar sem QAApproved event
4. SEMPRE validar magic bytes em imagens geradas (mesmo de NanaBanana)
5. SEMPRE converter imagens para WebP antes de usar no site
6. Lighthouse a11y = 100 é inegociável — qualquer issue bloqueia o QA
7. Após 3 ciclos QA sem aprovação → escalar para HITL manual
```

## Como verificar que a Fase 2 está completa

```bash
# Teste ponta a ponta (requer Fase 1 rodando)
# 1. Criar deal fechado manualmente
# 2. Briefing Agent coleta requisitos
# 3. Builder Agent cria site com paralelismo
# 4. Aprovar mockup pelo Telegram
# 5. QA Agent valida
# 6. Aprovar staging pelo painel
# 7. Deploy em produção
# 8. Delivery Agent envia ao cliente

# Verificações:
curl http://localhost:3001/api/v1/projects/{id}
# status: DELIVERED
# deliverableUrl: https://...
# deliveryTutorialUrl: https://...
# lighthousePerf >= 85
# owaspScanPassed: true
```
