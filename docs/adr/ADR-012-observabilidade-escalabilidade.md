# ADR-012: Observabilidade e escalabilidade

**Status:** Aceito  
**Data:** 2026-05-09  
**Deciders:** Arquiteto  
**Tags:** observabilidade, métricas, logs, tracing, escalabilidade, alertas

---

## Contexto

O AgentePro executa processos assíncronos de longa duração (sessões de agentes),
integra múltiplos serviços externos e processa dados financeiros e pessoais de clientes.
Sem observabilidade adequada, é impossível:

- Diagnosticar por que uma sessão de Builder falhou na metade
- Saber se o agente Hunter está com taxa de qualificação abaixo do esperado
- Detectar se um agente está consumindo tokens acima do budget
- Identificar tentativas de ataque (brute force, SSRF, injeção de prompt)

A stack precisa ser 100% gratuita no MVP e não adicionar complexidade operacional
significativa ao time pequeno.

---

## Decisão

**Três pilares de observabilidade (logs, métricas, tracing) com ferramentas self-hosted
gratuitas, priorizando alertas acionáveis sobre dashboards completos.**

### Pilar 1 — Logs estruturados (JSON)

Todos os serviços emitem logs JSON com campos obrigatórios:

```typescript
interface StructuredLog {
  level: "debug" | "info" | "warn" | "error" | "fatal";
  timestamp: string; // ISO 8601
  service: string; // 'api' | 'agent-runtime' | 'builder' | etc.
  traceId: string; // OpenTelemetry trace ID
  spanId: string;
  correlationId: string; // Atravessa todo o fluxo de uma venda
  agentId?: string;
  persona?: AgentPersona;
  action?: string;
  durationMs?: number;
  message: string;
  error?: { message: string; code: string; stack?: string };
  // NUNCA: email, telefone, mensagens brutas, API keys
}
```

**Stack de logs:** Pino (Node.js) + structlog (Python) → stdout → Docker logs →
Loki (self-hosted, gratuito) → Grafana para consulta.

**Retenção:** 30 dias de logs detalhados, 1 ano de logs de audit (tabela PostgreSQL).

### Pilar 2 — Métricas (Prometheus + Grafana)

```
# Métricas obrigatórias no MVP

# Pipeline de vendas
agentepro_leads_created_total{source}                    # Counter
agentepro_leads_qualified_total{score_bucket}            # Counter
agentepro_deals_closed_total{service_type}               # Counter
agentepro_deals_closed_value_brl_total                   # Counter (R$)
agentepro_projects_delivered_total                       # Counter
agentepro_funnel_conversion_rate{stage}                  # Gauge

# Agentes
agentepro_agent_sessions_total{persona, status}          # Counter
agentepro_agent_session_duration_seconds{persona}        # Histogram
agentepro_agent_tokens_consumed_total{persona, provider} # Counter
agentepro_agent_errors_total{persona, error_type}        # Counter
agentepro_agent_budget_remaining{agent_id}               # Gauge

# HITL
agentepro_hitl_pending{operator_id}                      # Gauge
agentepro_hitl_decision_seconds{decision}                # Histogram
agentepro_hitl_expired_total                             # Counter

# Segurança
agentepro_auth_failures_total{reason}                    # Counter
agentepro_rate_limit_hits_total{endpoint}                # Counter
agentepro_ssrf_blocked_total                             # Counter
agentepro_invalid_upload_total{reason}                   # Counter

# API
http_requests_total{method, route, status_code}          # Counter
http_request_duration_seconds{method, route}             # Histogram (p50/p95/p99)
```

**Stack:** Fastify métricas plugin → Prometheus (Docker) → Grafana (Docker).

### Pilar 3 — Distributed Tracing

Cada request recebe `traceId` que percorre toda a stack:
`HTTP request → Use Case → Domain Event → Agent Session → LLM Call → Deploy`

```typescript
// OpenTelemetry — instrumentação automática do Fastify e HTTPClient
import { NodeTracerProvider } from "@opentelemetry/sdk-node";
import { JaegerExporter } from "@opentelemetry/exporter-jaeger";

// Jaeger self-hosted (Docker) — gratuito, UI completa de tracing
const provider = new NodeTracerProvider({
  resource: Resource.default().merge(
    new Resource({
      [SemanticResourceAttributes.SERVICE_NAME]: "agentepro-api",
    }),
  ),
});
provider.addSpanProcessor(
  new BatchSpanProcessor(
    new JaegerExporter({ endpoint: process.env.JAEGER_ENDPOINT }),
  ),
);
```

**Managed Agents:** Claude Console já fornece tracing de cada tool call de cada
sub-agente — complementa (não substitui) o tracing da API.

### Dashboards Grafana — 4 painéis obrigatórios no MVP

```
1. Pipeline Dashboard
   - Funil: Leads → Qualificados → Deals → Projetos → Entregues
   - Taxa de conversão por etapa
   - Faturamento acumulado do mês
   - Ticket médio

2. Agent Performance
   - Tokens consumidos por agente (vs budget)
   - Taxa de sucesso/falha por persona
   - Latência média de sessão
   - Custo estimado em R$ por agente

3. HITL Dashboard
   - Aprovações pendentes (alerta se > 5)
   - Tempo médio de decisão por tipo
   - Taxa de rejeição (alto = agente precisando de ajuste)
   - Expirados (alto = operador não respondendo)

4. Security Dashboard
   - Tentativas de login bloqueadas (por IP e total)
   - Rate limit hits por endpoint
   - Uploads rejeitados por magic bytes
   - SSRFs bloqueados
```

### Alertas críticos (Grafana Alerting → Telegram)

```yaml
alerts:
  - name: HITLBacklog
    expr: agentepro_hitl_pending > 10
    severity: warning
    message: "🔔 {count} aprovações HITL pendentes há mais de 1h"

  - name: AgentBudgetLow
    expr: agentepro_agent_budget_remaining / agentepro_agent_budget_total < 0.1
    severity: warning
    message: "⚠️ Agente {agent_id} com menos de 10% do budget de tokens"

  - name: AgentHighErrorRate
    expr: rate(agentepro_agent_errors_total[5m]) > 0.2
    severity: critical
    message: "🚨 Taxa de erro alta no agente {persona}: {rate}/min"

  - name: SecurityBruteForce
    expr: rate(agentepro_auth_failures_total[1m]) > 10
    severity: critical
    message: "🚨 Possível brute force: {rate} falhas de login/min"

  - name: PriceCrawlerStale
    expr: time() - agentepro_price_crawler_last_success > 7 * 24 * 3600
    severity: warning
    message: "⚠️ PriceCrawler sem atualização há 7+ dias — custos podem estar desatualizados"
```

### Escalabilidade — decisões arquiteturais

**API Stateless:** Nenhum estado em memória na API. Estado fica em PostgreSQL e Redis.
Escalar horizontalmente = adicionar instâncias do container sem configuração.

**Filas assíncronas:** Tarefas longas (geração de site, scraping, embeddings) via
BullMQ + Redis. Workers escalam independente da API.

**Connection pooling:** PgBouncer entre API e PostgreSQL. Cada instância da API
usa pool de 10 conexões; PgBouncer multiplexia para o banco.

**Cache de leitura:** Queries frequentes (lista de agentes, templates, configurações)
cacheadas no Redis com TTL de 5 minutos. Invalidação por domain event.

---

## Consequências

### Positivas

- Stack gratuita: Prometheus + Grafana + Jaeger + Loki — tudo Docker, sem SaaS pago
- Alertas Telegram chegam no celular do operador sem configuração de PagerDuty
- Tracing permite diagnosticar exatamente onde uma sessão de agente falhou
- Métricas de pipeline respondem a: "quantas vendas fechei essa semana?"

### Negativas

- Mais containers Docker para gerenciar (Prometheus, Grafana, Jaeger, Loki)
- Na VM Oracle Cloud (24 GB), reservar ~3–4 GB para stack de observabilidade
- Loki + Jaeger geram volume de dados — implementar retenção e compactação

### Simplificação para MVP mínimo

Se a observabilidade completa atrasar o MVP, implementar nesta ordem:

1. Logs estruturados (Pino) → stdout (semana 1)
2. Health check endpoint `/health` (semana 1)
3. Alertas Telegram críticos (semana 2)
4. Prometheus + Grafana básico (semana 4)
5. Jaeger tracing (pós-primeiro cliente)
