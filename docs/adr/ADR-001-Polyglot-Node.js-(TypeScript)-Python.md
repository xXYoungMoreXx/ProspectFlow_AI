# ADR-001: Polyglot Node.js (TypeScript) + Python

**Status:** Aceito  
**Data:** 2026-05-29  
**Decidido por:** Arquitetura  

## Contexto

O sistema precisa de dois componentes distintos:
1. API REST com autenticação, CRM, HITL, banco de dados relacional
2. Orquestração de agentes de IA com CrewAI, LiteLLM, RAG com ChromaDB

## Decisão

Usar dois runtimes separados:
- **Node.js 22 + TypeScript 5.5 + Fastify 5** para a API e camada de aplicação
- **Python 3.12 + CrewAI + LiteLLM** para o runtime de agentes

Comunicação entre os dois via **HTTP interno** (não gRPC, não message queue).

## Justificativa

O ecossistema Python para AI/ML é significativamente mais maduro:
- CrewAI, LangChain, LiteLLM têm Python como primeira classe
- ChromaDB, Ollama Python SDK, HuggingFace — todos Python-first
- TypeScript equivalentes (LangChain.js) são menos completos e menos estáveis em 2026

O Node.js/TypeScript vence para API:
- Fastify é mais rápido que FastAPI para HTTP puro
- Drizzle ORM, Zod, tsyringe têm maturidade comprovada
- Time provavelmente tem mais experiência em TypeScript

## Consequências Positivas

- Melhores ferramentas para cada domínio
- Isolamento: falha no agent-runtime não derruba a API
- Escalonamento independente (API e agentes podem ter réplicas diferentes)

## Consequências Negativas

- Dois Dockerfiles e duas pipelines de CI
- Duplicação de modelos de dados (DTOs em TS e Pydantic em Python)
- Latência de ~1ms por chamada HTTP entre os dois serviços
- Dois gerenciadores de dependências (npm + pip)

## Mitigação

- Contratos HTTP bem definidos (OpenAPI spec para a API interna)
- shared-types package em TS; Pydantic models gerados automaticamente do OpenAPI
- Docker Compose garante rede interna (latência negligenciável)
- Se volume > 200 sites/mês: reavaliar LangChain.js para unificar

## Alternativas Consideradas

- **LangChain.js completo (TypeScript):** descartado — suporte a multi-agent/CrewAI muito inferior
- **Python completo (FastAPI para tudo):** descartado — ecosistema de auth, ORM e tipagem menos maduro
- **Go para a API:** descartado — curva de aprendizado alta sem ganho justificável

---