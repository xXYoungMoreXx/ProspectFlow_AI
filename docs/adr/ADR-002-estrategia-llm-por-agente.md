# ADR-002: Estratégia de LLM por agente — interface desacoplada

**Status:** Aceito (parcial) ⚠️
**Data:** 2026-05-09  
**Deciders:** Arquiteto  
**Tags:** llm, ollama, anthropic, acoplamento, hexagonal

---

## Contexto

O PRD especifica que o operador deve poder configurar o LLM de cada agente independentemente, escolhendo entre:

- **API key externa** (Claude Sonnet/Opus, GPT-4o, Groq, etc.)
- **Ollama local** (Llama 3.2, Mistral, CodeLlama) — custo zero, privacidade máxima

A decisão ADR-001 adotou Claude Managed Agents, que **bloqueia** a escolha de provider por agente — todas as sessões rodam exclusivamente em modelos Claude. Isso cria tensão com o requisito original do PRD.

A questão é: como preservar a flexibilidade arquitetural de troca de LLM sem inviabilizar os ganhos do Managed Agents?

---

## Decisão

**Implementar interface `LLMProvider` no domain layer, com duas implementações concretas para o MVP:**

1. `ManagedAgentsLLMProvider` — usa Claude Managed Agents (padrão do MVP)
2. `OllamaLLMProvider` — chamadas diretas à API REST do Ollama (disponível para agentes leves em desenvolvimento local)

A configuração de LLM por agente na UI **mantém** os campos de provider e modelo, mas exibe aviso ao operador quando Managed Agents está ativo de que o provider é Claude. Essa UI é preservada para uso futuro quando o volume justificar migração parcial.

```typescript
// Domain port — sem deps externas
interface LLMProvider {
  readonly providerId: string
  complete(messages: Message[], config: LLMConfig): Promise<LLMResponse>
  stream(messages: Message[], config: LLMConfig): AsyncIterable<LLMChunk>
  isAvailable(): Promise<boolean>
}

// Configuração por agente — sempre via interface
interface AgentLLMConfig {
  provider: LLMProviderId      // 'managed_agents' | 'ollama' | 'openai' | 'groq'
  model: string
  baseUrl?: string             // Para Ollama: http://localhost:11434
  apiKeyRef?: string           // Referência ao vault, nunca o valor
  temperature: number
  maxTokens: number
  systemPrompt: string
}
```

### Regra de seleção de modelo por persona (Managed Agents)

| Persona | Modelo padrão | Justificativa |
|---------|--------------|---------------|
| Hunter  | claude-sonnet-4-6 | Custo-benefício — tarefa de qualificação |
| Closer  | claude-sonnet-4-6 | Equilíbrio qualidade/custo em negociação |
| Builder | claude-sonnet-4-6 | Geração de código de qualidade |
| QA      | claude-haiku-4-5 | Verificações simples e rápidas — menor custo |

---

## Consequências

### Positivas
- Domain layer nunca importa SDK Anthropic ou Ollama — troca de provider é trocar o adapter
- Campos de configuração de LLM na UI já existem — sem retrabalho ao migrar
- Agentes leves (Hunter em dev) podem rodar em Ollama local sem custo
- QA Agent com Haiku reduz custo de verificações repetitivas em ~70%

### Negativas
- Overhead de manutenção: dois adapters ativos mesmo que apenas um seja usado no MVP
- Operador pode tentar configurar Ollama para agentes em produção com Managed Agents ativo — UI precisa de validação clara
- Testes precisam mockar a interface em vez de chamar APIs reais — adiciona complexidade de test setup

---

## Alternativas consideradas

### Acoplamento direto ao SDK Anthropic
- **Descartado** — viola Dependency Rule da arquitetura hexagonal; torna migração futura cara

### LiteLLM como abstração universal
- **Prós:** Uma biblioteca abstrai OpenAI, Anthropic, Ollama, Groq com interface unificada
- **Contras:** Dependência externa no domain layer; LiteLLM é infra, não deve vazar para o domain
- **Decisão:** LiteLLM pode ser usado **dentro** do adapter de infraestrutura, nunca exposto ao domain

---

## Critérios de reavaliação

- Volume > $500/mês em tokens → avaliar migração do Hunter para Ollama local (econômico para tarefas de qualificação em escala)
- Anthropic lançar tier free de Managed Agents → reavaliar custo-benefício
- Cliente enterprise exigir execução offline → ativar OllamaLLMProvider para todos os agentes

---

## ⚠️ Nota de Implementação (2026-05-09)

Este ADR descreve `ManagedAgentsLLMProvider` e `OllamaLLMProvider` como os dois providers.
**Estado atual:** A camada TypeScript (`apps/api/src/infrastructure/llm/`) possui **4 adapters implementados**: `AnthropicAdapter`, `OpenAIAdapter`, `GoogleAdapter`, `OllamaAdapter` — gerenciados por `CompositeLLMRouter`.
O `ManagedAgentsLLMProvider` ainda não existe (depende da migração do ADR-001, Status: Proposto).
O conceito de interface desacoplada (porta `LLMRouter`) está implementado conforme o princípio deste ADR.
