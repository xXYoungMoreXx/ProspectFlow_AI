# ADR-005: Estratégia de hospedagem — distribuída e 100% gratuita no MVP

**Status:** Aceito  
**Data:** 2026-05-09  
**Deciders:** Arquiteto  
**Tags:** infraestrutura, vercel, oracle-cloud, hospedagem, custo

---

## Contexto

O AgentePro tem componentes com requisitos radicalmente diferentes de runtime:

| Componente              | Requisito crítico                                      |
| ----------------------- | ------------------------------------------------------ |
| Frontend Next.js        | CDN global, deploy contínuo, previews                  |
| API Backend Fastify     | Processo Node.js persistente, WebSocket                |
| Agent Runtime           | Processo Python persistente, long-running              |
| Ollama (LLMs)           | 8–24 GB RAM, processo daemon persistente, GPU opcional |
| PostgreSQL              | Disco persistente, transações ACID                     |
| Redis                   | In-memory, baixa latência                              |
| n8n                     | Processo persistente, webhooks, UI própria             |
| ChromaDB                | Disco persistente, vetorial                            |
| Evolução API (WhatsApp) | Processo Node.js persistente, WebSocket                |

A pergunta "posso hospedar o Ollama na Vercel?" foi avaliada e descartada pelos seguintes
motivos técnicos objetivos:

- Vercel é serverless: sem processo persistente, sem disco, máx. 3 GB RAM por função
- Modelos Llama 3.2 7B requerem mínimo 8 GB RAM para carregar
- Timeout máximo de função: 300s (Pro) — insuficiente para sessões de agente
- Sem GPU disponível no free/pro tier da Vercel

O requisito central é: **infraestrutura 100% gratuita para o MVP**, com possibilidade de
escalar para pago quando o faturamento justificar.

---

## Decisão

**Arquitetura Localhost-First para MVP, eliminando complexidade prematura de deploy distribuído.**

### Mapa de hospedagem (MVP)

```
┌─────────────────────────────────────────────────────────────┐
│                    COMPONENTE → ONDE RODA                   │
├──────────────────────┬──────────────────────────────────────┤
│ Frontend Next.js     │ docker-compose (Localhost)           │
│ API Backend Fastify  │ docker-compose (Localhost)           │
│ Agent Runtime Python │ docker-compose (Localhost)           │
│ PostgreSQL           │ docker-compose (Localhost)           │
│ Redis                │ docker-compose (Localhost)           │
│ ChromaDB             │ docker-compose (Localhost)           │
│ n8n                  │ docker-compose (Localhost)           │
│ Evolution API (WPP)  │ docker-compose (Localhost)           │
└──────────────────────┴──────────────────────────────────────┘
```

A decisão de mover tudo para o Docker Localhost para o MVP foi tomada para reduzir o overhead operacional, simplificando os processos de build e debug para a equipe de desenvolvimento. A migração para a infraestrutura cloud (Oracle Cloud, Vercel, Fly.io) ocorrerá após a validação do MVP e de acordo com a necessidade de escala.

### Threshold para migração Cloud

```
VMs ARM Ampere A1:
  - Até 4 OCPUs + 24 GB RAM total (distribuídos entre 1–4 VMs)
  - Recomendado: 1 VM com 4 OCPUs + 24 GB (Ollama + serviços auxiliares)

Block Storage: 200 GB total
Bandwidth: 10 TB/mês outbound — suficiente para todos os webhooks e APIs
PostgreSQL Autonomous: 2 DBs gratuitos (20 GB cada)

Modelos viáveis com 24 GB ARM:
  - Llama 3.2 13B (Q4): ~10 GB — qualidade excelente, velocidade aceitável
  - Mistral 7B (Q4): ~5 GB — mais rápido, útil para Hunter/QA
  - CodeLlama 13B (Q4): ~10 GB — especialista em código para Builder
  - nomic-embed-text: ~0.3 GB — embeddings para RAG/ChromaDB
```

### Estratégia para MVP local (desenvolvimento)

```yaml
# docker-compose.yml — tudo local com 1 comando
services:
  ollama: # localhost:11434
  postgres: # localhost:5432
  redis: # localhost:6379
  chromadb: # localhost:8000
  n8n: # localhost:5678
  evolution-api: # localhost:8080
  api: # localhost:3001
  web: # localhost:3000 (ou next dev)
```

### Threshold para migração para pago

| Serviço       | Limite free      | Trigger para upgrade                  |
| ------------- | ---------------- | ------------------------------------- |
| Railway       | $5 crédito/mês   | API > 500 req/hora consistentes       |
| Fly.io        | 3 VMs 256 MB     | Agent runtime precisa de mais memória |
| Supabase      | 500 MB DB        | Banco > 400 MB                        |
| Upstash Redis | 10k cmd/dia      | Filas BullMQ muito ativas             |
| Vercel        | 100 GB bandwidth | Muitos sites de clientes com tráfego  |

### Hospedagem dos sites dos clientes

Cada site entregue pelo Builder é deployado como projeto separado:

- **Vercel**: domínio `cliente.vercel.app` gratuito + suporte a domínio custom
- **Netlify**: alternativa com `cliente.netlify.app`
- O Builder escolhe a plataforma baseado em disponibilidade de quota

```typescript
class DeploymentRouter {
  async selectPlatform(project: Project): Promise<DeployPlatform> {
    const vercelQuota = await this.vercelAdapter.getRemainingQuota();
    const netlifyQuota = await this.netlifyAdapter.getRemainingQuota();

    if (vercelQuota.projects < QUOTA_WARNING_THRESHOLD) return "netlify";
    return "vercel"; // padrão
  }
}
```

---

## Consequências

### Positivas

- Custo mensal total no MVP: R$ 0 (assumindo tráfego dentro dos free tiers)
- Oracle Cloud ARM é genuinamente gratuito e permanente — não é trial
- Vercel para sites dos clientes é o caso de uso mais otimizado da plataforma
- Separação de responsabilidades: cada serviço na plataforma adequada ao seu perfil

### Negativas

- Complexidade operacional: múltiplas plataformas para monitorar
- Cold start no Railway/Fly.io se a VM hiberna por inatividade
- Oracle Cloud: processo de criação de conta pode ser complicado (verificação de cartão mesmo no free tier)
- VM ARM não tem GPU — Ollama roda em CPU, mais lento que com GPU

### Mitigações

- Health check pings periódicos para evitar hibernação no Railway/Fly.io
- Para produção com volume: RunPod/vast.ai com GPU spot (R$1–3/hora) é mais custo-efetivo que GPU dedicada
- Documentação detalhada de setup Oracle Cloud no CONTRIBUTING.md

---

## Alternativas consideradas

### Tudo no Railway

- **Descartado** — Ollama precisa de RAM que o free tier não oferece

### Tudo em VPS (Contabo, Hetzner)

- **Descartado para MVP** — R$20–40/mês; Oracle Cloud entrega mais recursos de graça

### Render.com

- **Considerado como alternativa ao Railway** — interface similar, free tier com hibernate
- **Status:** Alternativa válida documentada no CONTRIBUTING.md como opção B
