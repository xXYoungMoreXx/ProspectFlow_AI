# ADRs — AgentePro: Índice de Decisões Arquiteturais

> Architecture Decision Records documentam as decisões técnicas e de produto significativas
> tomadas no projeto, incluindo o contexto, as alternativas consideradas e as consequências.
> São a memória do projeto — especialmente críticos em vibe coding para manter consistência
> entre sessões de desenvolvimento com AI.

## Como usar este índice

Em cada sessão de desenvolvimento, inclua no contexto os ADRs relevantes para a área
que está trabalhando. O CLAUDE.md referencia este índice e os ADRs mais críticos.

---

## ADRs por status

### ✅ Aceitos (decisão tomada e implementada/em implementação)

| # | Título | Área | Data |
|---|--------|------|------|
| [ADR-002](ADR-002-estrategia-llm-por-agente.md) | Estratégia de LLM por agente — interface desacoplada | Arquitetura | 2026-05-09 |
| [ADR-003](ADR-003-arquitetura-hexagonal-cqrs-ddd.md) | Hexagonal Architecture + CQRS + DDD | Arquitetura | 2026-05-09 |
| [ADR-004](ADR-004-hitl-acoes-externas.md) | HITL obrigatório para ações externas | Segurança / Produto | 2026-05-09 |
| [ADR-005](ADR-005-estrategia-hospedagem.md) | Hospedagem distribuída — 100% gratuita no MVP | Infraestrutura | 2026-05-09 |
| [ADR-006](ADR-006-estrategia-seguranca.md) | Segurança Security First transversal (OWASP) | Segurança | 2026-05-09 |
| [ADR-007](ADR-007-modelo-negocio-precificacao.md) | Modelo de negócio e estratégia de precificação | Produto / Negócio | 2026-05-09 |
| [ADR-008](ADR-008-estrategia-entrega-sites.md) | Entrega de sites — templates curados + Framer Motion | Builder / Produto | 2026-05-09 |
| [ADR-009](ADR-009-roadmap-expansao-agentes.md) | Roadmap de expansão — SEO, Social, Tráfego | Produto / Roadmap | 2026-05-09 |
| [ADR-010](ADR-010-estrategia-rag-conhecimento.md) | RAG e gestão de conhecimento — ChromaDB + Context7 | Agentes / IA | 2026-05-09 |
| [ADR-011](ADR-011-estrategia-contratual-compliance.md) | Estratégia contratual — Clickwrap + LGPD + CDC | Legal / Compliance | 2026-05-09 |
| [ADR-012](ADR-012-observabilidade-escalabilidade.md) | Observabilidade — Prometheus + Grafana + Jaeger | Infraestrutura | 2026-05-09 |
| [ADR-013](ADR-013-escolha-fastify-backend.md) | Escolha do Framework Backend — Fastify | Infraestrutura | 2026-05-01 |
| [ADR-014](ADR-014-versionamento-prompts.md) | Estratégia de versionamento de prompts (Prompt-as-Code) | Agentes / IA | 2026-05-01 |

### ⏳ Propostos (em avaliação)

| # | Título | Área | Data |
|---|--------|------|------|
| [ADR-001](ADR-001-runtime-orquestracao-agentes.md) | Runtime de orquestração — Claude Managed Agents | Infraestrutura | 2026-05-09 |

---

## Mapa de dependências entre ADRs

```
ADR-003 (Hexagonal)
  ├── ADR-002 (LLM interface) — port desacoplado exige hexagonal
  ├── ADR-006 (Segurança) — zero trust por camada exige hexagonal
  └── ADR-010 (RAG) — ChromaDB como adapter de infraestrutura

ADR-001 (Managed Agents)
  ├── ADR-002 (LLM) — managed agents é a implementação do port LLM
  ├── ADR-004 (HITL) — webhooks nativos do managed agents
  └── ADR-012 (Observabilidade) — Claude Console complementa Jaeger

ADR-007 (Precificação)
  ├── ADR-010 (RAG) — PricingIntelligence é uma collection do ChromaDB
  └── ADR-011 (Legal) — cobrança upfront + clickwrap são dependentes

ADR-008 (Builder/Sites)
  ├── ADR-006 (Segurança) — security headers obrigatórios nos templates
  ├── ADR-009 (Expansão) — analytics depende de GA4 instalado pelo Builder
  └── ADR-005 (Hospedagem) — Vercel/Netlify para deploy dos sites

ADR-009 (Expansão)
  └── ADR-004 (HITL) — HITL financeiro obrigatório para tráfego pago
```

---

## Template para novos ADRs

```markdown
# ADR-NNN: Título da decisão

**Status:** Proposto | Em revisão | Aceito | Depreciado | Substituído por ADR-XXX
**Data:** YYYY-MM-DD
**Deciders:** [quem tomou a decisão]
**Tags:** [categorias]

## Contexto
[Qual o problema? Por que essa decisão é necessária agora?]

## Decisão
[O que foi decidido? Como implementar?]

## Consequências
### Positivas
### Negativas

## Alternativas consideradas
[O que foi descartado e por quê?]

## Critérios de reavaliação
[Quando esta decisão deve ser revisitada?]
```

---

## Convenções

- Um ADR por decisão significativa — não agrupe decisões não relacionadas
- Uma vez aceito, não altere o conteúdo — crie um novo ADR que substitui o anterior
- Status "Depreciado" = decisão ainda válida mas não recomendada para novos contextos
- Status "Substituído por ADR-XXX" = use o ADR mais recente
- Sempre link os ADRs relacionados na seção de referências

---

*Última atualização: 2026-05-10 | Total: 13 ADRs aceitos, 1 proposto*
