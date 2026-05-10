# ADR-003: Arquitetura Hexagonal + CQRS + DDD como padrão estrutural

**Status:** Aceito  
**Data:** 2026-05-09  
**Deciders:** Arquiteto  
**Tags:** arquitetura, hexagonal, cqrs, ddd, clean-code

---

## Contexto

O AgentePro é um sistema com múltiplos bounded contexts (IAM, Lead & Prospecting, Sales & Negotiation, Delivery & Development, Agent Management, CRM, Pricing), integrações com serviços externos voláteis (LLMs, WhatsApp, Vercel, gateways de pagamento) e um requisito explícito de extensibilidade: novos serviços (tráfego, social media, SEO) devem ser adicionados sem tocar no núcleo existente.

O perfil de desenvolvimento é vibe coding com AI — o que cria um risco específico: **o AI pode introduzir acoplamento implícito entre camadas se a estrutura de diretórios não for explicitamente respeitada**. A arquitetura precisa ser suficientemente clara para que o CLAUDE.md a descreva em termos que o AI entenda e respeite durante a geração de código.

---

## Decisão

**Hexagonal Architecture (Ports & Adapters) como padrão estrutural principal, com CQRS no application layer e modelagem DDD no domain layer.**

### Regra de dependência (inviolável)

```
Infrastructure → Application → Domain
      ↑                ↑           ↑
  (adapters)      (use cases)  (entities)
```

Nenhuma classe no `domain/` importa de `application/` ou `infrastructure/`. Nenhuma classe no `application/` importa de `infrastructure/`. Violação desta regra é bloqueada no CI via lint customizado (import-no-restricted-paths).

### Bounded Contexts definidos

| Context | Responsabilidade | Pasta |
|---------|-----------------|-------|
| IAM | Autenticação do operador, tokens | `src/domain/iam/` |
| Lead & Prospecting | Lifecycle do lead, mensagens | `src/domain/lead/` |
| Sales & Negotiation | Deals, propostas, precificação | `src/domain/sales/` |
| Delivery | Projetos, sites, deploy | `src/domain/delivery/` |
| Agent Management | Configuração de agentes | `src/domain/agent/` |
| Pricing Intelligence | Engine de precificação, custos | `src/domain/pricing/` |
| HITL | Aprovações, audit trail | `src/domain/hitl/` |

### CQRS no Application Layer

Toda operação de escrita é um `Command` com seu `CommandHandler`. Toda leitura é uma `Query` com seu `QueryHandler`. Handlers nunca são compartilhados.

```
src/application/
  lead/
    commands/
      QualifyLead.command.ts
      QualifyLead.handler.ts
    queries/
      GetLeadById.query.ts
      GetLeadById.handler.ts
```

### Event-Driven entre contexts

Comunicação entre bounded contexts exclusivamente via Domain Events. Nunca chamada direta de um domain para outro.

```typescript
// Hunter emite — Sales consome. Nunca Hunter chama Sales diretamente.
class LeadQualified implements DomainEvent {
  readonly eventType = 'lead.qualified'
  constructor(
    readonly leadId: LeadId,
    readonly score: QualificationScore,
    readonly correlationId: UUID,
  ) {}
}
```

### Anti-Corruption Layer (ACL)

Todo serviço externo (Anthropic SDK, Evolution API WhatsApp, Vercel API, Mercado Pago) é envolvido por um adapter que implementa uma interface de domínio própria. O domain nunca vê nomes de classes externas.

---

## Consequências

### Positivas
- Novos serviços (agente de tráfego, SEO) adicionados como novos bounded contexts sem alterar contexts existentes
- Testes unitários do domain não precisam de mocks de banco ou HTTP — sem deps externas
- Troca de provider LLM, gateway de pagamento ou plataforma de deploy: trocar o adapter, não o domain
- CLAUDE.md pode descrever a regra de dependência em poucas linhas — o AI respeita durante geração de código
- CI verifica violações de dependência automaticamente

### Negativas
- Verbosidade inicial: criar Command + Handler + Event para cada operação simples parece over-engineering nas primeiras semanas
- Curva de aprendizado para contribuidores que não conhecem Hexagonal/DDD
- Mais arquivos por feature — aceitável dado o benefício de longo prazo

---

## Alternativas consideradas

### MVC simples (Express + controllers + models)
- **Descartado** — acoplamento direto entre rotas e lógica de negócio cria dívida técnica rapidamente; difícil de testar; integrações externas vazam para controllers

### Clean Architecture (Screaming Architecture)
- **Considerada** — muito similar à Hexagonal; a diferença é semântica (use cases vs ports)
- **Decisão:** Hexagonal foi escolhida por ser mais explícita sobre a direção dos adapters, o que é mais fácil de comunicar ao AI durante vibe coding

---

## Nota sobre vibe coding

O arquivo `CLAUDE.md` na raiz do repositório instrui o AI a:
1. Nunca importar de `infrastructure/` dentro de `domain/`
2. Sempre criar Command + Handler para operações de escrita
3. Comunicação cross-context somente via Domain Events
4. Nunca usar classes de SDK externo (Anthropic, Axios) fora de `infrastructure/`

Essa instrução reduz drasticamente o risco de acoplamento acidental durante sessões de geração de código.
