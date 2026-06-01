# Runbook: Configurar Agentes

## Criar um Agente Hunter

```bash
curl -X POST http://localhost:3333/api/v1/agents \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Hunter Principal",
    "persona": "HUNTER",
    "llmProvider": "ANTHROPIC",
    "llmModel": "claude-sonnet-4-6",
    "llmTemperature": 0.3,
    "llmMaxTokens": 8192
  }'
```

## Adicionar Skill de Busca

```bash
curl -X POST http://localhost:3333/api/v1/agents/$AGENT_ID/skills \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Google Maps Search",
    "skillType": "web_search",
    "config": { "provider": "google_maps" },
    "isEnabled": true
  }'
```

## Ativar Agent

```bash
curl -X POST http://localhost:3333/api/v1/agents/$AGENT_ID/activate \
  -H "Authorization: Bearer $TOKEN"
# Retorna 409 se: sem skills | budget=0 | LLM offline
```

## Configurar Prospecção

```bash
curl -X PATCH http://localhost:3333/api/v1/prospecting/config \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "categories": ["restaurante", "clinica"],
    "region": { "city": "Salvador", "state": "BA", "radiusKm": 15 },
    "minScore": 40,
    "scheduleTime": "09:00"
  }'
```

## Checklist pré-ativação

- [ ] Agent tem ao menos 1 skill configurada
- [ ] `tokenBudgetTotal` > 0
- [ ] LLM provider configurado em Settings Hub
- [ ] Test do sub-agent passou (`POST /sub-agents/:id/test`)
