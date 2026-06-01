# Runbook: Responder Incidentes

## Incidente 1: Agent parado em pending_hitl

**Sintoma:** Lead ou mensagem não enviada, HITL sem decisão há > threshold.

```bash
# Verificar pendentes
curl http://localhost:3333/api/v1/hitl -H "Authorization: Bearer $TOKEN"

# Aprovar manualmente
curl -X POST http://localhost:3333/api/v1/hitl/$HITL_ID/approve \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"note": "Aprovado manualmente por incidente"}'
```

## Incidente 2: Agent parado por budget esgotado

```bash
# Verificar budget
curl http://localhost:3333/api/v1/agents/$AGENT_ID -H "Authorization: Bearer $TOKEN" \
  | jq '.data | {budget: .tokenBudgetRemaining, total: .tokenBudgetTotal}'

# Recarregar budget via PATCH agent (futuro: endpoint dedicado)
```

## Incidente 3: Python Runtime não responde

```bash
# Health check
curl http://localhost:8001/health

# Reiniciar
cd apps/agent-runtime && python -m src.main

# Verificar logs
docker logs agentepro-runtime 2>&1 | tail -50
```

## Incidente 4: Rate limit 429 em bulk operations

**Causa:** Global rate-limit = 100 req/min por IP.

```bash
# Aguardar 60s ou usar um IP diferente para operações administrativas em bulk
# Para CI/admin: adicionar allowlist no app.ts (rate limit com trust proxy)
```

## Incidente 5: Secrets não carregam (API Key Error)

```bash
# Verificar Settings Hub
curl http://localhost:3333/api/v1/settings -H "Authorization: Bearer $TOKEN" \
  | jq '.data[] | select(.isSecret) | {key: .key, active: .isActive}'

# Reconfigurar via Settings UI ou curl PUT /api/v1/settings
```

## Alertas Grafana → Ação

| Alerta                                  | Ação                                |
| --------------------------------------- | ----------------------------------- |
| `hitl_pending > 10`                     | Revisar queue no painel HITL        |
| `agent_tasks_failed > 5/h`              | Verificar LLM provider + logs       |
| `auth_failures > 50/5min`               | Possível brute-force → verificar IP |
| `llm_requests_total{status=error} > 1%` | Verificar API key + quota           |
