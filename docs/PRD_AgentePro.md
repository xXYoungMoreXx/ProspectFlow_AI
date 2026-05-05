# PRD — AgentePro: Plataforma de Agentes de IA para Prospecção e Entrega de Serviços

**Versão:** 1.0.0  
**Status:** Draft — Aprovação Pendente  
**Última atualização:** 2026-05-01  
**Autor:** Produto / Arquitetura  
**Metodologias:** Clean Architecture · Hexagonal Arch · DDD · TDD · BDD · SDD · Security First · GSD

---

## Índice

1. [Visão Executiva](#1-visão-executiva)
2. [Contexto e Problema](#2-contexto-e-problema)
3. [Objetivos e Métricas de Sucesso](#3-objetivos-e-métricas-de-sucesso)
4. [Escopo do MVP](#4-escopo-do-mvp)
5. [Stakeholders e Personas](#5-stakeholders-e-personas)
6. [Arquitetura Geral](#6-arquitetura-geral)
7. [Domain Model — DDD](#7-domain-model--ddd)
8. [Especificação dos Agentes](#8-especificação-dos-agentes)
9. [Requisitos Funcionais](#9-requisitos-funcionais)
10. [Requisitos Não-Funcionais](#10-requisitos-não-funcionais)
11. [Segurança — Security First](#11-segurança--security-first)
12. [API Design](#12-api-design)
13. [Schema de Banco de Dados](#13-schema-de-banco-de-dados)
14. [Estratégia de Testes](#14-estratégia-de-testes)
15. [Observabilidade e Escalabilidade](#15-observabilidade-e-escalabilidade)
16. [Stack Tecnológica](#16-stack-tecnológica)
17. [Estrutura de Diretórios](#17-estrutura-de-diretórios)
18. [Gestão de Segredos e Configuração](#18-gestão-de-segredos-e-configuração)
19. [Roadmap e Fases](#19-roadmap-e-fases)
20. [Riscos e Mitigações](#20-riscos-e-mitigações)
21. [Glossário](#21-glossário)

---

## 1. Visão Executiva

O **AgentePro** é uma plataforma de agentes de IA que automatiza o ciclo completo de vendas e entrega de serviços digitais — da prospecção ao produto final entregue ao cliente — com mínima intervenção humana e máximo controle do operador.

No MVP, a plataforma entrega um ciclo fechado: um agente prospecta e qualifica leads, um agente de vendas negocia e fecha contratos, e um agente desenvolvedor entrega sites personalizados. O operador humano mantém controle via painel central com aprovação obrigatória (HITL) em todas as ações externas críticas.

A arquitetura é construída para ser **extensível por design**: novos serviços (gestão de tráfego, social media, SEO) são adicionados como novos Bounded Contexts sem tocar no núcleo existente.

---

## 2. Contexto e Problema

### Problema Central
Profissionais e pequenas agências digitais perdem entre 40–70% do seu tempo em tarefas repetitivas: prospecção manual de clientes, elaboração de propostas, negociação básica e desenvolvimento de sites padronizados. O custo de aquisição de clientes é alto e o ciclo de vendas é lento.

### Solução Proposta
Agentes de IA especializados por função, orquestrados numa plataforma configurável, que executam o funil completo de vendas e entrega. O operador humano foca em aprovações estratégicas e no crescimento do negócio.

### Diferencial
- Configuração por UI (não por código) para cada agente: skills, rules, workflows, RAG, MCPs e fine-tuning
- Escolha de LLM por agente: API key externa (OpenAI, Anthropic, Groq) ou Ollama local
- Ciclo de entrega fechado no MVP: prospecta → vende → entrega → fatura

---

## 3. Objetivos e Métricas de Sucesso

### OKRs do MVP (90 dias pós-lançamento)

| Objetivo | Key Result | Meta |
|---|---|---|
| Validar ciclo de vendas autônomo | Leads contatados por agente | ≥ 50/semana |
| Validar entrega automatizada | Sites entregues sem intervenção técnica | ≥ 80% do total |
| Validar confiança do operador | Taxa de aprovação HITL sem override manual | ≥ 70% |
| Validar qualidade técnica | Score Lighthouse mínimo nos sites gerados | ≥ 85 performance, 100 a11y |
| Segurança | Vulnerabilidades críticas (OWASP Top 10) em produção | 0 |

### KPIs de Produto

- Tempo médio do ciclo lead→site entregue: < 48h
- Taxa de conversão lead→cliente: monitorada por cohort
- Custo por entrega de site: < R$10 em tokens LLM
- Uptime da plataforma: ≥ 99.5%

---

## 4. Escopo do MVP

### Incluído no MVP

```
[ MVPV1 ]
 ├── Autenticação segura do operador (JWT + Argon2)
 ├── Painel de gestão de agentes (criar, editar, configurar)
 │   ├── Skills (habilidades/ferramentas por agente)
 │   ├── Rules (regras de comportamento)
 │   ├── Workflows (sequências de ações via n8n)
 │   └── Configuração de LLM (API key ou Ollama local + modelo)
 ├── Agente Prospector (Persona: Hunter)
 │   ├── Pesquisa de leads via web scraping controlado
 │   ├── Qualificação por critérios configuráveis
 │   └── HITL: aprovação antes de contato externo
 ├── Agente de Vendas (Persona: Closer)
 │   ├── Negociação via chat (WhatsApp/Email simulado)
 │   ├── Geração de proposta com precificação dinâmica
 │   └── HITL: aprovação de proposta antes de enviar
 ├── Agente Desenvolvedor (Persona: Builder)
 │   ├── Geração de site via templates curados
 │   ├── Customização por briefing do cliente
 │   ├── Deploy automático (Vercel/Netlify free tier)
 │   └── HITL: aprovação antes de envio ao cliente
 ├── CRM básico
 │   ├── Histórico de conversas por cliente
 │   ├── Status do projeto e precificação
 │   └── Valor cobrado e composição de custo
 └── RAG básico por agente (ChromaDB)
```

### Fora do MVP (v2+)

- Agente de tráfego pago
- Agente de social media
- Fine-tuning de modelos
- Integração com gateways de pagamento
- Multi-tenant (múltiplos operadores)
- Marketplace de templates

---

## 5. Stakeholders e Personas

### Operador (usuário direto do sistema)
Freelancer ou dono de micro-agência digital. Quer automatizar prospecção e entrega sem precisar codar. Técnico o suficiente para entender configurações básicas de agentes. Máxima prioridade: **não queimar a imagem dele com clientes por mensagens ruins dos agentes**.

### Cliente Final (prospect abordado pelos agentes)
Pequeno empresário ou profissional liberal. Recebe contato via WhatsApp ou e-mail. Não sabe que está falando com um agente de IA inicialmente. Quer um site rápido, bonito e barato.

### Agente de IA (persona técnica)
Entidade computacional com papel, skills, rules e memória. Não é usuário, mas é tratado como ator no sistema com seus próprios bounded contexts, configurações e logs de ação.

---

## 6. Arquitetura Geral

### Padrão Arquitetural: Hexagonal (Ports & Adapters) + Layered por contexto

```
┌─────────────────────────────────────────────────────────────────┐
│                        DRIVING SIDE                             │
│  REST API  │  WebSocket  │  n8n Webhook  │  CLI (admin)         │
└──────────────────┬──────────────────────────────────────────────┘
                   │ (Primary Ports)
┌──────────────────▼──────────────────────────────────────────────┐
│                    APPLICATION LAYER                            │
│  Use Cases / Commands / Queries (CQRS)                          │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐               │
│  │ AgentUseCase│ │SalesUseCase │ │DeliveryUC   │               │
│  └─────────────┘ └─────────────┘ └─────────────┘               │
└──────────────────┬──────────────────────────────────────────────┘
                   │
┌──────────────────▼──────────────────────────────────────────────┐
│                      DOMAIN LAYER (Core)                        │
│  Entities · Value Objects · Domain Events · Aggregates          │
│  Domain Services · Specifications · Repository Interfaces       │
└──────────────────┬──────────────────────────────────────────────┘
                   │ (Secondary Ports)
┌──────────────────▼──────────────────────────────────────────────┐
│                    INFRASTRUCTURE LAYER                         │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐           │
│  │PostgreSQL│ │ChromaDB  │ │LLM Router│ │n8n Client│           │
│  │(Supabase)│ │(RAG)     │ │(Ollama/  │ │(workflows│           │
│  │          │ │          │ │API)      │ │)         │           │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘           │
└─────────────────────────────────────────────────────────────────┘
                   │ (Driven Side)
┌──────────────────▼──────────────────────────────────────────────┐
│                     EXTERNAL SERVICES                           │
│  WhatsApp (Evolution API) · SMTP · Vercel · Netlify · Web Search│
└─────────────────────────────────────────────────────────────────┘
```

### Princípios Arquiteturais Obrigatórios

1. **Dependency Rule**: dependências sempre apontam para dentro (infra → app → domain). Domain nunca importa de infra.
2. **CQRS**: Commands (escrita) e Queries (leitura) separados em handlers distintos. Sem lógica de negócio em queries.
3. **Event-Driven**: toda ação de agente emite um Domain Event. Handlers de eventos são assíncronos.
4. **ACL (Anti-Corruption Layer)**: na integração com LLMs externos e serviços terceiros, sempre via adapter com interface de domínio própria. Nunca expor SDKs externos ao domain.
5. **Repository Pattern**: acesso a dados sempre por interfaces. Implementações são infraestrutura.
6. **Zero Trust interno**: cada serviço valida tokens independentemente. Sem confiança implícita entre módulos.

### Bounded Contexts (DDD)

```
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│  Identity &     │  │  Lead &          │  │  Sales &        │
│  Access         │  │  Prospecting     │  │  Negotiation    │
│  (IAM)          │  │  (Hunter)        │  │  (Closer)       │
└─────────────────┘  └────────┬────────┘  └────────┬────────┘
                               │ Domain Event        │ Domain Event
                               │ LeadQualified       │ DealClosed
┌─────────────────┐  ┌────────▼────────┐  ┌────────▼────────┐
│  Agent          │  │  Delivery &     │  │  CRM &          │
│  Management     │  │  Development    │  │  Client History │
│  (Studio)       │  │  (Builder)      │  │  (Memory)       │
└─────────────────┘  └─────────────────┘  └─────────────────┘
```

### Padrão GSD (Get Shit Done)

Todos os módulos seguem o ciclo GSD:

```
Plan → Scope → Build → Test → Ship → Measure → Improve
```

Cada sprint de desenvolvimento mapeia uma iteração GSD completa com Definition of Done (DoD) explícita por feature.

---

## 7. Domain Model — DDD

### Aggregates e Entidades Principais

#### Aggregate: Agent

```typescript
// Domain Entity
class Agent {
  readonly id: AgentId                    // Value Object
  readonly persona: AgentPersona          // Enum: HUNTER | CLOSER | BUILDER | QA
  name: AgentName                         // Value Object (min 3, max 50 chars)
  llmConfig: LLMConfiguration             // Value Object
  skills: SkillCollection                 // Value Object Collection
  rules: RuleCollection                   // Value Object Collection
  status: AgentStatus                     // Enum: ACTIVE | INACTIVE | PAUSED
  ragConfig?: RAGConfiguration            // Optional Value Object
  mcpServers: MCPServerCollection         // Value Object Collection
  createdAt: Timestamp
  updatedAt: Timestamp

  // Domain Methods
  activate(): DomainEvent<AgentActivated>
  pause(): DomainEvent<AgentPaused>
  updateLLM(config: LLMConfiguration): void
  addSkill(skill: Skill): void
  removeSkill(skillId: SkillId): void
  canExecuteTask(taskType: TaskType): boolean
}
```

#### Aggregate: Lead

```typescript
class Lead {
  readonly id: LeadId
  contact: ContactInfo                    // Value Object (name, email, phone, company)
  source: LeadSource                      // Enum: MANUAL | SCRAPED | REFERRAL
  qualificationScore: QualificationScore  // Value Object (0-100)
  status: LeadStatus                      // Enum: NEW | CONTACTED | QUALIFIED | CONVERTED | LOST
  conversationHistory: Message[]          // Entity collection
  assignedAgentId: AgentId
  hitlApprovals: HITLApproval[]           // Audit trail
  createdAt: Timestamp

  // Domain Methods
  qualify(score: QualificationScore): DomainEvent<LeadQualified>
  convert(deal: Deal): DomainEvent<LeadConverted>
  recordMessage(message: Message): void
  requiresHITLApproval(actionType: ActionType): boolean
}
```

#### Aggregate: Deal

```typescript
class Deal {
  readonly id: DealId
  readonly leadId: LeadId
  service: ServiceType                    // Enum: WEBSITE | TRAFFIC | SOCIAL_MEDIA
  proposal: Proposal                      // Value Object
  pricing: Pricing                        // Value Object (basePrice, addons, total)
  status: DealStatus                      // Enum: PROPOSED | NEGOTIATING | CLOSED | CANCELLED
  closedAt?: Timestamp
  project?: ProjectRef                    // Reference após fechamento

  // Domain Methods
  generateProposal(briefing: ClientBriefing): Proposal
  updatePricing(pricing: Pricing): void
  close(): DomainEvent<DealClosed>
  cancel(reason: CancellationReason): DomainEvent<DealCancelled>
}
```

#### Aggregate: Project

```typescript
class Project {
  readonly id: ProjectId
  readonly dealId: DealId
  readonly clientId: ClientId
  briefing: ClientBriefing                // Value Object
  deliverable: Deliverable                // Value Object (url, files, metadata)
  status: ProjectStatus                   // Enum: PLANNING | IN_PROGRESS | REVIEW | DELIVERED | REVISION
  assignedAgentId: AgentId
  qualityScore?: QualityScore             // Value Object (Lighthouse scores)
  hitlApprovals: HITLApproval[]
  createdAt: Timestamp
  deliveredAt?: Timestamp

  // Domain Methods
  startDevelopment(): DomainEvent<ProjectStarted>
  requestReview(): DomainEvent<ProjectReadyForReview>
  deliver(deliverable: Deliverable): DomainEvent<ProjectDelivered>
  requestRevision(notes: RevisionNotes): DomainEvent<RevisionRequested>
}
```

### Value Objects Críticos

```typescript
// LLM Configuration — imutável
class LLMConfiguration {
  readonly provider: LLMProvider          // Enum: OLLAMA | OPENAI | ANTHROPIC | GROQ | CUSTOM
  readonly modelName: string
  readonly baseUrl?: URL                  // Para Ollama local
  readonly apiKeyRef: SecretRef           // Referência ao vault, NUNCA o valor direto
  readonly temperature: Temperature       // Float 0.0–2.0
  readonly maxTokens: MaxTokens           // Int 100–128000
  readonly systemPrompt: SystemPrompt     // Max 8000 chars

  validate(): ValidationResult
  isLocal(): boolean
  toSafeLog(): object                     // Sem apiKeyRef
}

// HITL Approval — imutável após criação
class HITLApproval {
  readonly id: HITLApprovalId
  readonly actionType: ActionType
  readonly payload: RedactedPayload       // PII removido para audit log
  readonly requestedAt: Timestamp
  readonly decision?: HITLDecision        // APPROVED | REJECTED | EXPIRED
  readonly decidedAt?: Timestamp
  readonly operatorNote?: string
}

// Pricing — regras de negócio encapsuladas
class Pricing {
  readonly basePrice: Money               // Value Object com currency
  readonly addons: PricingAddon[]
  readonly discountPct: Percentage        // 0-100
  
  get total(): Money
  get marginEstimate(): Money
  isValid(): boolean
}
```

### Domain Events

```typescript
// Todos os eventos são imutáveis e carregam timestamp + correlation ID
type DomainEvent<T> = {
  eventId: UUID
  eventType: string
  aggregateId: string
  aggregateType: string
  occurredAt: Timestamp
  correlationId: UUID          // Para tracing distribuído
  causationId?: UUID           // Event que causou este
  payload: T
}

// Eventos do MVP
LeadCreated, LeadQualified, LeadConverted, LeadLost
DealProposed, DealClosed, DealCancelled
ProjectStarted, ProjectReadyForReview, ProjectDelivered, RevisionRequested
AgentActivated, AgentPaused, AgentTaskCompleted, AgentTaskFailed
HITLApprovalRequested, HITLApprovalDecided
MessageSent, MessageReceived                           // Auditável
```

---

## 8. Especificação dos Agentes

### Estrutura Universal de Agente

Todo agente no sistema segue esta estrutura configurável:

```yaml
agent:
  id: uuid
  persona: HUNTER | CLOSER | BUILDER | QA
  name: string
  
  llm:
    provider: ollama | openai | anthropic | groq
    model: string                         # ex: llama3:70b, gpt-4o, claude-sonnet-4-5
    base_url: string?                     # Ollama: http://localhost:11434
    api_key_ref: string                   # Referência ao vault: "secrets/agent_llm_key"
    temperature: float                    # 0.0 – 1.0
    max_tokens: int
    system_prompt: |
      [prompt base do agente — carregado do template por persona]
  
  skills:
    - id: uuid
      name: string
      type: web_search | scraping | email | whatsapp | file_gen | deploy | code_gen | rag_query
      config: {}                          # Específico por tipo
      enabled: boolean
  
  rules:
    - id: uuid
      name: string
      condition: string                   # Expressão CEL/JavaScript avaliada em runtime
      action: BLOCK | WARN | LOG | ESCALATE_HITL
      priority: int                       # Menor = maior prioridade
  
  workflows:
    - id: uuid
      name: string
      n8n_workflow_id: string             # ID do workflow no n8n
      trigger: domain_event | schedule | manual
      trigger_config: {}
  
  rag:
    enabled: boolean
    collection_name: string              # ChromaDB collection
    top_k: int                           # Número de docs recuperados
    similarity_threshold: float          # 0.0–1.0
  
  mcp_servers:
    - name: string
      url: string                        # Validado contra allowlist
      auth_ref: string?                  # Referência ao vault
  
  hitl:
    require_approval_for:
      - SEND_EXTERNAL_MESSAGE
      - SEND_PROPOSAL
      - DEPLOY_SITE
      - CHARGE_CUSTOMER
    approval_timeout_minutes: 60         # Auto-rejeita após timeout
    notify_channel: email | telegram | slack
```

---

### Agente 1 — Hunter (Prospector)

**Objetivo:** Identificar, qualificar e preparar leads para contato, com aprovação HITL antes de qualquer mensagem externa.

**System Prompt Base:**
```
Você é um especialista em prospecção digital B2B/B2C para agências de serviços web. 
Sua missão é identificar negócios que se beneficiariam de um site profissional ou 
de melhoria do site atual. Avalie cada lead nos critérios: presença digital atual, 
porte do negócio, segmento, potencial de conversão (0-100). 
NUNCA envie mensagens externas sem aprovação do operador humano.
Responda sempre em pt-BR. Seja objetivo e preciso nas qualificações.
```

**Skills configuradas no MVP:**
```yaml
skills:
  - name: web_search
    type: web_search
    config:
      engine: searxng_local              # SearXNG self-hosted, sem rastreadores
      max_results: 10
      safe_search: true
  
  - name: site_analyzer
    type: scraping
    config:
      allowed_domains_only: false
      timeout_ms: 5000
      extract: [title, description, has_contact, has_mobile, performance_hint]
      user_agent: "AgentePro-Crawler/1.0 (+https://seudominio.com/bot)"
  
  - name: lead_scorer
    type: rag_query
    config:
      collection: lead_qualification_criteria
      top_k: 5
```

**Rules:**
```yaml
rules:
  - name: no_external_contact_without_hitl
    condition: "action.type == 'SEND_MESSAGE' && action.channel != 'INTERNAL'"
    action: ESCALATE_HITL
    priority: 1
  
  - name: block_government_entities
    condition: "lead.sector == 'GOVERNMENT'"
    action: BLOCK
    priority: 2
  
  - name: min_qualification_score
    condition: "lead.qualificationScore < 40"
    action: LOG
    priority: 3
  
  - name: rate_limit_scraping
    condition: "agent.requestsInLastMinute > 30"
    action: BLOCK
    priority: 1
```

**Workflow Principal (n8n):**
```
Trigger: Schedule (diário 09:00) ou Manual
→ Task: Gerar lista de nichos/regiões para prospectar
→ Task: Web search por negócios sem site ou com site desatualizado
→ Task: Analisar cada candidato (site_analyzer skill)
→ Task: Calcular qualification score (lead_scorer RAG)
→ Gateway: Score ≥ 40?
  → Sim: Criar Lead no CRM → Emitir LeadQualified → Solicitar HITL
  → Não: Registrar como DESCARTADO → Log
→ HITL: Operador aprova/rejeita lista de leads
→ Aprovado: Passar para Closer Agent via domain event
```

---

### Agente 2 — Closer (Vendas)

**Objetivo:** Conduzir a negociação com o lead qualificado, gerar proposta personalizada e fechar o deal.

**System Prompt Base:**
```
Você é um consultor de vendas especializado em serviços digitais para pequenos negócios.
Seu estilo é consultivo, empático e direto. Você entende as necessidades do cliente antes 
de apresentar soluções. Você gera propostas honestas com preços justos.
Nunca pressione o cliente. Nunca prometa o que não pode ser entregue.
NUNCA envie proposta sem aprovação do operador. Responda em pt-BR.
```

**Skills configuradas no MVP:**
```yaml
skills:
  - name: whatsapp_sender
    type: whatsapp
    config:
      evolution_api_url: "${EVOLUTION_API_URL}"   # Referência env
      instance_name: "${WPP_INSTANCE}"
      require_hitl: true                           # SEMPRE
  
  - name: email_sender
    type: email
    config:
      smtp_ref: "secrets/smtp_config"
      from_name: "${OPERATOR_NAME}"
      from_email: "${OPERATOR_EMAIL}"
      require_hitl: true
  
  - name: proposal_generator
    type: rag_query
    config:
      collection: proposal_templates
      top_k: 3
  
  - name: pricing_calculator
    type: code_gen
    config:
      engine: internal
      script: pricing_rules_v1.js          # Script versionado no repositório
```

**Regras de Precificação (pricing_rules_v1.js):**
```javascript
// pricing_rules_v1.js — versionado, auditável, sem side effects
export function calculatePrice(briefing) {
  const BASE = 800;                        // R$ mínimo
  let price = BASE;
  
  // Complexity multipliers
  if (briefing.pages > 5)    price += (briefing.pages - 5) * 120;
  if (briefing.hasEcommerce)  price += 600;
  if (briefing.hasBlog)       price += 200;
  if (briefing.hasCustomForm) price += 150;
  if (briefing.needsCopywriting) price += 300;
  
  // Urgency premium
  if (briefing.deliveryDays < 3) price *= 1.4;
  
  // Cap máximo sem override humano
  if (price > 5000) {
    return { price, requiresHITL: true, reason: "above_threshold" };
  }
  
  return { price, requiresHITL: false };
}
```

**Workflow Principal (n8n):**
```
Trigger: DomainEvent[LeadApprovedForContact]
→ Task: Carregar histórico do lead no CRM
→ Task: Gerar mensagem de abordagem personalizada (LLM)
→ HITL: Operador aprova mensagem
→ Aprovado: Enviar mensagem via canal preferido
→ Task: Aguardar resposta (webhook/polling)
→ Task: Conduzir conversa até briefing completo
→ Task: Calcular proposta (pricing_calculator)
→ Task: Gerar PDF da proposta (proposal_generator)
→ HITL: Operador aprova proposta + valor
→ Aprovado: Enviar proposta
→ Gateway: Cliente aceita?
  → Sim: Emitir DealClosed → Criar Project → Notificar Builder
  → Não/Negociação: Continuar loop de negociação (max 5 rodadas)
  → Abandono: Emitir DealCancelled → Marcar lead como LOST
```

---

### Agente 3 — Builder (Desenvolvedor)

**Objetivo:** Desenvolver e entregar o site contratado seguindo padrões de qualidade, segurança e performance.

**System Prompt Base:**
```
Você é um desenvolvedor web sênior especializado em criar sites profissionais, 
performáticos e acessíveis. Você segue rigorosamente: WCAG 2.1 AA, OWASP Top 10, 
Core Web Vitals, Clean Code. Você usa apenas templates aprovados do catálogo interno.
Nunca invente arquiteturas não testadas. Prefira simplicidade e confiabilidade.
NUNCA faça deploy sem aprovação do operador. Documente tudo.
```

**Skills configuradas no MVP:**
```yaml
skills:
  - name: template_selector
    type: rag_query
    config:
      collection: site_templates
      top_k: 5
      metadata_filter: {type: "website", status: "approved"}
  
  - name: code_customizer
    type: code_gen
    config:
      engine: llm
      output_validation: true
      owasp_check: true
      max_file_size_kb: 500
  
  - name: asset_handler
    type: file_gen
    config:
      allowed_mime_types: [image/jpeg, image/png, image/webp, image/svg+xml]
      max_size_mb: 5
      validate_magic_bytes: true           # OBRIGATÓRIO
      optimize_images: true
  
  - name: deployer
    type: deploy
    config:
      platforms: [vercel, netlify]
      require_hitl: true
      pre_deploy_checks:
        - lighthouse_score_min: 80
        - owasp_zap_scan: true
        - html_validation: true
```

**Templates do Catálogo (RAG Collection: site_templates):**
```
- template_01: Landing Page One-Page (Next.js 14, Tailwind, TypeScript)
- template_02: Site Institucional 5 páginas (Next.js 14, Tailwind, TypeScript)
- template_03: Site com Blog (Next.js 14, MDX, Tailwind)
- template_04: E-commerce básico (Next.js 14, Stripe, Tailwind)
- template_05: Site de Portfólio (Next.js 14, Framer Motion, Tailwind)

Cada template inclui:
  - Lighthouse score baseline: ≥ 90 performance, 100 acessibilidade
  - Headers de segurança pré-configurados (CSP, HSTS, X-Frame-Options)
  - robots.txt e sitemap.xml automáticos
  - SEO básico (meta tags, OG, schema.org)
  - WCAG 2.1 AA compliance
```

**Workflow Principal (n8n):**
```
Trigger: DomainEvent[DealClosed]
→ Task: Carregar briefing completo do deal
→ Task: Selecionar template (template_selector RAG)
→ Task: Gerar customizações (código, cores, textos, imagens)
→ Task: Validar código gerado (OWASP check automático)
→ Task: Build local + Lighthouse audit
→ Gateway: Scores ≥ threshold?
  → Não: Loop de correção (max 3 tentativas) → Escalar para QA Agent
  → Sim: Continuar
→ HITL: Operador revisa preview do site
→ Aprovado: Deploy em ambiente staging
→ HITL: Operador confirma staging antes de produção
→ Deploy produção (vercel/netlify)
→ Task: Registrar URL e credenciais no CRM
→ Emitir ProjectDelivered
→ Task: Enviar e-mail de entrega ao cliente (via Closer Agent)
```

---

### Agente 4 — QA (Quality & Security Reviewer)

**Objetivo:** Revisar código e outputs dos agentes antes da entrega, garantindo qualidade e segurança.

**Skills:**
```yaml
skills:
  - name: owasp_scanner
    type: code_gen
    config:
      engine: internal
      checks: [xss, sqli, csp_headers, open_redirect, path_traversal]
  
  - name: lighthouse_runner
    type: code_gen
    config:
      engine: puppeteer
      thresholds:
        performance: 80
        accessibility: 100
        best_practices: 90
        seo: 90
  
  - name: html_validator
    type: code_gen
    config:
      engine: w3c_validator
```

---

## 9. Requisitos Funcionais

### RF-001: Autenticação do Operador
- O sistema deve suportar login com e-mail + senha
- Senha armazenada com Argon2id (memCost ≥ 65536, timeCost ≥ 3, parallelism ≥ 4)
- JWT com expiração de 1 hora + refresh token rotativo (7 dias)
- Rate limiting: max 5 tentativas de login por IP por 15 minutos
- Resposta de erro genérica em falha de autenticação (anti-enumeração)

### RF-002: Gestão de Agentes
- CRUD completo de agentes via interface web
- Cada agente tem persona fixa (HUNTER, CLOSER, BUILDER, QA)
- Configuração de LLM por agente: selecionar provider, modelo, temperatura, tokens
- Para Ollama: campo de URL base (validado como URL local ou VPN autorizada)
- Para API externa: campo de API key (armazenada no vault, não exibida após salvar)
- Editor de system prompt com contador de tokens estimado
- Editor de skills com formulário por tipo de skill
- Editor de rules com teste de condição inline
- Histórico de alterações por agente (audit log)

### RF-003: HITL (Human-in-the-Loop)
- Toda ação externa deve passar por aprovação antes de ser executada
- Interface de aprovação com: preview da ação, payload completo, contexto do lead/deal
- Botões: APROVAR / REJEITAR / EDITAR E APROVAR
- Timeout configurável (padrão: 60 min) — após timeout, ação é automaticamente rejeitada
- Notificação via e-mail/Telegram ao operador ao solicitar aprovação
- Todas as decisões HITL registradas no audit log com timestamp e operador

### RF-004: CRM de Clientes
- Listagem de clientes com filtros: status, agente responsável, valor, data
- Perfil do cliente: dados de contato, histórico de conversas, deals, projetos
- Histórico de conversas com reprodução fiel (sem alteração possível — append-only)
- Detalhamento de precificação: como o valor foi calculado, quais itens compõem o total
- Status do projeto em tempo real
- Exportação de dados em CSV (LGPD: apenas operador)

### RF-005: Configuração de Workflows
- Interface para vincular workflows n8n a agentes
- Visualização do status de execuções de workflows
- Logs de execução por workflow
- Possibilidade de reexecutar workflow manualmente

### RF-006: RAG por Agente
- Upload de documentos para cada agente (PDF, MD, TXT)
- Validação de MIME type + magic bytes em todos os uploads
- Processamento assíncrono (chunking + embedding)
- Teste de query RAG inline no painel do agente
- Gerenciamento da collection (adicionar, remover documentos)

### RF-007: Entrega de Sites (Builder)
- Seleção de template a partir do catálogo curado
- Preview do site gerado antes de qualquer deploy
- Deploy em Vercel ou Netlify (free tier) com URL permanente
- Credenciais de acesso ao painel do site entregues ao cliente via e-mail seguro
- Score Lighthouse exibido no CRM após entrega

---

## 10. Requisitos Não-Funcionais

### Performance
- Tempo de resposta da API: p95 < 500ms para endpoints síncronos
- Geração de código pelo Builder: < 5 minutos por site (SLA interno)
- Carregamento do painel: < 2 segundos (First Contentful Paint)
- Sites entregues: Lighthouse Performance ≥ 80

### Escalabilidade
- Arquitetura stateless na API (horizontal scaling ready)
- Filas assíncronas para tarefas longas (bull/bullmq via Redis)
- Sem lock de vendor: toda integração LLM via adapter desacoplado
- ChromaDB e PostgreSQL com connection pooling (pgbouncer)

### Disponibilidade (MVP)
- Uptime alvo: 99.5% (exceto janelas de manutenção programadas)
- Health check endpoint: `GET /health` com status de dependências
- Graceful shutdown com drain de filas

### Compatibilidade
- API REST com OpenAPI 3.1 spec (gerada automaticamente)
- Frontend: suporte a Chrome 120+, Firefox 120+, Safari 17+, Edge 120+
- Mobile-first no painel (responsivo)

---

## 11. Segurança — Security First

### 11.1 Autenticação e Sessão

```typescript
// Exemplo de configuração Argon2id — NÃO alterar sem revisão de segurança
const ARGON2_CONFIG = {
  type: argon2.argon2id,
  memoryCost: 2 ** 16,      // 64 MB
  timeCost: 3,
  parallelism: 4,
  hashLength: 32,
} as const;

// JWT — assinar com RS256 (chave RSA), nunca HS256 com segredo fraco
const JWT_CONFIG = {
  algorithm: 'RS256',
  accessTokenExpiry: '1h',
  refreshTokenExpiry: '7d',
  issuer: 'agentepro.yourdomain.com',
  audience: 'agentepro-api',
} as const;
```

### 11.2 Anti-Enumeração

```typescript
// CORRETO — resposta genérica sempre
async function login(email: string, password: string): Promise<AuthResult> {
  const user = await userRepository.findByEmail(email);
  
  // SEMPRE executar hash comparison, mesmo se usuário não existe
  // Isso previne timing attacks
  const dummyHash = '$argon2id$v=19$m=65536,t=3,p=4$...';
  const hashToCompare = user?.passwordHash ?? dummyHash;
  const isValid = await argon2.verify(hashToCompare, password);
  
  if (!user || !isValid) {
    throw new AuthenticationError('Credenciais inválidas');  // Genérico
  }
  
  return generateTokens(user);
}
```

### 11.3 Zero Trust no Backend

```typescript
// Middleware de validação — TODA rota passa por isso
const validateInput = (schema: ZodSchema) => async (req: Request, res: Response, next: NextFunction) => {
  // Limite de tamanho antes de parsing (evita DoS/JSON bomb)
  if (req.headers['content-length'] && parseInt(req.headers['content-length']) > MAX_BODY_SIZE) {
    return res.status(413).json({ error: 'Payload too large' });
  }
  
  const result = schema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ error: 'Dados inválidos', issues: result.error.flatten() });
  }
  
  req.validatedBody = result.data;
  next();
};
```

### 11.4 Validação de Uploads (Magic Bytes)

```typescript
// NUNCA confiar apenas na extensão ou Content-Type do cliente
async function validateUpload(file: Express.Multer.File): Promise<ValidationResult> {
  // 1. Checar tamanho
  if (file.size > MAX_FILE_SIZE) throw new ValidationError('File too large');
  
  // 2. Checar magic bytes (primeiros 12 bytes)
  const fileBuffer = file.buffer.slice(0, 12);
  const detectedType = await fileTypeFromBuffer(fileBuffer);
  
  // 3. Validar contra allowlist
  const ALLOWED_TYPES = [
    { mime: 'image/jpeg', magic: [0xFF, 0xD8, 0xFF] },
    { mime: 'image/png',  magic: [0x89, 0x50, 0x4E, 0x47] },
    { mime: 'image/webp', magic: [0x52, 0x49, 0x46, 0x46] },
    { mime: 'application/pdf', magic: [0x25, 0x50, 0x44, 0x46] },
    { mime: 'text/plain', magic: null },     // Validação por charset
    { mime: 'text/markdown', magic: null },
  ];
  
  const isAllowed = ALLOWED_TYPES.some(t => t.mime === detectedType?.mime);
  if (!isAllowed) throw new ValidationError('Tipo de arquivo não permitido');
  
  // 4. Sanitizar nome do arquivo
  const safeName = sanitizeFilename(file.originalname);
  
  return { valid: true, detectedMime: detectedType?.mime, safeName };
}
```

### 11.5 Operações Atômicas (Race Conditions)

```typescript
// Para contadores e operações financeiras — SEMPRE atômico
// Exemplo: incrementar crédito de tokens do agente
async function consumeAgentTokens(agentId: string, tokensUsed: number): Promise<void> {
  const result = await db.transaction(async (trx) => {
    // SELECT ... FOR UPDATE previne race condition
    const agent = await trx('agents')
      .where({ id: agentId })
      .forUpdate()
      .first();
    
    if (!agent) throw new NotFoundError('Agent not found');
    if (agent.tokenBudgetRemaining < tokensUsed) {
      throw new InsufficientBudgetError('Token budget exceeded');
    }
    
    await trx('agents')
      .where({ id: agentId })
      .decrement('token_budget_remaining', tokensUsed);
    
    await trx('token_usage_logs').insert({
      agent_id: agentId,
      tokens_used: tokensUsed,
      occurred_at: new Date(),
    });
  });
}
```

### 11.6 Prevenção SSRF e Rastreadores

```typescript
// Validar URLs externas antes de qualquer requisição
const SSRF_BLOCKED_RANGES = [
  /^127\./,
  /^10\./,
  /^172\.(1[6-9]|2[0-9]|3[01])\./,
  /^192\.168\./,
  /^169\.254\./,           // Link-local
  /^::1$/,                 // IPv6 loopback
  /^fc00:/,                // IPv6 ULA
  /^localhost$/i,
];

async function validateExternalUrl(url: string): Promise<URL> {
  const parsed = new URL(url);                              // Lança se inválida
  
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new SecurityError('Protocolo não permitido');
  }
  
  // Resolver DNS e checar IP resultante
  const { address } = await dns.resolve4(parsed.hostname);
  if (SSRF_BLOCKED_RANGES.some(r => r.test(address))) {
    throw new SecurityError('URL aponta para endereço interno');
  }
  
  return parsed;
}

// Para imagens/links inseridos pelo agente ou cliente
async function validateUserProvidedUrl(url: string, allowlist?: string[]): Promise<void> {
  const parsed = await validateExternalUrl(url);
  
  if (allowlist && allowlist.length > 0) {
    const isAllowed = allowlist.some(domain => 
      parsed.hostname === domain || parsed.hostname.endsWith(`.${domain}`)
    );
    if (!isAllowed) throw new SecurityError('Domínio não autorizado');
  }
}
```

### 11.7 Security Headers (todos os sites entregues)

```typescript
// next.config.js — template base para todos os sites
const securityHeaders = [
  { key: 'X-DNS-Prefetch-Control',     value: 'on' },
  { key: 'X-Frame-Options',            value: 'DENY' },
  { key: 'X-Content-Type-Options',     value: 'nosniff' },
  { key: 'Referrer-Policy',            value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy',         value: 'camera=(), microphone=(), geolocation=()' },
  { key: 'Strict-Transport-Security',  value: 'max-age=63072000; includeSubDomains; preload' },
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      "script-src 'self' 'nonce-{NONCE}'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https:",
      "font-src 'self'",
      "connect-src 'self'",
      "frame-ancestors 'none'",
    ].join('; '),
  },
];
```

### 11.8 Rate Limiting por Camada

```typescript
// API Gateway level
const rateLimits = {
  login:           { windowMs: 15 * 60 * 1000, max: 5 },     // 5/15min por IP
  api_general:     { windowMs: 60 * 1000,       max: 100 },   // 100/min por usuário
  agent_execute:   { windowMs: 60 * 1000,       max: 10 },    // 10/min por agente
  file_upload:     { windowMs: 60 * 1000,       max: 5 },     // 5 uploads/min
  hitl_decision:   { windowMs: 5 * 1000,        max: 3 },     // Anti-double-click
};
```

### 11.9 Gestão de Segredos (sem segredos no código ou env commitados)

```
Hierarquia de segredos:
  Desenvolvimento: .env.local (gitignored) + Docker secrets locais
  Staging/Produção: Infisical (self-hosted, free) ou Vault (HashiCorp)
  
Referências no código: sempre como "secrets/chave_nome"
Nunca: process.env.API_KEY diretamente em lógica de domínio
Sempre: injeção via constructor (DI) com interface SecretsProvider
```

### 11.10 Audit Log Imutável

```typescript
// Append-only — sem UPDATE ou DELETE permitidos na tabela
// PostgreSQL: Row Level Security + policy que bloqueia UPDATE/DELETE
interface AuditEntry {
  id: UUID                          // ULID para ordenação temporal
  timestamp: Timestamp
  actor: 'OPERATOR' | AgentPersona
  actorId: string
  action: string                    // ex: HITL_APPROVED, AGENT_MESSAGE_SENT
  resourceType: string
  resourceId: string
  payload: Record<string, unknown>  // PII removido/mascarado
  ipAddress?: string                // Apenas para ações de operador humano
  correlationId: UUID
}
```

---

## 12. API Design

### Princípios
- REST com nomenclatura de recursos no plural
- CQRS refletido nas rotas: GET para queries, POST/PATCH/DELETE para commands
- Versionamento via URL: `/api/v1/`
- Respostas sempre com envelope: `{ data, meta, errors }`
- Paginação por cursor (não offset) para listas grandes

### Endpoints do MVP

```
AUTH
  POST   /api/v1/auth/login
  POST   /api/v1/auth/refresh
  DELETE /api/v1/auth/logout

AGENTS
  GET    /api/v1/agents                           # Listar agentes
  POST   /api/v1/agents                           # Criar agente
  GET    /api/v1/agents/:id                       # Detalhar agente
  PATCH  /api/v1/agents/:id                       # Atualizar configuração
  POST   /api/v1/agents/:id/activate
  POST   /api/v1/agents/:id/pause
  GET    /api/v1/agents/:id/logs                  # Logs de execução
  POST   /api/v1/agents/:id/test-llm              # Teste de conexão LLM

AGENT SKILLS
  GET    /api/v1/agents/:id/skills
  POST   /api/v1/agents/:id/skills
  PATCH  /api/v1/agents/:id/skills/:skillId
  DELETE /api/v1/agents/:id/skills/:skillId

AGENT RAG
  GET    /api/v1/agents/:id/rag/documents
  POST   /api/v1/agents/:id/rag/documents         # Upload + processamento assíncrono
  DELETE /api/v1/agents/:id/rag/documents/:docId
  POST   /api/v1/agents/:id/rag/query             # Teste de query

HITL
  GET    /api/v1/hitl/pending                     # Aprovações pendentes
  GET    /api/v1/hitl/:id                         # Detalhar aprovação
  POST   /api/v1/hitl/:id/approve
  POST   /api/v1/hitl/:id/reject
  PATCH  /api/v1/hitl/:id/edit-and-approve        # Editar payload antes de aprovar

LEADS
  GET    /api/v1/leads                            # CRM — listar leads
  GET    /api/v1/leads/:id                        # Detalhar lead + histórico
  POST   /api/v1/leads                            # Criar lead manualmente
  PATCH  /api/v1/leads/:id/status

DEALS
  GET    /api/v1/deals
  GET    /api/v1/deals/:id                        # Com composição de precificação
  POST   /api/v1/deals/:id/cancel

PROJECTS
  GET    /api/v1/projects
  GET    /api/v1/projects/:id                     # Com scores e deliverable
  POST   /api/v1/projects/:id/request-revision

SYSTEM
  GET    /api/v1/health
  GET    /api/v1/metrics                          # Prometheus format
```

### Contrato de Resposta

```typescript
// Sucesso
{
  "data": { ... },
  "meta": {
    "requestId": "01HZ...",          // ULID para tracing
    "timestamp": "2026-05-01T09:00:00Z"
  }
}

// Erro
{
  "errors": [{
    "code": "VALIDATION_ERROR",
    "message": "Campo inválido",
    "field": "email",
    "requestId": "01HZ..."
  }]
}

// Lista paginada
{
  "data": [...],
  "meta": {
    "cursor": { "next": "01HZ...", "prev": null },
    "total": 142,
    "limit": 20
  }
}
```

---

## 13. Schema de Banco de Dados

```sql
-- ============================================================
-- SCHEMA: agentepro
-- Banco: PostgreSQL 16
-- Todas as tabelas: RLS ativado, sem DELETE em tabelas de audit
-- ============================================================

-- EXTENSÕES
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- IAM CONTEXT
-- ============================================================

CREATE TABLE operators (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email         TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,                      -- Argon2id
    name          TEXT NOT NULL,
    is_active     BOOLEAN NOT NULL DEFAULT true,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE refresh_tokens (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    operator_id UUID NOT NULL REFERENCES operators(id) ON DELETE CASCADE,
    token_hash  TEXT NOT NULL UNIQUE,                  -- Hash do token
    expires_at  TIMESTAMPTZ NOT NULL,
    revoked_at  TIMESTAMPTZ,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- AGENT MANAGEMENT CONTEXT
-- ============================================================

CREATE TYPE agent_persona AS ENUM ('HUNTER', 'CLOSER', 'BUILDER', 'QA');
CREATE TYPE agent_status  AS ENUM ('ACTIVE', 'INACTIVE', 'PAUSED');
CREATE TYPE llm_provider  AS ENUM ('OLLAMA', 'OPENAI', 'ANTHROPIC', 'GROQ', 'CUSTOM');

CREATE TABLE agents (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    operator_id           UUID NOT NULL REFERENCES operators(id),
    name                  TEXT NOT NULL CHECK (length(name) BETWEEN 3 AND 50),
    persona               agent_persona NOT NULL,
    status                agent_status NOT NULL DEFAULT 'INACTIVE',
    llm_provider          llm_provider NOT NULL,
    llm_model             TEXT NOT NULL,
    llm_base_url          TEXT,                       -- Ollama URL
    llm_api_key_ref       TEXT,                       -- Referência ao vault
    llm_temperature       NUMERIC(3,2) NOT NULL DEFAULT 0.7 CHECK (llm_temperature BETWEEN 0 AND 2),
    llm_max_tokens        INTEGER NOT NULL DEFAULT 4096 CHECK (llm_max_tokens BETWEEN 100 AND 128000),
    llm_system_prompt     TEXT CHECK (length(llm_system_prompt) <= 8000),
    token_budget_total    BIGINT NOT NULL DEFAULT 1000000,
    token_budget_remaining BIGINT NOT NULL DEFAULT 1000000,
    rag_enabled           BOOLEAN NOT NULL DEFAULT false,
    rag_collection        TEXT,
    rag_top_k             INTEGER DEFAULT 5,
    rag_threshold         NUMERIC(3,2) DEFAULT 0.7,
    hitl_timeout_minutes  INTEGER NOT NULL DEFAULT 60,
    hitl_notify_channel   TEXT NOT NULL DEFAULT 'email',
    created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE agent_skills (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id     UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    name         TEXT NOT NULL,
    skill_type   TEXT NOT NULL,
    config       JSONB NOT NULL DEFAULT '{}',
    is_enabled   BOOLEAN NOT NULL DEFAULT true,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE agent_rules (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id   UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    name       TEXT NOT NULL,
    condition  TEXT NOT NULL,
    action     TEXT NOT NULL CHECK (action IN ('BLOCK', 'WARN', 'LOG', 'ESCALATE_HITL')),
    priority   INTEGER NOT NULL DEFAULT 100,
    is_enabled BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE mcp_servers (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id   UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    name       TEXT NOT NULL,
    url        TEXT NOT NULL,
    auth_ref   TEXT,
    is_enabled BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- LEAD & PROSPECTING CONTEXT
-- ============================================================

CREATE TYPE lead_source  AS ENUM ('MANUAL', 'SCRAPED', 'REFERRAL');
CREATE TYPE lead_status  AS ENUM ('NEW', 'CONTACTED', 'QUALIFIED', 'CONVERTED', 'LOST');
CREATE TYPE message_direction AS ENUM ('INBOUND', 'OUTBOUND');
CREATE TYPE message_channel   AS ENUM ('WHATSAPP', 'EMAIL', 'INTERNAL');

CREATE TABLE leads (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    operator_id          UUID NOT NULL REFERENCES operators(id),
    assigned_agent_id    UUID REFERENCES agents(id),
    contact_name         TEXT NOT NULL,
    contact_email        TEXT,
    contact_phone        TEXT,
    contact_company      TEXT,
    contact_website      TEXT,
    source               lead_source NOT NULL DEFAULT 'MANUAL',
    qualification_score  INTEGER CHECK (qualification_score BETWEEN 0 AND 100),
    status               lead_status NOT NULL DEFAULT 'NEW',
    notes                TEXT,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE messages (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id         UUID NOT NULL REFERENCES leads(id),
    agent_id        UUID REFERENCES agents(id),
    direction       message_direction NOT NULL,
    channel         message_channel NOT NULL,
    content         TEXT NOT NULL CHECK (length(content) <= 10000),
    content_type    TEXT NOT NULL DEFAULT 'text/plain',
    external_id     TEXT,                                -- ID no WhatsApp/SMTP
    sent_at         TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
    -- Sem UPDATE/DELETE permitido via RLS
);

-- ============================================================
-- SALES & NEGOTIATION CONTEXT
-- ============================================================

CREATE TYPE deal_status    AS ENUM ('PROPOSED', 'NEGOTIATING', 'CLOSED', 'CANCELLED');
CREATE TYPE service_type   AS ENUM ('WEBSITE', 'TRAFFIC', 'SOCIAL_MEDIA', 'OTHER');

CREATE TABLE deals (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id          UUID NOT NULL REFERENCES leads(id),
    operator_id      UUID NOT NULL REFERENCES operators(id),
    agent_id         UUID REFERENCES agents(id),
    service_type     service_type NOT NULL,
    status           deal_status NOT NULL DEFAULT 'PROPOSED',
    briefing         JSONB NOT NULL DEFAULT '{}',
    proposal_text    TEXT,
    base_price_cents BIGINT NOT NULL DEFAULT 0,
    addons           JSONB NOT NULL DEFAULT '[]',
    discount_pct     NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (discount_pct BETWEEN 0 AND 100),
    total_cents      BIGINT GENERATED ALWAYS AS (
                       ROUND(base_price_cents * (1 - discount_pct / 100))
                     ) STORED,
    currency         TEXT NOT NULL DEFAULT 'BRL',
    proposal_sent_at TIMESTAMPTZ,
    closed_at        TIMESTAMPTZ,
    closed_reason    TEXT,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- DELIVERY & DEVELOPMENT CONTEXT
-- ============================================================

CREATE TYPE project_status AS ENUM ('PLANNING', 'IN_PROGRESS', 'REVIEW', 'DELIVERED', 'REVISION', 'CANCELLED');

CREATE TABLE projects (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    deal_id               UUID NOT NULL REFERENCES deals(id),
    operator_id           UUID NOT NULL REFERENCES operators(id),
    assigned_agent_id     UUID REFERENCES agents(id),
    status                project_status NOT NULL DEFAULT 'PLANNING',
    template_id           TEXT,
    briefing              JSONB NOT NULL DEFAULT '{}',
    deliverable_url       TEXT,
    deliverable_meta      JSONB DEFAULT '{}',
    lighthouse_perf       INTEGER,
    lighthouse_a11y       INTEGER,
    lighthouse_seo        INTEGER,
    lighthouse_bp         INTEGER,
    revision_count        INTEGER NOT NULL DEFAULT 0,
    revision_notes        TEXT,
    delivered_at          TIMESTAMPTZ,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- HITL CONTEXT
-- ============================================================

CREATE TYPE hitl_status AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'EXPIRED', 'EDITED_APPROVED');

CREATE TABLE hitl_approvals (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    operator_id       UUID NOT NULL REFERENCES operators(id),
    agent_id          UUID NOT NULL REFERENCES agents(id),
    action_type       TEXT NOT NULL,
    context_type      TEXT NOT NULL,          -- LEAD | DEAL | PROJECT
    context_id        UUID NOT NULL,
    payload_preview   JSONB NOT NULL,         -- PII removido/mascarado
    payload_full_ref  TEXT,                   -- Referência ao vault/storage criptografado
    status            hitl_status NOT NULL DEFAULT 'PENDING',
    expires_at        TIMESTAMPTZ NOT NULL,
    decided_at        TIMESTAMPTZ,
    operator_note     TEXT,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
    -- Sem UPDATE além dos campos de decisão — via função controlada
);

-- ============================================================
-- AUDIT LOG (APPEND-ONLY)
-- ============================================================

CREATE TABLE audit_log (
    id              TEXT PRIMARY KEY,                  -- ULID
    timestamp       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    actor           TEXT NOT NULL,
    actor_id        TEXT NOT NULL,
    action          TEXT NOT NULL,
    resource_type   TEXT NOT NULL,
    resource_id     TEXT NOT NULL,
    payload         JSONB NOT NULL DEFAULT '{}',
    ip_address      INET,
    correlation_id  UUID NOT NULL,
    causation_id    UUID
    -- Sem PRIMARY KEY que permita UPDATE
    -- RLS: apenas INSERT, zero UPDATE/DELETE
);

-- Policy que bloqueia modificações no audit_log
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY audit_insert_only ON audit_log FOR INSERT TO app_role WITH CHECK (true);
-- Sem policy para UPDATE/DELETE = bloqueado implicitamente

-- ============================================================
-- ÍNDICES
-- ============================================================

CREATE INDEX idx_leads_status ON leads(status, operator_id);
CREATE INDEX idx_leads_agent ON leads(assigned_agent_id);
CREATE INDEX idx_messages_lead ON messages(lead_id, created_at DESC);
CREATE INDEX idx_deals_lead ON deals(lead_id);
CREATE INDEX idx_deals_status ON deals(status, operator_id);
CREATE INDEX idx_projects_status ON projects(status, operator_id);
CREATE INDEX idx_hitl_pending ON hitl_approvals(operator_id, status) WHERE status = 'PENDING';
CREATE INDEX idx_audit_resource ON audit_log(resource_type, resource_id);
CREATE INDEX idx_audit_correlation ON audit_log(correlation_id);
```

---

## 14. Estratégia de Testes

### Pirâmide de Testes

```
                    /\
                   /  \    E2E Tests (Playwright)
                  /----\   Fluxos críticos completos
                 /      \
                /--------\  Integration Tests (Supertest + Testcontainers)
               /          \ API endpoints + DB + LLM mocked
              /            \
             /--------------\ Unit Tests (Vitest)
            /                \ Domain entities, use cases, value objects
           /------------------\
          /  Security Tests    \
         / (OWASP ZAP + custom) \
        /------------------------\
```

### TDD — Ciclo Red-Green-Refactor

Cada use case é desenvolvido seguindo TDD estrito:
1. Escrever teste que falha (Red)
2. Implementar mínimo para passar (Green)
3. Refatorar mantendo testes passando (Refactor)

### BDD — Behavior Driven Development (Gherkin)

```gherkin
# features/hunter_agent/qualify_lead.feature

Feature: Qualificação de Lead pelo Agente Hunter
  Como operador
  Quero que o agente qualifique leads automaticamente
  Para que eu só revise os leads com maior potencial

  Background:
    Given o agente Hunter está ativo
    And o agente está configurado com score mínimo de 40

  Scenario: Lead qualificado com sucesso
    Given um negócio "Pizzaria João" sem presença digital
    When o agente analisa o negócio
    Then o lead deve ter score >= 40
    And o status do lead deve ser "QUALIFIED"
    And uma solicitação HITL deve ser criada
    And o operador deve ser notificado

  Scenario: Lead rejeitado por score baixo
    Given um negócio com site moderno e alta presença digital
    When o agente analisa o negócio
    Then o lead deve ter score < 40
    And o status do lead deve ser "DISCARDED"
    And nenhuma solicitação HITL deve ser criada

  Scenario: Bloqueio de contato externo sem HITL
    Given um lead qualificado com score 75
    When o agente tenta enviar mensagem diretamente
    Then a ação deve ser bloqueada
    And um evento "UnauthorizedExternalAction" deve ser registrado no audit log
```

### Testes de Segurança Automatizados

```typescript
// tests/security/auth.security.test.ts

describe('Security: Authentication', () => {
  describe('Anti-enumeration', () => {
    it('deve retornar o mesmo erro para e-mail inexistente e senha errada', async () => {
      const [res1, res2] = await Promise.all([
        request.post('/api/v1/auth/login').send({ email: 'noexist@test.com', password: 'wrong' }),
        request.post('/api/v1/auth/login').send({ email: 'real@test.com',   password: 'wrong' }),
      ]);
      expect(res1.status).toBe(401);
      expect(res2.status).toBe(401);
      expect(res1.body.errors[0].message).toBe(res2.body.errors[0].message);
    });

    it('deve ter timing similar para e-mail inexistente e senha errada (anti-timing-attack)', async () => {
      const t1 = Date.now();
      await request.post('/api/v1/auth/login').send({ email: 'noexist@test.com', password: 'wrong' });
      const d1 = Date.now() - t1;

      const t2 = Date.now();
      await request.post('/api/v1/auth/login').send({ email: 'real@test.com', password: 'wrong' });
      const d2 = Date.now() - t2;

      expect(Math.abs(d1 - d2)).toBeLessThan(200);  // Menos de 200ms de diferença
    });
  });

  describe('Rate limiting', () => {
    it('deve bloquear após 5 tentativas de login em 15 minutos', async () => {
      for (let i = 0; i < 5; i++) {
        await request.post('/api/v1/auth/login').send({ email: 'test@test.com', password: 'wrong' });
      }
      const res = await request.post('/api/v1/auth/login').send({ email: 'test@test.com', password: 'wrong' });
      expect(res.status).toBe(429);
    });
  });

  describe('JWT', () => {
    it('deve rejeitar token expirado', async () => {
      const expiredToken = generateExpiredToken();
      const res = await request.get('/api/v1/agents').set('Authorization', `Bearer ${expiredToken}`);
      expect(res.status).toBe(401);
    });

    it('deve rejeitar token com algoritmo "none"', async () => {
      const noneToken = createNoneAlgorithmToken();
      const res = await request.get('/api/v1/agents').set('Authorization', `Bearer ${noneToken}`);
      expect(res.status).toBe(401);
    });
  });
});

// tests/security/upload.security.test.ts
describe('Security: File Upload', () => {
  it('deve rejeitar arquivo .exe renomeado para .jpg', async () => {
    const fakeImage = Buffer.from('MZ...', 'binary');  // Magic bytes de EXE
    const res = await request
      .post('/api/v1/agents/123/rag/documents')
      .attach('file', fakeImage, { filename: 'nice_image.jpg', contentType: 'image/jpeg' });
    expect(res.status).toBe(400);
    expect(res.body.errors[0].code).toBe('INVALID_FILE_TYPE');
  });

  it('deve rejeitar arquivo acima do limite de tamanho', async () => {
    const bigFile = Buffer.alloc(10 * 1024 * 1024 + 1);  // 10MB + 1 byte
    const res = await request
      .post('/api/v1/agents/123/rag/documents')
      .attach('file', bigFile, 'doc.pdf');
    expect(res.status).toBe(413);
  });
});

// tests/security/ssrf.security.test.ts
describe('Security: SSRF Prevention', () => {
  it('deve bloquear URL apontando para localhost', async () => {
    const res = await request.post('/api/v1/agents/123/skills').send({
      type: 'web_search',
      config: { endpoint: 'http://localhost:8080/admin' }
    });
    expect(res.status).toBe(400);
  });

  it('deve bloquear URL com IP privado 192.168.x.x', async () => {
    const res = await request.post('/api/v1/agents/123/skills').send({
      type: 'scraping',
      config: { target_url: 'http://192.168.1.1/config' }
    });
    expect(res.status).toBe(400);
  });
});
```

### Cobertura Mínima Exigida (CI bloqueia abaixo de:)

```yaml
coverage:
  statements: 80%
  branches: 75%
  functions: 80%
  lines: 80%
  security_tests: 100%      # Todos os testes de segurança devem passar
```

---

## 15. Observabilidade e Escalabilidade

### Três Pilares da Observabilidade

#### 1. Logs Estruturados (JSON)

```typescript
// Formato de log — todos os serviços
interface StructuredLog {
  level: 'debug' | 'info' | 'warn' | 'error' | 'fatal';
  timestamp: string;                // ISO 8601
  service: string;                  // ex: 'agent-orchestrator'
  traceId: string;                  // OpenTelemetry trace ID
  spanId: string;
  correlationId: string;
  agentId?: string;
  operatorId?: string;
  action?: string;
  duration_ms?: number;
  message: string;
  error?: { message: string; stack?: string; code?: string };
  // Sem PII (e-mail, telefone, mensagens brutas)
}
```

#### 2. Métricas (Prometheus + Grafana)

```
# Métricas obrigatórias no MVP

# Agentes
agent_tasks_total{agent_id, persona, status}         # Counter
agent_task_duration_seconds{agent_id, task_type}     # Histogram
agent_token_usage_total{agent_id, provider}          # Counter
agent_llm_errors_total{agent_id, error_type}         # Counter

# HITL
hitl_approvals_pending{operator_id}                  # Gauge
hitl_decision_time_seconds{decision}                 # Histogram
hitl_timeout_total                                   # Counter

# CRM/Pipeline
leads_created_total{source}                          # Counter
deals_closed_total{service_type}                     # Counter
deals_closed_value_total_brl                         # Counter (soma de valores)
projects_delivered_total                             # Counter
project_delivery_time_hours                          # Histogram

# API
http_requests_total{method, route, status}           # Counter
http_request_duration_seconds{method, route}         # Histogram
```

#### 3. Distributed Tracing (OpenTelemetry)

Cada request recebe um `traceId` que percorre: API → Use Case → Domain → Infra → LLM Call. Exportado para Jaeger (self-hosted, free).

### Dashboards Grafana obrigatórios no MVP

1. **Pipeline Dashboard**: leads → qualificados → deals → projetos entregues (funil)
2. **Agent Performance**: tokens consumidos, tarefas completadas/falhadas, latência LLM
3. **HITL Dashboard**: aprovações pendentes, tempo médio de decisão, taxa de rejeição
4. **Security Dashboard**: tentativas de login bloqueadas, erros 4xx/5xx, rate limit hits

### Alertas Críticos

```yaml
alerts:
  - name: HITLQueueBacklog
    condition: hitl_approvals_pending > 10
    severity: warning
    notify: operador_telegram

  - name: AgentHighErrorRate
    condition: rate(agent_llm_errors_total[5m]) > 0.1
    severity: critical
    notify: operador_email

  - name: APIHighLatency
    condition: p95(http_request_duration_seconds) > 2
    severity: warning
    notify: operador_email

  - name: SecurityLoginBruteForce
    condition: rate(auth_failed_attempts[1m]) > 10
    severity: critical
    notify: operador_email + operador_telegram
```

---

## 16. Stack Tecnológica

### Backend

| Componente | Tecnologia | Justificativa |
|---|---|---|
| Runtime | Node.js 22 LTS | TypeScript nativo, excelente ecosystem |
| Framework API | Fastify 5 | Performance superior ao Express, schema-first |
| ORM | Drizzle ORM | Type-safe, sem overhead de ORM pesado |
| Validação | Zod | Type inference + runtime validation |
| Queue | BullMQ + Redis | Filas confiáveis para tarefas assíncronas |
| Auth | jose (JWT RS256) | RFC-compliant, sem deps extras |
| Crypto | argon2 (node binding) | Argon2id nativo, sem implementação própria |
| Testes | Vitest + Supertest | Rápido, compatível com TypeScript |
| E2E | Playwright | Testcontainers para deps isoladas |

### Frontend

| Componente | Tecnologia | Justificativa |
|---|---|---|
| Framework | Next.js 15 (App Router) | SSR/SSG, TypeScript, Vercel-friendly |
| UI Components | shadcn/ui | Sem lock de vendor, acessível |
| Styling | Tailwind CSS 4 | Utility-first, performance |
| State | Zustand | Simples, sem boilerplate Redux |
| Forms | React Hook Form + Zod | Validação compartilhada com backend |
| Fetching | TanStack Query | Cache, refetch, optimistic updates |

### Infraestrutura

| Componente | Tecnologia | Custo |
|---|---|---|
| Banco de Dados | PostgreSQL 16 (Supabase free / self-hosted) | Grátis |
| Vetorial (RAG) | ChromaDB (self-hosted Docker) | Grátis |
| Queue/Cache | Redis 7 (self-hosted Docker) | Grátis |
| LLM Local | Ollama + Llama 3.2, Mistral, CodeLlama | Grátis |
| Workflow | n8n (self-hosted Docker) | Grátis |
| Secrets | Infisical (self-hosted) | Grátis |
| Observabilidade | Prometheus + Grafana + Jaeger (Docker Compose) | Grátis |
| Deploy de Sites | Vercel / Netlify (free tier) | Grátis |
| WhatsApp | Evolution API (self-hosted) | Grátis |
| Busca (RAG) | SearXNG (self-hosted) | Grátis |
| CI/CD | GitHub Actions (free tier) | Grátis |

### Agente Orchestration

| Componente | Tecnologia | Justificativa |
|---|---|---|
| Framework | CrewAI (Python 3.12) | Multi-agent nativo, workflows, tools |
| LLM Routing | LiteLLM | Abstração única para todos os providers |
| RAG | LangChain + ChromaDB | Maturidade, conectores prontos |
| Embeddings | Ollama nomic-embed-text | Gratuito, local |
| Tracing | LangSmith (free tier) ou Phoenix Arize | Observabilidade de LLM calls |

---

## 17. Estrutura de Diretórios

```
agentepro/
├── .github/
│   └── workflows/
│       ├── ci.yml                          # Lint, test, build
│       ├── security.yml                    # OWASP ZAP, Snyk
│       └── deploy.yml                      # Deploy em staging/prod
│
├── apps/
│   ├── api/                                # Fastify Backend
│   │   ├── src/
│   │   │   ├── domain/                     # Núcleo — sem deps externas
│   │   │   │   ├── agent/
│   │   │   │   │   ├── Agent.ts            # Aggregate root
│   │   │   │   │   ├── AgentId.ts          # Value Object
│   │   │   │   │   ├── LLMConfiguration.ts # Value Object
│   │   │   │   │   ├── AgentRepository.ts  # Interface (Port)
│   │   │   │   │   └── events/
│   │   │   │   │       ├── AgentActivated.ts
│   │   │   │   │       └── AgentPaused.ts
│   │   │   │   ├── lead/
│   │   │   │   ├── deal/
│   │   │   │   ├── project/
│   │   │   │   ├── hitl/
│   │   │   │   └── shared/
│   │   │   │       ├── DomainEvent.ts
│   │   │   │       ├── AggregateRoot.ts
│   │   │   │       └── Result.ts          # Either monad para erros
│   │   │   │
│   │   │   ├── application/                # Use cases / Commands / Queries
│   │   │   │   ├── agent/
│   │   │   │   │   ├── commands/
│   │   │   │   │   │   ├── CreateAgent.command.ts
│   │   │   │   │   │   └── CreateAgent.handler.ts
│   │   │   │   │   └── queries/
│   │   │   │   │       ├── GetAgents.query.ts
│   │   │   │   │       └── GetAgents.handler.ts
│   │   │   │   ├── lead/
│   │   │   │   ├── deal/
│   │   │   │   ├── project/
│   │   │   │   └── hitl/
│   │   │   │
│   │   │   ├── infrastructure/             # Adaptadores de saída
│   │   │   │   ├── db/
│   │   │   │   │   ├── schema.ts           # Drizzle schema
│   │   │   │   │   ├── migrations/
│   │   │   │   │   └── repositories/       # Implementações dos Ports
│   │   │   │   ├── llm/
│   │   │   │   │   ├── LLMRouter.ts        # ACL para providers
│   │   │   │   │   ├── OllamaAdapter.ts
│   │   │   │   │   └── OpenAIAdapter.ts
│   │   │   │   ├── rag/
│   │   │   │   │   └── ChromaDBAdapter.ts
│   │   │   │   ├── messaging/
│   │   │   │   │   ├── WhatsAppAdapter.ts  # Evolution API
│   │   │   │   │   └── EmailAdapter.ts
│   │   │   │   ├── queue/
│   │   │   │   │   └── BullMQAdapter.ts
│   │   │   │   └── secrets/
│   │   │   │       └── InfisicalAdapter.ts
│   │   │   │
│   │   │   ├── http/                       # Adaptadores de entrada
│   │   │   │   ├── routes/
│   │   │   │   │   ├── auth.routes.ts
│   │   │   │   │   ├── agents.routes.ts
│   │   │   │   │   ├── leads.routes.ts
│   │   │   │   │   ├── deals.routes.ts
│   │   │   │   │   ├── projects.routes.ts
│   │   │   │   │   └── hitl.routes.ts
│   │   │   │   ├── middleware/
│   │   │   │   │   ├── auth.middleware.ts
│   │   │   │   │   ├── rateLimiter.middleware.ts
│   │   │   │   │   ├── bodySize.middleware.ts
│   │   │   │   │   └── requestId.middleware.ts
│   │   │   │   └── schemas/                # Zod schemas por rota
│   │   │   │
│   │   │   └── container.ts               # DI container (tsyringe)
│   │   │
│   │   ├── tests/
│   │   │   ├── unit/
│   │   │   ├── integration/
│   │   │   ├── e2e/
│   │   │   └── security/                  # Testes de segurança obrigatórios
│   │   │
│   │   └── package.json
│   │
│   ├── web/                               # Next.js Frontend
│   │   ├── src/
│   │   │   ├── app/                       # App Router
│   │   │   │   ├── (auth)/
│   │   │   │   │   └── login/
│   │   │   │   └── (dashboard)/
│   │   │   │       ├── agents/
│   │   │   │       ├── leads/
│   │   │   │       ├── deals/
│   │   │   │       ├── projects/
│   │   │   │       └── hitl/
│   │   │   ├── components/
│   │   │   ├── hooks/
│   │   │   └── lib/
│   │   └── package.json
│   │
│   └── agent-runtime/                     # Python — CrewAI
│       ├── src/
│       │   ├── agents/
│       │   │   ├── hunter/
│       │   │   ├── closer/
│       │   │   ├── builder/
│       │   │   └── qa/
│       │   ├── skills/
│       │   ├── rag/
│       │   └── workflows/
│       ├── tests/
│       └── pyproject.toml
│
├── packages/
│   ├── shared-types/                      # Types compartilhados TS
│   └── ui/                               # Design system compartilhado
│
├── infra/
│   ├── docker-compose.yml                 # Dev local completo
│   ├── docker-compose.prod.yml
│   └── scripts/
│       ├── setup.sh
│       └── seed.sh
│
├── docs/
│   ├── architecture/
│   ├── api/                               # OpenAPI spec gerada
│   └── runbooks/
│
├── .env.example                           # Exemplo SEM valores reais
├── .gitignore                             # Inclui .env*, secrets/*, *.key
└── README.md
```

---

## 18. Gestão de Segredos e Configuração

### Regra absoluta: zero segredos no repositório

```bash
# .gitignore — obrigatório
.env
.env.*
!.env.example
secrets/
*.pem
*.key
*.p12
infisical.json
```

### Hierarquia de configuração por ambiente

```typescript
// config/index.ts — carregado uma vez no boot
interface AppConfig {
  // Configurações públicas (sem segredos)
  api: { port: number; host: string; corsOrigins: string[] };
  db: { poolMin: number; poolMax: number };
  queue: { concurrency: number };
  hitl: { defaultTimeoutMinutes: number };
  
  // Referências a segredos (não os valores)
  secretRefs: {
    dbUrl: string;           // "secrets/db_url"
    jwtPrivateKey: string;   // "secrets/jwt_private_key"
    smtpConfig: string;      // "secrets/smtp_config"
  };
}

// SecretsProvider interface — injetada, nunca acoplada
interface SecretsProvider {
  get(ref: string): Promise<string>;
  getJson<T>(ref: string): Promise<T>;
}

// Implementação: Infisical (prod) ou arquivo local (dev)
```

### .env.example (commitado, sem valores reais)

```bash
# Infisical
INFISICAL_TOKEN=              # Token do projeto no Infisical
INFISICAL_PROJECT_ID=         # ID do projeto

# Database (apenas para dev local sem Infisical)
DATABASE_URL=postgresql://user:pass@localhost:5432/agentepro

# Ollama (local)
OLLAMA_BASE_URL=http://localhost:11434

# Evolution API (WhatsApp)
EVOLUTION_API_URL=http://localhost:8080
EVOLUTION_API_KEY=

# n8n
N8N_BASE_URL=http://localhost:5678
N8N_API_KEY=

# Notificações HITL
OPERATOR_EMAIL=
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=

# App
NODE_ENV=development
API_PORT=3001
FRONTEND_URL=http://localhost:3000
```

---

## 19. Roadmap e Fases

### Fase 0 — Fundação (Semanas 1-2)
- [ ] Setup do repositório monorepo (Turborepo)
- [ ] Docker Compose com todas as dependências locais
- [ ] Schema do banco de dados + migrations
- [ ] Autenticação do operador (login/logout/refresh)
- [ ] CRUD básico de agentes
- [ ] CI/CD pipeline (GitHub Actions)
- [ ] Testes de segurança base (auth, rate limiting)

### Fase 1 — MVP Core (Semanas 3-6)
- [ ] Agente Hunter: pesquisa + qualificação + HITL
- [ ] Agente Closer: abordagem + negociação + proposta
- [ ] Sistema HITL completo (aprovação, timeout, notificação)
- [ ] CRM básico (leads, deals, histórico de conversas)
- [ ] RAG por agente (upload, embedding, query)
- [ ] Integração WhatsApp (Evolution API)

### Fase 2 — Entrega Completa (Semanas 7-10)
- [ ] Agente Builder: seleção de template + geração de código + customização
- [ ] Agente QA: Lighthouse + OWASP check automático
- [ ] Deploy automático (Vercel/Netlify)
- [ ] Preview antes do deploy
- [ ] Dashboard Grafana básico
- [ ] Testes E2E de fluxo completo

### Fase 3 — Qualidade e Polimento (Semanas 11-12)
- [ ] Fine-tuning de system prompts por agente
- [ ] Editor de rules com teste inline
- [ ] Workflows n8n via interface
- [ ] Exportação de dados do CRM
- [ ] Documentação de operador (runbook)
- [ ] Auditoria de segurança interna

### Fase 4+ — Expansão (v2)
- [ ] Agente de tráfego pago
- [ ] Agente de social media
- [ ] Gateway de pagamento
- [ ] Multi-tenant
- [ ] Marketplace de templates

---

## 20. Riscos e Mitigações

| Risco | Probabilidade | Impacto | Mitigação |
|---|---|---|---|
| Agente envia mensagem inadequada ao cliente | Média | Alto | HITL obrigatório antes de todo contato externo |
| LGPD: armazenamento indevido de dados de leads | Média | Alto | Minimização de dados; política de retenção; consentimento explícito no contato |
| LLM gera código com vulnerabilidades | Alta | Alto | QA Agent + OWASP scan automático antes de qualquer deploy |
| Custo de tokens LLM além do planejado | Média | Médio | Budget por agente com bloqueio automático; preferência por Ollama local |
| Plataformas de mensageria bloqueando o número | Alta | Alto | HITL evita spam; rate limiting de mensagens por dia; termos de uso respeitados |
| Rate limiting do Vercel/Netlify no free tier | Baixa | Médio | Monitoramento de quota; fallback entre plataformas |
| Complexidade do vibe coding gerar dívida técnica | Alta | Médio | PRD detalhado; GSD framework; testes automatizados bloqueantes no CI |
| Quebra de contrato da Evolution API (WhatsApp) | Média | Alto | Adapter isolado; fácil troca de implementação |

---

## 21. Glossário

| Termo | Definição |
|---|---|
| HITL | Human-in-the-Loop: ponto de aprovação humana obrigatória antes de ações externas |
| Persona | Papel funcional fixo de um agente (HUNTER, CLOSER, BUILDER, QA) |
| Skill | Ferramenta/capacidade específica configurada num agente |
| Rule | Condição + ação que o agente avalia antes de executar uma tarefa |
| RAG | Retrieval-Augmented Generation: enriquecer prompts com documentos relevantes |
| ACL | Anti-Corruption Layer: camada que isola o domínio de SDKs e APIs externas |
| CQRS | Command Query Responsibility Segregation: separação de leitura e escrita |
| Aggregate | Cluster de entidades de domínio tratadas como unidade transacional |
| Bounded Context | Limite de responsabilidade de um subdomínio no DDD |
| GSD | Framework Get Shit Done: metodologia iterativa de desenvolvimento focado em entrega |
| Magic Bytes | Assinatura binária nos primeiros bytes de um arquivo que identifica seu tipo real |
| SSRF | Server-Side Request Forgery: ataque que força o servidor a fazer requisições internas |
| Argon2id | Algoritmo de hashing de senhas resistente a GPU e ataques de memória |
| ULID | Universally Unique Lexicographically Sortable Identifier: substituto ao UUID com ordenação temporal |

---

*Este documento é vivo. Atualizações devem ser revisadas pelo arquiteto responsável e versionadas no repositório.*

**Próximos passos:**
1. Revisão e aprovação do PRD por todos os stakeholders
2. Setup do repositório monorepo (Fase 0, Semana 1)
3. Criação das Issues no GitHub a partir dos requisitos funcionais
4. Primeira sprint GSD: Fundação + Autenticação
