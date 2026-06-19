# Hefesto — Documentação Arquitetural

> Este diretório contém a documentação técnica e arquitetural do projeto Hefesto.
> Para a documentação de execução/setup, consulte o [`README.md` na raiz](../README.md).

---

## 📂 Estrutura

```
docs/
└── adr/          → Architecture Decision Records (ADRs)
                    15 ADRs cobrindo Infraestrutura, Arquitetura, Segurança,
                    Produto, Legal e Roadmap
```

---

## 🏛️ ADRs — Architecture Decision Records

Os ADRs documentam as decisões técnicas e de produto significativas tomadas no projeto,
incluindo contexto, alternativas consideradas e consequências esperadas.

**→ [Ver índice completo de ADRs](adr/README.md)**

### Status atual dos ADRs

| Status              | ADRs                                            | Significado                                          |
| ------------------- | ----------------------------------------------- | ---------------------------------------------------- |
| ✅ Aceito           | ADR-003, 004, 005, 006, 010, 012, 013, 014, 015 | Implementado no código atual                         |
| ⚠️ Aceito (parcial) | ADR-002                                         | Conceito implementado, providers diferem do descrito |
| ⏳ Proposto         | ADR-001                                         | Decisão futura — não implementado, em avaliação      |
| 🗺️ Aceito (roadmap) | ADR-009                                         | Decisão válida para fase futura do produto           |
| 📋 Planejado        | ADR-007, ADR-008, ADR-011                       | Aceito, implementação planejada nas Fases 10–13      |

---

## 📋 ADRs — Índice Rápido por Área

### Infraestrutura

- [ADR-001](adr/ADR-001-runtime-orquestracao-agentes.md) — Runtime de orquestração _(Proposto: Claude Managed Agents — runtime atual: CrewAI)_
- [ADR-005](adr/ADR-005-estrategia-hospedagem.md) — Hospedagem distribuída 100% gratuita no MVP
- [ADR-012](adr/ADR-012-observabilidade-escalabilidade.md) — Observabilidade (Prometheus + Grafana + Jaeger + Loki)
- [ADR-013](adr/ADR-013-escolha-fastify-backend.md) — Escolha do Framework Backend (Fastify)
- [ADR-015](adr/ADR-015-hospedagem-api-railway.md) — Hospedagem da API Backend no Railway

### Arquitetura

- [ADR-002](adr/ADR-002-estrategia-llm-por-agente.md) — Interface desacoplada de LLM por agente
- [ADR-003](adr/ADR-003-arquitetura-hexagonal-cqrs-ddd.md) — Hexagonal + CQRS + DDD ✅ Implementado

### Segurança

- [ADR-004](adr/ADR-004-hitl-acoes-externas.md) — HITL obrigatório para ações externas
- [ADR-006](adr/ADR-006-estrategia-seguranca.md) — Security First transversal (OWASP)

### Produto e Negócio

- [ADR-007](adr/ADR-007-modelo-negocio-precificacao.md) — Modelo de negócio e Pricing Engine _(Fase 10)_
- [ADR-008](adr/ADR-008-estrategia-entrega-sites.md) — Entrega de sites com templates curados _(Fase 13)_
- [ADR-009](adr/ADR-009-roadmap-expansao-agentes.md) — Roadmap pós-MVP: SEO, Social, Tráfego Pago

### Agentes / IA

- [ADR-010](adr/ADR-010-estrategia-rag-conhecimento.md) — RAG e gestão de conhecimento (ChromaDB)
- [ADR-014](adr/ADR-014-versionamento-prompts.md) — Versionamento de Prompts (Prompt-as-Code)

### Legal / Compliance

- [ADR-011](adr/ADR-011-estrategia-contratual-compliance.md) — Clickwrap + LGPD + CDC _(Fase 12)_

---

## 🔗 Outros recursos

- **PRD Central**: [`PRD_Hefesto.md`](PRD_Hefesto.md)
- **Prompts dos Agentes**: [`agents/prompts/`](agents/prompts/)
- **Segurança**: [`SECURITY.md`](../SECURITY.md)

---

_Última atualização: 2026-05-18 | Responsável: Arquiteto_
