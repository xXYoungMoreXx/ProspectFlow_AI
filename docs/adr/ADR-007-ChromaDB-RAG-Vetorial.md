# ADR-007: ChromaDB para RAG Vetorial

**Status:** Aceito  
**Data:** 2026-05-29  

## Contexto

Sistema de RAG para os agentes: templates de proposta por nicho, critérios de qualificação, templates de site, briefing por segmento.

## Decisão

Usar **ChromaDB** self-hosted com **Ollama nomic-embed-text** para embeddings.

## Justificativa

- **Gratuito:** Self-hosted, sem custo de API
- **Simples:** API simples para add/query/delete de documentos
- **Python SDK:** Integração direta com CrewAI e LangChain
- **Persistência:** Docker volume para dados persistentes
- **nomic-embed-text:** Modelo de embedding gratuito via Ollama, qualidade boa para pt-BR

## Coleções

```
lead_qualification_criteria      — critérios de score por segmento
briefing_templates_by_niche      — roteiros de perguntas por nicho
proposal_templates               — templates de proposta por serviço
site_templates                   — templates de site aprovados
copywriting_rag                  — exemplos de copy por segmento
```

## Alternativas

- Pinecone: descartado — custo, dependência de nuvem
- Qdrant: alternativa válida, mais features, mas complexidade maior
- pgvector (PostgreSQL): alternativa simples mas sem UI e menor performance para buscas grandes
- Weaviate: descartado — complexidade operacional alta

## Mitigação do Lock-in

LangChain abstrai o backend vetorial. Migrar de ChromaDB para Qdrant exigiria apenas trocar o adapter no LangChain, sem tocar nos agents.