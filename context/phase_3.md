# CONTEXT — Fase 3: Polimento e Produção

> Pré-requisito: MVP v1 entregando sites reais com qualidade.
> Objetivo: Sistema production-ready, observável e documentado.
> Versão: 2.0.0

---

## Estado ao Iniciar a Fase 3

```
✅ Fase 0: Fundação completa
✅ Fase 1: Hunter + Closer funcionando (MVP v0)
✅ Fase 2: Builder + QA + Delivery funcionando (MVP v1)
✅ Pelo menos 1 site entregue e aprovado pelo cliente real
```

## O que JÁ EXISTE

```
✅ Todo o sistema de agentes (7 primários, 17 sub-agentes)
✅ Toda a infraestrutura (Docker, banco, Redis, n8n, Ollama)
✅ API completa com todos os endpoints
✅ Sistema HITL funcionando com Telegram inline
✅ WhatsApp + Telegram + Email adapters
✅ MediaGenerationService (NanaBanana + fallbacks)
✅ QA automático (Lighthouse + OWASP)
✅ HeyGen tutorial + PDF de entrega
✅ Métricas Prometheus básicas (TASK-210)
✅ 6 dashboards Grafana (TASK-210)
```

## O que vamos criar nesta fase

```
✅ Métricas Prometheus completas (TASK-301)
✅ Alertas Prometheus/Alertmanager (TASK-303)
✅ Runbooks operacionais completos (TASK-304)
✅ Frontend Web completo — 12 páginas (TASK-305)
✅ Security hardening audit (TASK-306)
✅ E2E tests Playwright (TASK-307)
✅ Performance optimization (TASK-308)
✅ RAG seed data de produção (TASK-309)
✅ Documentação do operador (TASK-310)
```

## Contratos desta fase

```
1. Zero regressões — qualquer mudança precisa de teste
2. npm audit e pip-audit limpos antes de considerar completo
3. OWASP ZAP sem findings críticos ou altos
4. Lighthouse de todos os sites gerados >= 85 performance
5. Dashboards Grafana devem mostrar dados reais (não zeros)
```

## Como verificar que a Fase 3 está completa

```bash
# 1. Métricas
curl http://localhost:3001/api/v1/metrics | grep agent_tasks_total
# Deve mostrar contagem real

# 2. Grafana
open http://localhost:3200
# Todos os 6 dashboards com dados reais

# 3. Security
npm audit --audit-level=moderate
# Deve retornar: "found 0 vulnerabilities"

# 4. E2E
npx playwright test
# Todos os testes passando

# 5. Frontend
open http://localhost:3000/hitl
# Fila HITL funcional com countdown e botões
```
