# ADR-003: CrewAI para Orquestração de Multi-agents

**Status:** Aceito  
**Data:** 2026-05-29  

## Contexto

Precisamos de orquestração de múltiplos agentes com suporte a paralelismo, sub-agentes e passagem de contexto entre tasks.

## Decisão

Usar **CrewAI** como framework de orquestração de agentes no Python runtime.

## Justificativa

- Suporte nativo a `async_execution=True` para paralelismo de tasks
- Modelo Agent/Task/Crew bem definido e testável
- Integração direta com LiteLLM
- Process.hierarchical para hierarquia de agentes
- Comunidade ativa e atualizações frequentes em 2026

## Consequências

- Lock-in no modelo Agent/Task/Crew do CrewAI
- Versões do CrewAI podem ter breaking changes
- Debugging de agentes paralelos é mais complexo

## Mitigação

- Base class `BaseSubAgent` isola o código de negócio do CrewAI
- Se migrar de CrewAI: apenas reimplementar `BaseSubAgent.execute()` e `build_task()`
- Pinagem de versão no `pyproject.toml` (`crewai==0.65.x`)

---