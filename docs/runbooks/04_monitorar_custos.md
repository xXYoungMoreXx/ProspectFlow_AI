# Runbook: Monitorar Custos de LLM

## Dashboard de Custos

```bash
# Custo do mês atual
curl "http://localhost:3333/api/v1/costs/dashboard?period=month" \
  -H "Authorization: Bearer $TOKEN" | jq '.data'

# Custo da semana
curl "http://localhost:3333/api/v1/costs/dashboard?period=week" \
  -H "Authorization: Bearer $TOKEN" | jq '.data'
```

## Token Budget por Agent

```bash
# Ver budget de um agent específico
curl "http://localhost:3333/api/v1/agents/$AGENT_ID/token-usage" \
  -H "Authorization: Bearer $TOKEN" | jq '.data'
```

## Alertas de Custo

Configurar no Grafana (`infra/grafana/provisioning/`):

| Métrica                                              | Threshold   | Ação                                |
| ---------------------------------------------------- | ----------- | ----------------------------------- |
| `agentepro_llm_requests_total{provider="ANTHROPIC"}` | > 1000/dia  | Revisar prompts                     |
| `agentepro_agent_tokens_consumed_total`              | > 5M/semana | Alertar operador                    |
| `token_budget_remaining < 10%`                       | Auto-pausa  | Já implementado no Agent.activate() |

## Estimativas de Custo

| Model              | Custo p/1k tokens | Uso típico            |
| ------------------ | ----------------- | --------------------- |
| claude-sonnet-4-6  | ~$0.015           | Closer, Briefing      |
| claude-haiku-4-5   | ~$0.001           | Brief Extractor       |
| gemini-3.5-flash   | ~$0.002           | Hunter Prospector     |
| ollama/llama3.2:3b | $0                | Data Enricher (local) |

## Otimizações

1. **RAG primeiro**: queries ao ChromaDB antes de chamar LLM reduzem tokens
2. **Haiku para extração**: use `claude-haiku-4-5` para tasks de parsing/extração
3. **Ollama para enrichment**: `llama3.2:3b` local para enriquecimento CNPJ/CEP
4. **Cache de prompts**: Anthropic prompt caching ativo por padrão (cache hits 90% mais baratos)
