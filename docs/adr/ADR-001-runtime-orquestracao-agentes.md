# ADR-001: Runtime de orquestração de agentes

**Status:** Proposto — Em Avaliação ⏳
**Data:** 2026-05-09  
**Deciders:** Arquiteto, Produto  
**Tags:** agentes, infraestrutura, orquestração

---

## Contexto

O AgentePro precisa orquestrar múltiplos agentes especializados (Hunter, Closer, Builder, QA) em fluxos assíncronos de longa duração — uma sessão de geração de site pode levar 30–60 minutos de execução ativa. É necessário suporte a: loops de agente, execução de ferramentas, gerenciamento de estado entre etapas, recuperação de falhas, observabilidade e HITL (Human-in-the-Loop).

Três abordagens foram avaliadas durante o design do sistema:

1. **Self-hosted com CrewAI + Python** — framework open-source para multi-agent, rodando em infraestrutura própria (Oracle Cloud Free Tier + Fly.io)
2. **Self-hosted com LangGraph** — grafo de estados para fluxos complexos, mais controle sobre o loop do agente
3. **Claude Managed Agents (Anthropic, beta desde abr/2026)** — runtime gerenciado: sandboxing, checkpointing, credential vaults, multi-agent nativo, memory e dreaming

### Forças relevantes

- O time é pequeno (vibe coding solo/pequeno); minimizar infraestrutura a gerenciar é crítico
- A feature **Dreaming** (mai/2026) permite que agentes aprendam com sessões passadas automaticamente — equivalente a meses de engenharia para implementar do zero
- **Multi-agent orchestration** nativa suporta até 20 agentes com coordenador, mapeando diretamente para a arquitetura Hunter → Closer → Builder → QA
- **Checkpointing** nativo elimina risco de perder progresso em sessões longas (geração de site)
- Custo de runtime: $0,08/hora ativa — idle (aguardando HITL) não é cobrado
- Custo total estimado por entrega de site: ~$0,70 (~R$3,50) em tokens + runtime

---

## Decisão

**Usar Claude Managed Agents para o MVP e v2 do AgentePro.**

O coordenador de agentes é implementado como um Managed Agent com `multiagent` orchestration. Cada persona (Hunter, Closer, Builder, QA) é um agente filho registrado no coordenador. Sessions são disparadas via API com webhooks para notificação de eventos HITL.

O código de domínio encapsula toda a lógica de negócio atrás de uma interface `AgentRuntime` (port hexagonal), permitindo trocar a implementação futuramente sem tocar no domain layer.

```typescript
// Port — nunca expõe SDK da Anthropic ao domínio
interface AgentRuntime {
  startSession(agentId: string, task: AgentTask): Promise<SessionRef>
  sendEvent(sessionId: string, event: AgentEvent): Promise<void>
  streamEvents(sessionId: string): AsyncIterable<AgentEvent>
  interruptSession(sessionId: string): Promise<void>
}

// Adapter — infraestrutura, depende do SDK Anthropic
class ManagedAgentsAdapter implements AgentRuntime { ... }

// Alternativa futura — self-hosted
class CrewAIAdapter implements AgentRuntime { ... }
```

---

## Consequências

### Positivas
- Elimina 3–4 semanas de setup de infraestrutura (Redis, BullMQ, sandboxing, credential vaults, Jaeger)
- Dreaming: agentes Hunter e Closer melhoram automaticamente com o tempo sem engenharia adicional
- Checkpointing nativo: sessões longas do Builder não reiniciam após falhas de rede
- Observabilidade completa no Claude Console — cada tool call de cada sub-agente é rastreável
- Permission policies e credential vaults resolvem gestão de segredos sem Infisical self-hosted
- Webhooks nativos integram diretamente com o fluxo HITL

### Negativas
- **Lock-in em modelos Claude** — impossível usar Ollama local ou outros providers por agente
- **Custo por token** — sem free tier; requer saldo na Claude Platform API
- **Beta** — `managed-agents-2026-04-01` header obrigatório; comportamentos podem ser refinados
- **Dados em infra Anthropic** — sessões e memórias armazenadas externamente; avaliar LGPD para dados de clientes
- **Sem Batch API** — desconto de 50% de batch não se aplica a sessões Managed Agents
- **Profundidade de orquestração limitada** — máximo 1 nível (coordenador não pode spawnar sub-orquestradores)

---

## Alternativas consideradas

### CrewAI self-hosted
- **Prós:** Multi-LLM por agente (Ollama local gratuito), controle total de dados, sem lock-in
- **Contras:** Requer implementar: loop de agente, BullMQ + Redis para filas, sandboxing, checkpointing, credential vault (Infisical), observabilidade (LangSmith/Jaeger). Estimativa: +3–4 semanas de setup. Memory/dreaming: implementação do zero
- **Descartado para MVP** — custo de engenharia não justifica no momento

### LangGraph self-hosted
- **Prós:** Controle fino de grafo de estados, suporte a ciclos complexos, multi-framework
- **Contras:** Mesmas desvantagens de infraestrutura do CrewAI, curva de aprendizado maior
- **Descartado** — complexidade adicional sem ganho claro sobre CrewAI para este caso de uso

---

## Critérios de reavaliação

Esta decisão deve ser reavaliada se:
- Volume mensal de tokens superar $500 (ponto onde Ollama self-hosted se torna mais barato)
- Anthropic alterar pricing de Managed Agents de forma desfavorável na saída do beta
- Requisito de rodar modelos offline (cliente enterprise sem conectividade)
- LGPD exigir que dados de conversas com clientes finais não deixem infraestrutura nacional

---

## Referências

- [Claude Managed Agents overview](https://platform.claude.com/docs/en/managed-agents/overview)
- [Pricing](https://platform.claude.com/docs/en/about-claude/pricing)
- [Dreaming docs](https://platform.claude.com/docs/en/managed-agents/dreams)
- Discussão de arquitetura: conversa de design do AgentePro (mai/2026)

---

## ⚠️ Nota de Implementação (2026-05-09)

**Estado atual:** Esta decisão está marcada como **Proposto**, não Aceito.
O runtime atual do AgentePro é **100% CrewAI + LiteLLM** (Python), implementado em `apps/agent-runtime/`.
A migração para Claude Managed Agents será reavaliada quando o threshold de $500/mês em tokens for atingido.
A Arquitetura Hexagonal (Ports and Adapters) já suporta essa troca futura via interface `AgentRuntime` sem impacto na API.
