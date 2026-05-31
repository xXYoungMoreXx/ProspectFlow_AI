# ADR-002: LiteLLM como Abstração Única de LLMs

**Status:** Aceito  
**Data:** 2026-05-29  

## Contexto

O sistema usa múltiplos providers de LLM: Anthropic, Google Gemini, OpenAI, Groq e Ollama. Cada um tem SDK diferente, interface diferente e comportamento diferente em erros.

## Decisão

Usar **LiteLLM** como camada de abstração única. Toda chamada LLM passa pelo LiteLLM, nunca diretamente pelos SDKs dos providers.

## Justificativa

- Interface única: `litellm.completion(model="...", messages=[...])` funciona para todos os providers
- Fallback automático configurável
- Logging e observabilidade unificados (LangSmith, Phoenix)
- Token counting consistente entre providers
- Custo estimado disponível via `litellm.cost_per_token()`

## Consequências

- Dependência do LiteLLM — se o projeto for descontinuado, migração necessária
- Slight overhead vs. SDK direto (~2ms por call)
- Modelos novos precisam de suporte no LiteLLM antes de usar

## Alternativas

- SDKs diretos por provider: descartado — manutenção de 5 integrações diferentes
- LangChain: descartado — mais pesado que necessário para esta camada

---