# PRD — Hefesto: Plataforma de Agentes de IA para Prospecção e Entrega de Serviços

**Versão:** 2.0.0  
**Status:** Draft — Aprovação Pendente  
**Última atualização:** 2026-05-29  
**Autor:** Produto / Arquitetura  
**Metodologias:** Clean Architecture · Hexagonal Arch · DDD · TDD · BDD · SDD · Security First · GSD  
**Changelog v2:** Adição de Briefing Agent, Delivery Agent, 17 sub-agentes, LLM routing por custo, Gemini 3.1 Pro + 3.5 Flash, Claude Design (Opus 4.7), Nano Banana Pro, Google Maps prospecting, MCP Brasil, TelegramAdapter (canal de vendas + HITL), Cal.com agendamento, Cloudflare Pages + Render + Hostinger, MediaGenerationService, paralelismo de sub-agentes, correção do limite de system_prompt (8k→32k), HeyGen para tutoriais, Deal Tracker sub-agent, token cost dashboard.

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
9. [LLM Routing Strategy — Modelo por Sub-agente](#9-llm-routing-strategy--modelo-por-sub-agente)
10. [Estratégia de Paralelismo de Sub-agentes](#10-estratégia-de-paralelismo-de-sub-agentes)
11. [MediaGenerationService](#11-mediaGenerationservice)
12. [Integração Google Maps + MCP Brasil](#12-integração-google-maps--mcp-brasil)
13. [Canais de Mensageria — WhatsApp + Telegram](#13-canais-de-mensageria--whatsapp--telegram)
14. [Sistema de Agendamento — Cal.com](#14-sistema-de-agendamento--calcom)
15. [Requisitos Funcionais](#15-requisitos-funcionais)
16. [Requisitos Não-Funcionais](#16-requisitos-não-funcionais)
17. [Segurança — Security First](#17-segurança--security-first)
18. [API Design](#18-api-design)
19. [Schema de Banco de Dados](#19-schema-de-banco-de-dados)
20. [Estratégia de Testes](#20-estratégia-de-testes)
21. [Observabilidade e Escalabilidade](#21-observabilidade-e-escalabilidade)
22. [Stack Tecnológica](#22-stack-tecnológica)
23. [Estrutura de Diretórios](#23-estrutura-de-diretórios)
24. [Gestão de Segredos e Configuração](#24-gestão-de-segredos-e-configuração)
25. [Roadmap e Fases](#25-roadmap-e-fases)
26. [Riscos e Mitigações](#26-riscos-e-mitigações)
27. [Glossário](#27-glossário)

---

## 1. Visão Executiva

O **Hefesto** é uma plataforma de agentes de IA que automatiza o ciclo completo de vendas e entrega de serviços digitais — da prospecção ao produto final entregue ao cliente — com mínima intervenção humana e máximo controle do operador.

No MVP v1 completo, a plataforma entrega um ciclo fechado e auditável: o Hunter prospecta leads via Google Maps + MCP Brasil, o Closer negocia via WhatsApp/Telegram/E-mail, o Briefing Agent coleta requisitos de forma conversacional, o Builder cria o site com design visual aprovado e imagens geradas por IA, o QA valida segurança e performance, e o Delivery entrega com tutorial em vídeo. O operador mantém controle total via HITL com notificações e aprovações inline pelo Telegram.

A arquitetura é construída para ser **extensível por design**: novos serviços são adicionados como novos Bounded Contexts sem tocar no núcleo existente.

### Custo Operacional Estimado por Site Entregue

| Etapa                                   | Custo USD  |
| --------------------------------------- | ---------- |
| Prospecção (por lead qualificado, Maps) | ~$0.03     |
| Outreach + follow-up (3 toques)         | ~$0.08     |
| Proposta + negociação                   | ~$0.10     |
| Briefing (coleta estruturada)           | ~$0.02     |
| Designer (mockup Claude Design)         | ~$0.30     |
| Imager (8 imgs Nano Banana Pro)         | ~$0.24     |
| Copywriter (textos)                     | ~$0.15     |
| Coder (código Next.js)                  | ~$0.40     |
| SEO + deploy                            | ~$0.01     |
| Sec. Auditor + Perf. Auditor            | ~$0.25     |
| Delivery (HeyGen tutorial + PDF)        | ~$0.01     |
| **TOTAL por site entregue**             | **~$1.59** |

Com taxa de conversão de 5% (1 venda a cada 20 leads), custo real incluindo prospecção: ~$2.20 por site. Receita esperada: R$500–R$1.500. Margem: >99%.

---

## 2. Contexto e Problema

### Problema Central

Profissionais e pequenas agências digitais perdem 40–70% do tempo em tarefas repetitivas: prospecção manual, propostas, negociação e desenvolvimento de sites padronizados. Custo de aquisição alto, ciclo lento.

### Solução Proposta

Agentes de IA especializados por função, orquestrados numa plataforma configurável, executando o funil completo de vendas e entrega. O operador foca em aprovações estratégicas.

### Diferencial

- Configuração por UI para cada agente: skills, rules, workflows, RAG, MCPs
- LLM por sub-agente: Ollama local, OpenAI, Anthropic, Gemini, Groq — roteamento inteligente por custo
- Prospecção com dados reais: Google Maps Places API + MCP Brasil (CNPJ/CEP)
- Design visual antes do código: mockup aprovado antes de uma linha de HTML
- Multi-provider de imagens: Nano Banana Pro primário, DALL-E 3 fallback, Ollama dev
- Canais duplos: WhatsApp + Telegram (vendas e HITL)
- Ciclo fechado: prospecta → vende → briefing → desenvolve → entrega → follow-up

---

## 3. Objetivos e Métricas de Sucesso

### OKRs do MVP (90 dias pós-lançamento)

| Objetivo                         | Key Result                                  | Meta                |
| -------------------------------- | ------------------------------------------- | ------------------- |
| Validar ciclo de vendas autônomo | Leads contatados por agente/semana          | ≥ 50                |
| Validar entrega automatizada     | Sites entregues sem intervenção técnica     | ≥ 80% do total      |
| Validar confiança do operador    | Taxa de aprovação HITL sem override         | ≥ 70%               |
| Validar qualidade técnica        | Score Lighthouse mínimo                     | ≥ 85 perf, 100 a11y |
| Segurança                        | Vulnerabilidades críticas OWASP em produção | 0                   |
| Custo por site                   | Custo total tokens LLM por site             | < $3.00 (≈ R$15)    |
| Qualidade visual                 | Aprovação mockup sem edição na 1ª tentativa | ≥ 60%               |

### KPIs de Produto

- Tempo médio lead→site entregue: < 48h
- Tempo de criação IA pura (após briefing aprovado): < 15 min
- Taxa de conversão lead→cliente: monitorada por cohort
- Custo por site em tokens: < R$15
- Uptime: ≥ 99.5%
- Score médio de qualificação dos leads: ≥ 55/100

---

## 4. Escopo do MVP

### MVP v0 — Validação do Ciclo de Vendas (Semanas 1–6)

```
[ MVP v0 — Valida se alguém paga pelo site ]
 ├── Autenticação segura (JWT RS256 + Argon2id)
 ├── Painel de gestão de agentes + sub-agentes
 ├── Agente Hunter:
 │   ├── Sub-agente PROSPECTOR (Google Maps Places API)
 │   ├── Sub-agente SITE_INSPECTOR (scraping + score)
 │   └── Sub-agente DATA_ENRICHER (MCP Brasil: CNPJ/CEP)
 ├── Agente Closer:
 │   ├── Sub-agente OUTREACH_WRITER (1º contato)
 │   ├── Sub-agente CONV_HANDLER (negociação)
 │   ├── Sub-agente PROPOSAL_WRITER (proposta PDF)
 │   └── Sub-agente DEAL_TRACKER (follow-up automático)
 ├── Sistema HITL (email + Telegram inline)
 ├── CRM básico com funil visual
 └── WhatsApp + Telegram (canal de vendas)
```

### MVP v1 — Produto Completo com Geração Visual (Semanas 7–17)

```
[ MVP v1 — Produto completo ]
 ├── Agente Briefing:
 │   ├── Sub-agente INTERVIEWER (roteiro adaptativo por nicho)
 │   └── Sub-agente BRIEF_EXTRACTOR (JSON estruturado)
 ├── Agente Builder (sub-agentes em paralelo):
 │   ├── Sub-agente COPYWRITER (textos por segmento)
 │   ├── Sub-agente DESIGNER (mockup Claude Design/Opus 4.7)
 │   ├── Sub-agente IMAGER (Nano Banana Pro)
 │   ├── Sub-agente CODER (Next.js + Tailwind)
 │   ├── Sub-agente SEO_OPTIMIZER (meta + schema.org)
 │   └── Sub-agente DEPLOYER (Vercel/CF Pages/Render/Hostinger)
 ├── Agente QA (sub-agentes em paralelo):
 │   ├── Sub-agente SEC_AUDITOR (OWASP)
 │   ├── Sub-agente PERF_AUDITOR (Lighthouse)
 │   └── Sub-agente CONTENT_CHECK (texto + a11y)
 ├── Agente Delivery:
 │   ├── Sub-agente TUTORIAL_GENERATOR (HeyGen)
 │   ├── Sub-agente DOC_GENERATOR (PDF)
 │   └── Sub-agente NOTIFIER (WhatsApp + Email + Telegram)
 ├── Cal.com (agendamento)
 └── Dashboards Grafana completos (6 dashboards)
```

### Fora do MVP (v2+)

- Agente de tráfego pago (Google Ads + Meta Ads)
- Agente de social media
- Fine-tuning de modelos por nicho
- Gateway de pagamento (Stripe + Mercado Pago)
- Multi-tenant
- Marketplace de templates

---

## 5. Stakeholders e Personas

### Operador (usuário direto)

Freelancer ou dono de micro-agência digital. Quer automatizar sem codar. Técnico o suficiente para configurar agentes. Prioridade máxima: não queimar sua imagem com clientes por mensagens ruins dos agentes.

### Cliente Final

Pequeno empresário ou profissional liberal. Recebe contato via WhatsApp, Telegram ou e-mail. Não sabe que é IA inicialmente. Quer site rápido, bonito e barato. Tem CNPJ ativo ou é MEI.

### Agente de IA

Entidade computacional com papel, skills, rules, sub-agentes e memória. Tratado como ator no sistema com bounded contexts, configurações e logs próprios.

---

## 6. Arquitetura Geral

### Padrão: Hexagonal (Ports & Adapters) + Layered por contexto

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           DRIVING SIDE                                  │
│  REST API │ WebSocket │ n8n Webhook │ CLI (admin)                        │
└──────────────────────┬──────────────────────────────────────────────────┘
                       │ Primary Ports
┌──────────────────────▼──────────────────────────────────────────────────┐
│                       APPLICATION LAYER                                 │
│  Use Cases / Commands / Queries (CQRS)                                  │
│  AgentUC │ SalesUC │ BriefingUC │ BuilderUC │ DeliveryUC                │
└──────────────────────┬──────────────────────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────────────────────┐
│                       DOMAIN LAYER (Core)                               │
│  Entities · Value Objects · Domain Events · Aggregates                  │
│  Domain Services · Specifications · Repository Interfaces               │
└──────────────────────┬──────────────────────────────────────────────────┘
                       │ Secondary Ports
┌──────────────────────▼──────────────────────────────────────────────────┐
│                    INFRASTRUCTURE LAYER                                 │
│  PostgreSQL │ ChromaDB │ LLMRouter(LiteLLM) │ n8n │ MediaGenRouter      │
│  BullMQ/Redis │ Infisical │ TelegramBot │ CalCom │ GoogleMaps           │
└──────────────────────┬──────────────────────────────────────────────────┘
                       │ Driven Side
┌──────────────────────▼──────────────────────────────────────────────────┐
│                      EXTERNAL SERVICES                                  │
│  WhatsApp(EvolutionAPI) · Telegram · SMTP(Brevo) · Vercel               │
│  CloudflarePages · Render · Hostinger · Netlify · GoogleMaps            │
│  MCPBrasil · CalCom · HeyGen · NanaBananaPro · ClaudeDesign             │
└─────────────────────────────────────────────────────────────────────────┘
```

### Princípios Arquiteturais Obrigatórios

1. **Dependency Rule**: dependências sempre apontam para dentro. Domain nunca importa de infra.
2. **CQRS**: Commands e Queries em handlers distintos. Sem lógica de negócio em queries.
3. **Event-Driven**: toda ação de agente emite Domain Event. Handlers assíncronos.
4. **ACL**: integração com LLMs e serviços terceiros sempre via adapter com interface de domínio. Nunca expor SDKs ao domain.
5. **Repository Pattern**: acesso a dados por interfaces. Implementações são infra.
6. **Zero Trust interno**: cada serviço valida tokens independentemente.
7. **Sub-agent isolation**: cada sub-agente tem contexto de janela independente. Agente primário recebe apenas resultados finais.
8. **Parallelism by default**: sub-agentes sem dependência executam em paralelo.

### Bounded Contexts (DDD)

```
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│  Identity &  │  │  Lead &      │  │  Sales &     │
│  Access(IAM) │  │ Prospecting  │  │ Negotiation  │
│              │  │  (Hunter)    │  │  (Closer)    │
└──────────────┘  └──────┬───────┘  └──────┬───────┘
                         │ LeadQualified    │ DealClosed
┌──────────────┐  ┌──────▼───────┐  ┌──────▼───────┐
│    Agent     │  │  Briefing &  │  │  CRM &       │
│  Management  │  │ Requirements │  │   Client     │
│  (Studio)    │  │  (Briefing)  │  │  (Memory)    │
└──────────────┘  └──────┬───────┘  └──────────────┘
                         │ BriefingCompleted
┌──────────────┐  ┌──────▼───────┐  ┌──────────────┐
│  Media &     │  │  Delivery &  │  │  Quality &   │
│  Generation  │  │  Development │  │  Security    │
│  (MediaGen)  │  │  (Builder)   │  │  (QA)        │
└──────────────┘  └──────┬───────┘  └──────┬───────┘
                         │ ProjectBuilt     │ QAApproved
                  ┌──────▼───────┐
                  │    Client    │
                  │   Delivery   │
                  └──────────────┘
```

---

## 7. Domain Model — DDD

### Aggregates Principais

#### Aggregate: Agent (v2)

```typescript
class Agent {
  readonly id: AgentId;
  readonly persona: AgentPersona;
  // Enum v2: HUNTER | CLOSER | BRIEFING | BUILDER | QA | DELIVERY | ORCHESTRATOR
  name: AgentName;
  llmConfig: LLMConfiguration;
  subAgents: SubAgentCollection; // v2: coleção de sub-agentes
  skills: SkillCollection;
  rules: RuleCollection;
  status: AgentStatus;
  ragConfig?: RAGConfiguration;
  mcpServers: MCPServerCollection;
  parallelConfig: ParallelConfig; // v2: configuração de paralelismo
  tokenBudget: TokenBudget; // v2: budget por modelo/provider

  activate(): DomainEvent<AgentActivated>;
  pause(): DomainEvent<AgentPaused>;
  addSubAgent(sub: SubAgent): void;
  dispatchToSubAgent(
    taskType: TaskType,
    payload: TaskPayload,
  ): Promise<TaskResult>;
  canExecuteTask(taskType: TaskType): boolean;
}
```

#### Aggregate: SubAgent (v2 — novo)

```typescript
class SubAgent {
  readonly id: SubAgentId;
  readonly parentAgentId: AgentId;
  readonly role: SubAgentRole;
  // Hunter: PROSPECTOR | SITE_INSPECTOR | DATA_ENRICHER
  // Closer: OUTREACH_WRITER | CONV_HANDLER | PROPOSAL_WRITER | DEAL_TRACKER
  // Briefing: INTERVIEWER | BRIEF_EXTRACTOR
  // Builder: COPYWRITER | DESIGNER | IMAGER | CODER | SEO_OPTIMIZER | DEPLOYER
  // QA: SEC_AUDITOR | PERF_AUDITOR | CONTENT_CHECK
  // Delivery: TUTORIAL_GENERATOR | DOC_GENERATOR | NOTIFIER
  llmConfig: LLMConfiguration; // Pode diferir do agente pai
  skills: SkillCollection;
  executionMode: "sequential" | "parallel";
  parallelGroup?: number; // Sub-agentes com mesmo grupo rodam juntos
  maxRetries: number;
  timeoutSeconds: number;

  execute(input: SubAgentInput): Promise<SubAgentResult>;
  canRunParallelWith(other: SubAgent): boolean;
}
```

#### Aggregate: Lead (v2)

```typescript
class Lead {
  readonly id: LeadId;
  contact: ContactInfo;
  source: LeadSource; // MANUAL | GOOGLE_MAPS | SCRAPED | REFERRAL | APOLLO
  qualificationScore: QualificationScore;
  status: LeadStatus; // NEW | CONTACTED | QUALIFIED | NEGOTIATING | CONVERTED | LOST
  enrichmentData: EnrichmentData; // v2: CNPJ, Maps, ratings
  conversationHistory: Message[];
  preferredChannel: MessageChannel; // v2: WHATSAPP | TELEGRAM | EMAIL
  followUpSchedule: FollowUpSchedule; // v2: cadência de follow-ups
  scheduledMeetingId?: CalMeetingId; // v2: Cal.com booking
  hitlApprovals: HITLApproval[];

  qualify(score: QualificationScore): DomainEvent<LeadQualified>;
  enrich(data: EnrichmentData): DomainEvent<LeadEnriched>;
  convert(deal: Deal): DomainEvent<LeadConverted>;
  scheduleFollowUp(cadence: FollowUpCadence): DomainEvent<FollowUpScheduled>;
}
```

#### Aggregate: Briefing (v2 — novo bounded context)

```typescript
class Briefing {
  readonly id: BriefingId;
  readonly dealId: DealId;
  readonly leadId: LeadId;
  interviewTranscript: string; // Conversa bruta (vault — criptografado)
  structured: ClientBriefingDTO; // JSON limpo para o Builder
  niche: BusinessNiche;
  siteType: SiteType; // institutional | ecommerce | scheduling | portfolio | landing
  uploadedAssets: UploadedAsset[]; // Fotos, logo do cliente
  status: BriefingStatus; // IN_PROGRESS | COMPLETED | APPROVED

  complete(structured: ClientBriefingDTO): DomainEvent<BriefingCompleted>;
  approve(): DomainEvent<BriefingApproved>;
  addAsset(asset: UploadedAsset): void;
}

// ClientBriefingDTO — saída estruturada do BRIEF_EXTRACTOR
interface ClientBriefingDTO {
  businessName: string;
  businessDescription: string;
  niche: string;
  targetAudience: string;
  siteType: SiteType;
  pages: string[]; // ['home','sobre','servicos','contato']
  colorPreferences: string[];
  fontStyle?: "modern" | "classic" | "bold" | "minimal";
  differentials: string[];
  hasEcommerce: boolean;
  hasBlog: boolean;
  hasCustomForm: boolean;
  hasScheduling: boolean; // v2: integração Cal.com
  hasWhatsAppButton: boolean;
  needsCopywriting: boolean;
  deliveryDays: number;
  contactPhone?: string;
  contactWhatsApp?: string;
  address?: string;
  openingHours?: string;
  socialLinks: Record<string, string>;
  logoProvided: boolean;
  photosProvided: boolean;
  referenceWebsites: string[];
}
```

#### Aggregate: Project (v2)

```typescript
class Project {
  readonly id: ProjectId;
  readonly dealId: DealId;
  readonly briefingId: BriefingId; // v2: ref ao Briefing separado
  mockupUrl?: string; // v2: Claude Design output
  mockupApprovedAt?: Timestamp;
  generatedAssets: GeneratedAsset[]; // v2: Nano Banana Pro images
  deliveryTutorialUrl?: string; // v2: HeyGen video
  deliveryDocUrl?: string; // v2: PDF de entrega
  status: ProjectStatus;
  // PLANNING | DESIGNING | BUILDING | QA | STAGING | DELIVERED | REVISION | CANCELLED
  qualityScore?: QualityScore;
  qaCycleCount: number; // v2: ciclos QA antes de aprovação
  deployPlatform?: string; // v2: vercel|cloudflare_pages|render|hostinger

  approveMockup(): DomainEvent<MockupApproved>;
  deliver(deliverable: Deliverable): DomainEvent<ProjectDelivered>;
  requestRevision(notes: RevisionNotes): DomainEvent<RevisionRequested>;
}
```

### Value Objects Críticos

```typescript
// LLMConfiguration — v2: Gemini adicionado, limit 32k chars
class LLMConfiguration {
  readonly provider: LLMProvider;
  // OLLAMA | OPENAI | ANTHROPIC | GROQ | GEMINI | CUSTOM
  readonly modelName: string;
  // ANTHROPIC: claude-opus-4-8, claude-opus-4-7, claude-sonnet-4-6, claude-haiku-4-5
  // GEMINI:    gemini/gemini-3.1-pro, gemini/gemini-3.5-flash
  // OPENAI:    gpt-4o, gpt-4o-mini, o3
  // GROQ:      llama-3.3-70b
  // OLLAMA:    llama3.2:3b, codellama:13b, llava
  readonly apiKeyRef: SecretRef;
  readonly temperature: Temperature;
  readonly maxTokens: MaxTokens;
  readonly systemPrompt: SystemPrompt; // v2: até 32.000 chars (era 8.000)

  estimatedCostPerToken(): number;
  toSafeLog(): object; // Sem apiKeyRef
}

// EnrichmentData — v2
class EnrichmentData {
  readonly cnpj?: string;
  readonly cnpjStatus?: "ATIVA" | "SUSPENSA" | "INAPTA" | "BAIXADA";
  readonly yearsInBusiness?: number;
  readonly googleMapsPlaceId?: string;
  readonly googleRating?: number;
  readonly googleReviewsCount?: number;
  readonly hasWebsite: boolean;
  readonly websiteQualityHint?:
    | "modern"
    | "outdated"
    | "mobile_broken"
    | "none";
  readonly neighborhood?: string;
  readonly city?: string;
  readonly state?: string;

  qualificationBonus(): number;
}

// FollowUpSchedule — v2
class FollowUpSchedule {
  readonly cadenceDays: number[]; // [3, 7, 14]
  readonly maxAttempts: number;
  readonly currentAttempt: number;
  readonly nextFollowUpAt?: Timestamp;

  isExhausted(): boolean;
  advance(): FollowUpSchedule;
}

// Pricing — v2: breakdown adicionado
class Pricing {
  readonly basePrice: Money;
  readonly addons: PricingAddon[];
  readonly discountPct: Percentage;
  readonly breakdown: PricingBreakdownItem[]; // v2

  get total(): Money;
  isValid(): boolean;
}
```

### Domain Events (completo v2)

```typescript
type DomainEvent<T> = {
  eventId: UUID;
  eventType: string;
  aggregateId: string;
  aggregateType: string;
  occurredAt: Timestamp;
  correlationId: UUID;
  causationId?: UUID;
  payload: T;
};

// IAM
OperatorLoggedIn;
OperatorLoggedOut;

// Lead & Prospecting
LeadCreated;
LeadEnriched;
LeadQualified;
LeadConverted;
LeadLost;
LeadProspectedFromMaps;
LeadCNPJValidated;

// Sales
DealProposed;
DealClosed;
DealCancelled;
FollowUpScheduled;
FollowUpSent;
FollowUpExhausted;
MeetingScheduled;

// Briefing (v2)
BriefingStarted;
BriefingCompleted;
BriefingApproved;
BriefingAssetUploaded;

// Builder & Media (v2)
ProjectStarted;
MockupGenerated;
MockupApproved;
AssetGenerationStarted;
AssetGenerated;
AssetGenerationFailed;
CodeGenerationStarted;
CodeGenerationCompleted;
ProjectReadyForReview;
ProjectDelivered;
RevisionRequested;

// QA
QAStarted;
QACheckPassed;
QACheckFailed;
QAApproved;
QARejected;

// Delivery (v2)
DeliveryTutorialGenerated;
SiteDeliveredToClient;
DeliveryFollowUpScheduled;

// Agents
AgentActivated;
AgentPaused;
AgentTaskCompleted;
AgentTaskFailed;
SubAgentDispatched;
SubAgentCompleted;
SubAgentFailed;

// HITL
HITLApprovalRequested;
HITLApprovalDecided;
HITLExpired;

// Messaging
MessageSent;
MessageReceived;
TelegramMessageSent;
TelegramMessageReceived; // v2
```

---

## 8. Especificação dos Agentes

### Estrutura Universal de Agente (v2)

```yaml
agent:
  id: uuid
  persona: HUNTER | CLOSER | BRIEFING | BUILDER | QA | DELIVERY | ORCHESTRATOR

  llm:
    provider: ollama | openai | anthropic | groq | gemini
    model: string
    # claude-opus-4-8 | claude-opus-4-7 | claude-sonnet-4-6 | claude-haiku-4-5
    # gemini/gemini-3.1-pro | gemini/gemini-3.5-flash
    # gpt-4o | gpt-4o-mini | llama-3.3-70b | llama3.2:3b
    api_key_ref: string
    temperature: float
    max_tokens: int
    system_prompt: |
      [até 32.000 chars — v2: limite expandido de 8k]

  sub_agents:
    - id: uuid
      role: string
      llm:
        provider: string
        model: string
        api_key_ref: string
      execution_mode: sequential | parallel
      parallel_group: int? # Mesmo grupo = execução simultânea
      max_retries: 3
      timeout_seconds: 120

  skills:
    - id: uuid
      name: string
      type: web_search | scraping | email | whatsapp | telegram | file_gen |
        deploy | code_gen | rag_query | external_database | image_gen |
        design_gen | scheduling
      # v2: external_database, image_gen, design_gen, scheduling, telegram adicionados
      config: {}
      enabled: boolean

  rules:
    - condition: string # CEL expression
      action: BLOCK | WARN | LOG | ESCALATE_HITL
      priority: int

  mcp_servers:
    - name: string
      url: string
      auth_ref: string?
      allowed_tools: [string] # v2: whitelist de tools por MCP

  hitl:
    require_approval_for:
      - SEND_EXTERNAL_MESSAGE
      - SEND_PROPOSAL
      - APPROVE_MOCKUP # v2
      - DEPLOY_SITE
    approval_timeout_minutes: 60
    notify_channel: telegram # v2: telegram como default (botões inline)

  parallel_execution:
    enabled: boolean
    max_parallel_sub_agents: 3
```

---

### Agente 0 — Orchestrator

**LLM:** Ollama Llama 3.2 3B (custo $0.00 — roteamento determinístico)

```typescript
const PIPELINE_TRANSITIONS = [
  {
    from: "IDLE",
    event: "ScheduleTrigger",
    to: "PROSPECTING",
    agent: "HUNTER",
  },
  {
    from: "PROSPECTING",
    event: "LeadsQualified",
    to: "OUTREACH",
    agent: "CLOSER",
  },
  {
    from: "OUTREACH",
    event: "LeadResponded",
    to: "NEGOTIATING",
    agent: "CLOSER",
  },
  {
    from: "NEGOTIATING",
    event: "SaleClosed",
    to: "BRIEFING",
    agent: "BRIEFING",
  },
  {
    from: "BRIEFING",
    event: "BriefingCompleted",
    to: "DESIGNING",
    agent: "BUILDER",
  },
  {
    from: "DESIGNING",
    event: "MockupGenerated",
    to: "MOCKUP_REVIEW",
    agent: null,
  }, // HITL
  {
    from: "MOCKUP_REVIEW",
    event: "MockupApproved",
    to: "BUILDING",
    agent: "BUILDER",
  },
  {
    from: "MOCKUP_REVIEW",
    event: "MockupRejected",
    to: "DESIGNING",
    agent: "BUILDER",
  }, // retry
  { from: "BUILDING", event: "SiteBuilt", to: "QA", agent: "QA" },
  { from: "QA", event: "QAApproved", to: "DELIVERING", agent: "DELIVERY" },
  { from: "QA", event: "QAFailed", to: "BUILDING", agent: "BUILDER" }, // max 3x
  { from: "DELIVERING", event: "SiteDelivered", to: "DONE", agent: null },
  {
    from: "NEGOTIATING",
    event: "FollowUpDue",
    to: "NEGOTIATING",
    agent: "CLOSER",
  },
];

const RETRY_LIMITS = { BUILDING: 3, DESIGNING: 2, QA: 3 };
```

---

### Agente 1 — Hunter (Prospector)

**System Prompt Base:**

```
Você é um especialista em prospecção digital B2B/B2C para agências de serviços web.
Identifique negócios que se beneficiariam de um site profissional.
Priorize: sem website no Maps, rating ≥ 4.0, ≥ 10 reviews, CNPJ ativo.
NUNCA envie mensagens externas sem aprovação. Responda em pt-BR. Output sempre em JSON.
```

**Sub-agentes:**

```yaml
sub_agents:
  - role: PROSPECTOR
    llm: { provider: gemini, model: gemini/gemini-3.5-flash, temperature: 0.1 }
    skills_refs: [google_maps_prospector, web_search]
    execution_mode: parallel
    parallel_group: 1

  - role: SITE_INSPECTOR
    llm: { provider: gemini, model: gemini/gemini-3.5-flash, temperature: 0.1 }
    skills_refs: [site_analyzer, web_search]
    execution_mode: parallel
    parallel_group: 1 # Mesmo grupo = roda com PROSPECTOR

  - role: DATA_ENRICHER
    llm: { provider: ollama, model: llama3.2:3b, temperature: 0.0 }
    skills_refs: [mcp_brasil]
    execution_mode: sequential # Depende da lista do PROSPECTOR
```

**Skills:**

```yaml
skills:
  - name: google_maps_prospector
    type: external_database
    config:
      provider: google_maps
      api_key_ref: "secrets/google_maps_key"
      endpoint: https://places.googleapis.com/v1/places:searchText
      search_radius_km: 10
      filters:
        - { field: website, operator: is_null_or_empty }
        - { field: rating, operator: gte, value: 3.5 }
        - { field: user_ratings_total, operator: gte, value: 10 }
      enrichment_fields:
        [
          displayName,
          formattedAddress,
          nationalPhoneNumber,
          websiteUri,
          rating,
          userRatingCount,
          regularOpeningHours,
          primaryTypeDisplayName,
        ]
      configurable_categories:
        [
          restaurant,
          beauty_salon,
          dentist,
          gym,
          lawyer,
          real_estate_agency,
          auto_repair,
          accounting,
          veterinary_care,
        ]
      rate_limit_per_day: 2000
      cache_results_ttl_hours: 24

  - name: site_analyzer
    type: scraping
    config:
      timeout_ms: 5000
      extract:
        [
          title,
          description,
          has_contact,
          has_mobile,
          has_ssl,
          performance_hint,
          tech_stack_hints,
        ]
      user_agent: "Hefesto-Crawler/1.0 (+https://seudominio.com/bot)"
      respect_robots_txt: true
      rate_limit_per_minute: 30

  - name: web_search
    type: web_search
    config: { engine: searxng_local, max_results: 10, safe_search: true }

  - name: lead_scorer
    type: rag_query
    config:
      collection: lead_qualification_criteria
      top_k: 5

  - name: mcp_brasil
    type: external_database
    config:
      provider: mcp_brasil
      base_url: "http://mcp-brasil:8000/mcp"
      auth_ref: null
      allowed_tools:
        [brasilapi_consultar_cnpj, brasilapi_consultar_cep, ibge_municipios]
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

  - name: block_suspended_cnpj
    condition: "lead.enrichmentData.cnpjStatus IN ['SUSPENSA','INAPTA','BAIXADA']"
    action: BLOCK
    priority: 2

  - name: min_qualification_score
    condition: "lead.qualificationScore < 40"
    action: LOG
    priority: 3

  - name: skip_recent_leads
    condition: "lead.lastContactedAt > NOW() - INTERVAL '30 days'"
    action: BLOCK
    priority: 2

  - name: rate_limit_scraping
    condition: "agent.requestsInLastMinute > 30"
    action: BLOCK
    priority: 1
```

**Workflow Principal (n8n):**

```
Trigger: Schedule (09:00 diário) ou Manual
→ PROSPECTOR (parallel com SITE_INSPECTOR):
    Google Maps → lista de negócios sem site na categoria/região configurada
→ SITE_INSPECTOR (parallel): analisa site atual de cada candidato
→ DATA_ENRICHER (sequential): valida CNPJ via MCP Brasil
→ Calcular qualification score (lead_scorer RAG)
→ Gateway: score ≥ 40 && CNPJ ativo?
  → Sim: Criar Lead no CRM com enrichmentData → Emitir LeadQualified → HITL
  → Não: Registrar DESCARTADO → Log
→ HITL (Telegram): operador aprova lista com botões inline
→ Aprovado: Emitir LeadApprovedForContact → Closer
```

---

### Agente 2 — Closer (Vendas)

**System Prompt Base:**

```
Você é um consultor de vendas especializado em serviços digitais para pequenos negócios.
Estilo consultivo, empático e direto. Use dados de enriquecimento (avaliações Google,
anos no mercado) para personalizar — mas não revele as fontes.
Nunca pressione. Nunca prometa o que não pode ser entregue.
NUNCA envie proposta sem aprovação do operador. Responda em pt-BR.
```

**Sub-agentes:**

```yaml
sub_agents:
  - role: OUTREACH_WRITER
    llm: { provider: anthropic, model: claude-sonnet-4-6, temperature: 0.7 }
    skills_refs: [whatsapp_sender, telegram_sender, email_sender]
    execution_mode: sequential

  - role: CONV_HANDLER
    llm: { provider: anthropic, model: claude-sonnet-4-6, temperature: 0.6 }
    skills_refs:
      [whatsapp_sender, telegram_sender, email_sender, pricing_calculator]
    execution_mode: sequential

  - role: PROPOSAL_WRITER
    llm: { provider: anthropic, model: claude-sonnet-4-6, temperature: 0.4 }
    skills_refs: [proposal_generator, file_gen]
    execution_mode: sequential

  - role: DEAL_TRACKER
    llm: { provider: ollama, model: llama3.2:3b, temperature: 0.0 }
    skills_refs: [whatsapp_sender, telegram_sender, email_sender]
    execution_mode: sequential
    schedule: "0 9 * * *" # Cron diário às 9h
```

**Skills:**

```yaml
skills:
  - name: whatsapp_sender
    type: whatsapp
    config:
      evolution_api_url: "${EVOLUTION_API_URL}"
      instance_name: "${WPP_INSTANCE}"
      require_hitl: true
      anti_spam_delay_ms: 2000
      max_messages_per_day: 50

  - name: telegram_sender
    type: telegram # v2: canal de vendas
    config:
      bot_token_ref: "secrets/telegram_sales_bot_token"
      require_hitl: true
      parse_mode: Markdown

  - name: email_sender
    type: email
    config:
      smtp_ref: "secrets/smtp_config"
      from_name: "${OPERATOR_NAME}"
      provider: brevo # 300 e-mails/dia grátis

  - name: proposal_generator
    type: rag_query
    config:
      collection: proposal_templates
      top_k: 3
      metadata_filter: { niche: "{{lead.niche}}" }

  - name: pricing_calculator
    type: code_gen
    config:
      engine: internal
      script: pricing_rules_v2.js

  - name: calendar_scheduler
    type: scheduling # v2
    config:
      provider: cal_com
      base_url: "${CAL_BASE_URL}"
      api_key_ref: "secrets/cal_api_key"
      event_type_id: "briefing-30min"
      require_hitl: false
```

**Regras de Precificação (pricing_rules_v2.js):**

```javascript
export function calculatePrice(briefing) {
  const BASE = 800;
  let price = BASE;
  const breakdown = [];

  const siteTypeMultiplier = {
    landing: 0.8,
    institutional: 1.0,
    scheduling: 1.3,
    portfolio: 1.1,
    ecommerce: 2.0,
  };
  price *= siteTypeMultiplier[briefing.siteType] ?? 1.0;
  breakdown.push({ item: `Tipo: ${briefing.siteType}`, value: price });

  if (briefing.pages > 5) {
    const extra = (briefing.pages - 5) * 120;
    price += extra;
    breakdown.push({
      item: `Páginas extras (${briefing.pages - 5})`,
      value: extra,
    });
  }
  if (briefing.hasEcommerce) {
    price += 600;
    breakdown.push({ item: "E-commerce", value: 600 });
  }
  if (briefing.hasBlog) {
    price += 200;
    breakdown.push({ item: "Blog", value: 200 });
  }
  if (briefing.hasCustomForm) {
    price += 150;
    breakdown.push({ item: "Formulário", value: 150 });
  }
  if (briefing.hasScheduling) {
    price += 250;
    breakdown.push({ item: "Cal.com agendamento", value: 250 });
  }
  if (briefing.needsCopywriting) {
    price += 300;
    breakdown.push({ item: "Copywriting", value: 300 });
  }
  if (briefing.deliveryDays < 3) {
    price *= 1.4;
    breakdown.push({ item: "Urgência", value: "40%" });
  }

  if (price > 5000)
    return { price, requiresHITL: true, reason: "above_threshold", breakdown };
  return { price, requiresHITL: false, breakdown };
}
```

**Workflow Principal:**

```
Trigger: DomainEvent[LeadApprovedForContact]
→ OUTREACH_WRITER: gera mensagem personalizada usando enrichmentData
→ HITL (Telegram inline): aprovar/rejeitar/editar
→ Aprovado: envia via canal preferido do lead

Loop de Negociação (até 5 rodadas):
→ Aguardar resposta (webhook)
→ CONV_HANDLER: analisa e responde
→ HITL por mensagem (configurável — pode desativar para respostas padrão)

→ Deal fechado:
  → PROPOSAL_WRITER: PDF da proposta com pricing_calculator
  → HITL: aprovar proposta + valor
  → Enviar proposta

→ Cliente aceita: DealClosed → BriefingStarted → Briefing Agent
→ Silêncio/abandono: DEAL_TRACKER agenda follow-up (cadência: 3, 7, 14 dias)
→ Follow-ups esgotados: DealCancelled → lead marcado LOST
```

---

### Agente 3 — Briefing (v2 — novo)

**Objetivo:** Coletar requisitos completos do site de forma conversacional após o DealClosed, separando essa responsabilidade do Closer.

**System Prompt Base:**

```
Você é um especialista em discovery de projetos web. Colete todas as informações
necessárias para criar um site perfeito. Faça perguntas abertas e amigáveis.
Adapte as perguntas ao segmento: restaurante→cardápio, clínica→especialidades.
Não use jargão técnico. Ao finalizar, gere JSON válido conforme ClientBriefingDTO.
```

**Sub-agentes:**

```yaml
sub_agents:
  - role: INTERVIEWER
    llm: { provider: anthropic, model: claude-sonnet-4-6, temperature: 0.7 }
    skills_refs:
      [whatsapp_sender, telegram_sender, briefing_rag, asset_receiver]
    execution_mode: sequential

  - role: BRIEF_EXTRACTOR
    llm: { provider: anthropic, model: claude-haiku-4-5, temperature: 0.0 }
    skills_refs: [file_gen]
    execution_mode: sequential # Depende do INTERVIEWER
    max_retries: 3
```

**Skills:**

```yaml
skills:
  - name: briefing_rag
    type: rag_query
    config:
      collection: briefing_templates_by_niche
      top_k: 3
      # Restaurant: cardápio, delivery, horário, fotos dos pratos
      # Clinic: convênios, especialidades, agendamento, CNPJ
      # Salon: serviços, agenda online, fotos de trabalhos
      # Lawyer: áreas de atuação, contato preferido, blog jurídico

  - name: asset_receiver
    type: file_gen
    config:
      accept_from_whatsapp: true
      accept_from_telegram: true
      allowed_mime_types: [image/jpeg, image/png, image/webp, image/svg+xml]
      max_size_mb: 10
      validate_magic_bytes: true # OBRIGATÓRIO
```

**Workflow:**

```
Trigger: DomainEvent[DealClosed]
→ INTERVIEWER: carrega template de perguntas por nicho (briefing_rag)
  → Conduz entrevista adaptativa (5–10 perguntas via WhatsApp/Telegram)
  → Recebe fotos/logo (asset_receiver) — valida magic bytes
→ BRIEF_EXTRACTOR: converte transcrição em ClientBriefingDTO (JSON)
  → Valida campos obrigatórios
  → Salva transcrição no vault (criptografado)
  → Salva JSON estruturado no banco
→ Emitir BriefingCompleted
→ HITL (opcional): operador revisa JSON antes de passar ao Builder
→ Emitir BriefingApproved → Builder recebe
```

---

### Agente 4 — Builder (Desenvolvedor)

**System Prompt Base:**

```
Você é um desenvolvedor web sênior e designer especializado em sites profissionais,
performáticos e acessíveis. Siga: WCAG 2.1 AA, OWASP Top 10, Core Web Vitals.
SEMPRE gere mockup visual antes de código. Use apenas templates aprovados.
NUNCA faça deploy sem aprovação. Gere TypeScript/Next.js/Tailwind.
```

**Sub-agentes com paralelismo:**

```yaml
sub_agents:
  # GRUPO 1: PARALELO — rodam simultaneamente após BriefingApproved
  - role: COPYWRITER
    llm: { provider: anthropic, model: claude-sonnet-4-6, temperature: 0.7 }
    skills_refs: [briefing_rag, copywriting_rag]
    execution_mode: parallel
    parallel_group: 1

  - role: DESIGNER
    llm: { provider: anthropic, model: claude-opus-4-7, temperature: 0.5 }
    # claude-opus-4-7 = Claude Design
    skills_refs: [design_gen, briefing_rag]
    execution_mode: parallel
    parallel_group: 1

  - role: IMAGER
    llm: { provider: gemini, model: imagen-3.0-generate-001, temperature: 0.7 }
    # Nano Banana Pro via Gemini API
    skills_refs: [image_gen, asset_handler]
    execution_mode: parallel
    parallel_group: 1

  # GRUPO 2: SEQUENTIAL — depende do GRUPO 1 + mockup aprovado
  - role: CODER
    llm: { provider: anthropic, model: claude-opus-4-8, temperature: 0.2 }
    skills_refs: [code_customizer, template_selector]
    execution_mode: sequential

  # GRUPO 3: PARALELO — após CODER
  - role: SEO_OPTIMIZER
    llm: { provider: anthropic, model: claude-haiku-4-5, temperature: 0.1 }
    skills_refs: [code_customizer]
    execution_mode: parallel
    parallel_group: 3

  - role: DEPLOYER
    llm: { provider: anthropic, model: claude-haiku-4-5, temperature: 0.0 }
    skills_refs: [deployer]
    execution_mode: parallel
    parallel_group: 3
```

**Skills:**

```yaml
skills:
  - name: design_gen
    type: design_gen # v2: Claude Design
    config:
      model: claude-opus-4-7
      api_key_ref: "secrets/anthropic_key"
      output_format: [mockup, wireframe]
      hitl_required: true

  - name: image_gen
    type: image_gen # v2: Nano Banana Pro
    config:
      providers:
        - id: nano_banana_pro
          provider: gemini
          model: imagen-3.0-generate-001
          api_key_ref: "secrets/gemini_key"
          resolution: "2K"
          features: [text_rendering, multi_image_consistency, context_aware]
        - id: dalle3 # FALLBACK
          provider: openai
          model: dall-e-3
          api_key_ref: "secrets/openai_key"
          resolution: "1792x1024"
        - id: ollama_local # FALLBACK DEV
          provider: ollama
          model: llava
          base_url: "${OLLAMA_BASE_URL}"
      fallback_chain: [nano_banana_pro, dalle3, ollama_local]
      synthid_watermark: true
      validate_magic_bytes: true # OBRIGATÓRIO — mesmo para IA gerando
      images_per_site:
        hero: 1
        about: 1
        services: 3
        gallery: 3

  - name: template_selector
    type: rag_query
    config:
      collection: site_templates
      top_k: 5
      metadata_filter: { status: "approved" }

  - name: code_customizer
    type: code_gen
    config:
      engine: llm
      output_validation: true
      owasp_check: true
      required_files:
        [
          pages/index.tsx,
          pages/sobre.tsx,
          pages/servicos.tsx,
          pages/contato.tsx,
          components/Header.tsx,
          components/Footer.tsx,
          components/WhatsAppButton.tsx,
          public/robots.txt,
          public/sitemap.xml,
        ]

  - name: asset_handler
    type: file_gen
    config:
      allowed_mime_types: [image/jpeg, image/png, image/webp, image/svg+xml]
      validate_magic_bytes: true
      optimize_images: true
      webp_conversion: true
      lazy_loading: true

  - name: deployer
    type: deploy
    config:
      platforms: [vercel, cloudflare_pages, render, hostinger, netlify]
      default_platform: vercel
      fallback_platform: cloudflare_pages
      require_hitl: true
      staging_first: true
      pre_deploy_checks:
        [lighthouse_score_min: 85, owasp_zap_scan: true, html_validation: true]
```

**Templates do Catálogo:**

```
INSTITUCIONAL:
  template_01: Landing Page One-Page (Next.js 15, Tailwind 4, TypeScript)
  template_02: Site Institucional 5 páginas (Next.js 15, Tailwind 4, TypeScript)
  template_03: Site com Blog (Next.js 15, MDX, Tailwind 4)

E-COMMERCE:
  template_04: E-commerce básico (Next.js 15, Mercado Pago API, Tailwind 4)
  template_05: Loja Digital (produtos digitais, entrega automática)

COM AGENDAMENTO:
  template_06: Site + Cal.com (Next.js 15, Cal.com widget integrado)

PORTFOLIO:
  template_07: Portfólio criativo (Next.js 15, Framer Motion, Tailwind 4)

Todos incluem:
  - Lighthouse ≥ 90 performance, 100 acessibilidade (baseline)
  - Headers de segurança: CSP, HSTS, X-Frame-Options, Permissions-Policy
  - robots.txt + sitemap.xml automáticos
  - SEO: meta tags, Open Graph, Twitter Card, schema.org
  - WCAG 2.1 AA compliance
  - WhatsApp floating button
  - Google Analytics 4 (sem cookies terceiros)
  - Formulário contato via Formspree
  - Imagens WebP com lazy loading
```

**Workflow com paralelismo:**

```
Trigger: DomainEvent[BriefingApproved]
→ Selecionar template (template_selector RAG)

→ GRUPO 1 (paralelo, ~5 min):
  ├── COPYWRITER: todos os textos do site
  ├── DESIGNER: mockup Claude Design (Opus 4.7)
  └── IMAGER: 6–8 imagens Nano Banana Pro

→ HITL (Telegram): aprovar mockup visual
→ Aprovado: Emitir MockupApproved
→ CODER: código Next.js com textos + mockup + imagens (~8–12 min)

→ GRUPO 3 (paralelo, ~1 min):
  ├── SEO_OPTIMIZER: meta tags, schema.org
  └── DEPLOYER: staging deploy

→ HITL: preview staging
→ Deploy produção
→ Emitir ProjectBuilt → QA Agent
→ QA falha: loop CODER→QA (max 3 ciclos → HITL manual)
```

---

### Agente 5 — QA (Quality & Security Reviewer)

**Sub-agentes em paralelo:**

```yaml
sub_agents:
  - role: SEC_AUDITOR
    llm: { provider: anthropic, model: claude-opus-4-8, temperature: 0.0 }
    skills_refs: [owasp_scanner, html_validator]
    execution_mode: parallel
    parallel_group: 1

  - role: PERF_AUDITOR
    llm: { provider: anthropic, model: claude-haiku-4-5, temperature: 0.0 }
    skills_refs: [lighthouse_runner]
    execution_mode: parallel
    parallel_group: 1

  - role: CONTENT_CHECK
    llm: { provider: anthropic, model: claude-haiku-4-5, temperature: 0.1 }
    skills_refs: [html_validator]
    execution_mode: parallel
    parallel_group: 1
```

**Skills:**

```yaml
skills:
  - name: owasp_scanner
    type: code_gen
    config:
      checks:
        [
          xss,
          sqli,
          csp_headers,
          open_redirect,
          path_traversal,
          sensitive_data_exposure,
          missing_security_headers,
        ]

  - name: lighthouse_runner
    type: code_gen
    config:
      engine: puppeteer
      thresholds:
        performance: 85 # v2: elevado de 80 para 85
        accessibility: 100
        best_practices: 90
        seo: 90

  - name: html_validator
    type: code_gen
    config:
      engine: w3c_validator
      check_aria: true
      check_alt_texts: true
      check_heading_hierarchy: true
```

**Workflow:**

```
Trigger: DomainEvent[ProjectBuilt]
→ PARALELO (~3 min):
  ├── SEC_AUDITOR: OWASP scan
  ├── PERF_AUDITOR: Lighthouse audit (desktop + mobile)
  └── CONTENT_CHECK: textos, alt texts, aria, heading hierarchy

→ Consolidar resultados
→ Alguma falha CRÍTICA ou ALTA?
  → Sim: QAFailed → Builder corrige → novo ciclo (max 3)
  → Não: QAApproved → Delivery Agent
→ Após 3 falhas: HITL com relatório detalhado
```

---

### Agente 6 — Delivery (v2 — novo)

**Sub-agentes:**

```yaml
sub_agents:
  - role: TUTORIAL_GENERATOR
    llm: { provider: anthropic, model: claude-haiku-4-5, temperature: 0.5 }
    skills_refs: [heygen_api, file_gen]
    execution_mode: parallel
    parallel_group: 1

  - role: DOC_GENERATOR
    llm: { provider: anthropic, model: claude-haiku-4-5, temperature: 0.2 }
    skills_refs: [file_gen]
    execution_mode: parallel
    parallel_group: 1

  - role: NOTIFIER
    llm: { provider: anthropic, model: claude-haiku-4-5, temperature: 0.5 }
    skills_refs: [whatsapp_sender, telegram_sender, email_sender]
    execution_mode: sequential # Depende de TUTORIAL e DOC
```

**Skills:**

```yaml
skills:
  - name: heygen_api
    type: file_gen
    config:
      provider: heygen
      api_key_ref: "secrets/heygen_key"
      avatar_id: "${HEYGEN_AVATAR_ID}"
      voice_language: pt-BR
      script_template: |
        Olá {{cliente_nome}}! Seu site {{site_url}} está pronto.
        Veja como acessar o painel de administração...
      output_format: mp4
      resolution: "1280x720"
      duration_max_seconds: 120
```

**Workflow:**

```
Trigger: DomainEvent[QAApproved]

→ PARALELO (~2 min):
  ├── TUTORIAL_GENERATOR: vídeo HeyGen personalizado (nome do cliente, URL)
  └── DOC_GENERATOR: PDF com URL, credenciais, próximos passos

→ NOTIFIER:
  → WhatsApp: mensagem de celebração + links
  → E-mail: PDF como anexo + vídeo tutorial
  → Telegram (se canal ativo): mesma mensagem WhatsApp

→ CRM: status → DELIVERED, gravar urls do tutorial e doc
→ Emitir SiteDeliveredToClient + ProjectDelivered
→ Agendar follow-up 7 dias: "Seu site está no ar há uma semana! Tudo ok?"
→ Agendar follow-up 30 dias: pesquisa NPS
```

---

## 9. LLM Routing Strategy — Modelo por Sub-agente

### Princípio: complexidade da tarefa determina o modelo, não a importância do agente

| Tier | Custo/1k   | Modelo                   | Sub-agentes                                                                                                        |
| ---- | ---------- | ------------------------ | ------------------------------------------------------------------------------------------------------------------ |
| 0    | $0.00      | Ollama Llama 3.2 3B      | Orchestrator, DATA_ENRICHER, DEAL_TRACKER                                                                          |
| 1    | ~$0.01     | Gemini 3.5 Flash         | PROSPECTOR, SITE_INSPECTOR                                                                                         |
| 2    | ~$0.003    | Claude Haiku 4.5         | BRIEF_EXTRACTOR, SEO_OPTIMIZER, DEPLOYER, PERF_AUDITOR, CONTENT_CHECK, TUTORIAL_GENERATOR, DOC_GENERATOR, NOTIFIER |
| 3    | ~$0.015    | Claude Sonnet 4.6        | OUTREACH_WRITER, CONV_HANDLER, PROPOSAL_WRITER, COPYWRITER, INTERVIEWER                                            |
| 4a   | ~$0.025    | Claude Opus 4.8          | CODER, SEC_AUDITOR                                                                                                 |
| 4b   | ~$0.025    | Claude Opus 4.7 (Design) | DESIGNER                                                                                                           |
| 5    | ~$0.04/img | Nano Banana Pro          | IMAGER                                                                                                             |

### LiteLLM Config (Python)

```python
# agent_runtime/config/llm_routing.py
MODELS = {
    "routing":            "ollama/llama3.2:3b",
    "prospecting":        "gemini/gemini-3.5-flash",
    "structured_output":  "claude-haiku-4-5-20251001",
    "natural_language":   "claude-sonnet-4-6",
    "code_and_security":  "claude-opus-4-8",
    "visual_design":      "claude-opus-4-7",            # Claude Design
    "image_generation":   "gemini/imagen-3.0-generate-001",  # Nano Banana Pro
}

# Alternativa: Vertex AI unifica billing Gemini + Claude na mesma conta GCP
VERTEX_MODELS = {
    "prospecting":        "vertex_ai/gemini-flash-3.5",
    "code_and_security":  "vertex_ai/claude-opus-4-8@20260601",
}
```

---

## 10. Estratégia de Paralelismo de Sub-agentes

### Grupos de execução paralela

```
GRUPO 1 — Criação de conteúdo (3 simultâneos, ~5 min total):
  COPYWRITER (Sonnet) │ DESIGNER (Opus 4.7) │ IMAGER (NanaBanana)
  → Tempo sequencial: ~12 min  →  Paralelo: ~5 min

GRUPO 2 — QA (3 simultâneos, ~3 min total):
  SEC_AUDITOR (Opus 4.8) │ PERF_AUDITOR (Haiku) │ CONTENT_CHECK (Haiku)
  → Tempo sequencial: ~6 min  →  Paralelo: ~3 min

GRUPO 3 — Pós-código (2 simultâneos, ~1 min total):
  SEO_OPTIMIZER (Haiku) │ DEPLOYER (Haiku)

GRUPO 4 — Delivery (2 simultâneos, ~2 min total):
  TUTORIAL_GENERATOR (HeyGen ~2min) │ DOC_GENERATOR (Haiku ~30s)
```

### Fluxo completo com tempos

```
Briefing aprovado
├── GRUPO 1 (~5 min paralelo)
│   ├── COPYWRITER
│   ├── DESIGNER ──── HITL mockup (operador: 5–15 min)
│   └── IMAGER
CODER (~8–12 min, sequencial após mockup aprovado)
├── GRUPO 3 (~1 min paralelo)
│   ├── SEO_OPTIMIZER
│   └── DEPLOYER → staging
HITL preview staging (operador: 5–15 min)
Deploy produção (~2 min)
├── GRUPO 2 QA (~3 min paralelo)
│   ├── SEC_AUDITOR
│   ├── PERF_AUDITOR
│   └── CONTENT_CHECK
├── GRUPO 4 (~2 min paralelo)
│   ├── TUTORIAL_GENERATOR
│   └── DOC_GENERATOR
NOTIFIER envia ao cliente (~1 min)

Tempo IA puro (sem HITL):     ~33–43 min
Tempo com HITL médio:         ~45–75 min
```

### CrewAI Implementation

```python
# agent_runtime/agents/builder/builder_agent.py
from crewai import Agent, Task, Crew, Process

class BuilderCrew:
    def run(self, briefing: ClientBriefingDTO) -> BuildResult:
        # GRUPO 1: async_execution=True → CrewAI executa em paralelo
        content_tasks = [
            Task(description=f"Textos para {briefing.businessName}",
                 agent=self.copywriter, async_execution=True),
            Task(description=f"Mockup visual para {briefing.niche}",
                 agent=self.designer, async_execution=True),
            Task(description=f"8 imagens para site de {briefing.niche}",
                 agent=self.imager, async_execution=True),
        ]
        content_crew = Crew(
            agents=[self.copywriter, self.designer, self.imager],
            tasks=content_tasks,
            process=Process.sequential,  # sequential + async_execution = paralelo real
            verbose=True,
        )
        results = content_crew.kickoff()

        # HITL de mockup antes do CODER
        mockup_url = results.tasks_output[1].raw
        self._request_hitl(mockup_url)   # aguarda webhook HITLApprovalDecided
        # ... CODER, SEO, DEPLOY
```

---

## 11. MediaGenerationService

### Interface de Domínio

```typescript
// domain/media/MediaGenerationPort.ts
interface MediaGenerationPort {
  generateImage(
    prompt: ImagePrompt,
    options: ImageOptions,
  ): Promise<GeneratedAsset>;
  generateHeroSection(briefing: ClientBriefingDTO): Promise<HeroAssets>;
  editImage(original: Asset, instructions: string): Promise<GeneratedAsset>;
  optimizeAsset(asset: RawAsset): Promise<OptimizedAsset>;
  validateGeneratedImage(asset: GeneratedAsset): Promise<ValidationResult>;
}

interface ImagePrompt {
  description: string;
  style: "photorealistic" | "illustration" | "minimal" | "bold";
  businessContext: string;
  niche: string;
  colorScheme: string[];
  textToInclude?: string; // Nano Banana Pro tem text rendering excelente
}

interface GeneratedAsset {
  id: AssetId;
  url: string;
  provider: "nano_banana_pro" | "dalle3" | "ollama";
  resolution: string;
  format: "webp" | "jpeg" | "png";
  promptUsed: string;
  synthIdPresent: boolean; // SynthID automático no Nano Banana Pro
  magicBytesValidated: boolean;
  generatedAt: Timestamp;
}
```

### NanaBananaAdapter (Primário)

```typescript
// infrastructure/media/NanaBananaAdapter.ts
class NanaBananaAdapter implements MediaGenerationPort {
  async generateImage(
    prompt: ImagePrompt,
    options: ImageOptions,
  ): Promise<GeneratedAsset> {
    const model = this.client.getGenerativeModel({
      model: "imagen-3.0-generate-001", // Nano Banana Pro via Gemini API
    });
    const result = await model.generateImages({
      prompt: this.buildPrompt(prompt),
      number_of_images: 1,
      aspect_ratio: this.mapAspectRatio(options.aspectRatio),
      output_mime_type: `image/${options.format}`,
    });

    const imageData = result.images[0];

    // OBRIGATÓRIO: validar magic bytes mesmo de API confiável
    await this.validateMagicBytes(imageData.imageBytes);

    return {
      provider: "nano_banana_pro",
      synthIdPresent: true, // Sempre presente no Nano Banana Pro
      magicBytesValidated: true,
      // ...
    };
  }

  private buildPrompt(p: ImagePrompt): string {
    return `${p.description}. Style: ${p.style}. Business: ${p.businessContext} (${p.niche}).
Colors: ${p.colorScheme.join(", ")}. Professional, suitable for business website.
${p.textToInclude ? `Include readable text: "${p.textToInclude}"` : ""}
High resolution, photographic quality.`;
  }
}
```

### MediaGenerationRouter (ACL com fallback chain)

```typescript
// infrastructure/media/MediaGenerationRouter.ts
class MediaGenerationRouter implements MediaGenerationPort {
  private chain = [this.nanaBanana, this.dalle, this.ollamaLocal];

  async generateImage(
    prompt: ImagePrompt,
    options: ImageOptions,
  ): Promise<GeneratedAsset> {
    for (const provider of this.chain) {
      try {
        return await provider.generateImage(prompt, options);
      } catch (error) {
        this.logger.warn(`Provider failed: ${provider.name}`, { error });
      }
    }
    throw new MediaGenerationError("All providers failed");
  }
}
```

### Casos de uso por tipo de imagem

```yaml
hero_section:
  provider: nano_banana_pro  resolution: "2K"  aspect_ratio: "16:9"
  prompt: "Professional hero image for {niche} business {name}. {description}.
           Colors: {colors}. Modern, clean, inviting."

service_icons:
  provider: nano_banana_pro  resolution: "512x512"  aspect_ratio: "1:1"
  prompt: "Minimal icon for {service_name} ({niche}). Simple, modern, flat.
           Color: {primary_color}."

ui_mockup:   # Para DESIGNER sub-agent
  provider: claude_design   # Claude Design via Opus 4.7
  output: mockup_wireframe
  prompt: "Website mockup for {businessName} ({niche}). Colors: {colors}.
           Include: header, hero, services, about, contact."
```

---

## 12. Integração Google Maps + MCP Brasil

### Google Maps Places API (New)

```typescript
// infrastructure/maps/GoogleMapsAdapter.ts
class GoogleMapsAdapterImpl implements GoogleMapsAdapter {
  private readonly BASE_URL =
    "https://places.googleapis.com/v1/places:searchText";

  async searchLeads(params: LeadSearchParams): Promise<GooglePlace[]> {
    const response = await fetch(this.BASE_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": await this.secrets.get("secrets/google_maps_key"),
        "X-Goog-FieldMask": [
          "places.id",
          "places.displayName",
          "places.formattedAddress",
          "places.nationalPhoneNumber",
          "places.websiteUri", // NULL = lead quente!
          "places.rating",
          "places.userRatingCount",
          "places.primaryTypeDisplayName",
          "places.regularOpeningHours",
        ].join(","),
      },
      body: JSON.stringify(params),
    });

    return (await response.json()).places.filter(
      (p: GooglePlace) =>
        !p.websiteUri && // Sem site = lead principal
        p.userRatingCount >= 10 &&
        p.rating >= 3.5,
    );
  }
}
```

### MCP Brasil — Docker Compose

```yaml
# infra/docker-compose.yml — adicionar
mcp-brasil:
  image: ghcr.io/mcp-brasil/mcp-brasil:latest
  ports:
    - "8000:8000"
  command: fastmcp run mcp_brasil.server:mcp --transport http --port 8000
  environment:
    MCP_BRASIL_TOOL_SEARCH: bm25
    TRANSPARENCIA_API_KEY: "" # 66 APIs gratuitas sem chave
  networks: [hefesto-network]
  restart: unless-stopped
  healthcheck:
    test: ["CMD", "curl", "-f", "http://localhost:8000/health"]
    interval: 30s
    retries: 3
```

### MCPBrasilAdapter

```typescript
// infrastructure/mcp/MCPBrasilAdapter.ts
class MCPBrasilAdapter {
  async consultarCNPJ(cnpj: string): Promise<CNPJData> {
    const response = await fetch(
      `${this.baseUrl}/tools/brasilapi_consultar_cnpj`,
      {
        method: "POST",
        body: JSON.stringify({ cnpj }),
      },
    );
    return response.json();
  }
}

// Uso no DATA_ENRICHER
class DataEnricherService {
  async enrichLead(lead: Lead, place: GooglePlace): Promise<EnrichmentData> {
    const cnpjData = await this.mcpBrasil.consultarCNPJ(lead.cnpjHint);
    const yearsInBusiness = cnpjData
      ? this.calculateYears(cnpjData.dataAbertura)
      : undefined;

    // Score bonus
    let bonus = 0;
    if (cnpjData?.situacaoCadastral === "ATIVA") bonus += 20;
    if (yearsInBusiness >= 2) bonus += 10;
    if (place.rating >= 4.0) bonus += 15;
    if (place.userRatingCount >= 50) bonus += 10;

    return new EnrichmentData({
      cnpj: cnpjData?.cnpj,
      cnpjStatus: cnpjData?.situacaoCadastral,
      yearsInBusiness,
      googleMapsPlaceId: place.id,
      googleRating: place.rating,
      googleReviewsCount: place.userRatingCount,
      hasWebsite: !!place.websiteUri,
      qualificationBonus: bonus,
    });
  }
}
```

### Scoring com enriquecimento

```typescript
class LeadQualificationService {
  calculateScore(
    place: GooglePlace,
    enrichment: EnrichmentData,
  ): QualificationScore {
    let score = 0;

    // Presença digital (30 pts)
    if (!enrichment.hasWebsite) score += 30;
    else if (enrichment.websiteQualityHint === "outdated") score += 20;
    else if (enrichment.websiteQualityHint === "mobile_broken") score += 15;

    // Saúde do negócio (30 pts)
    if (enrichment.cnpjStatus === "ATIVA") score += 20;
    if (enrichment.yearsInBusiness >= 2) score += 10;

    // Reputação Maps (25 pts)
    if (place.rating >= 4.5) score += 25;
    else if (place.rating >= 4.0) score += 20;
    else if (place.rating >= 3.5) score += 10;

    // Volume de avaliações (15 pts)
    if (place.userRatingCount >= 100) score += 15;
    else if (place.userRatingCount >= 50) score += 10;
    else if (place.userRatingCount >= 10) score += 5;

    return new QualificationScore(Math.min(score, 100));
  }
}
```

---

## 13. Canais de Mensageria — WhatsApp + Telegram

### Papéis por canal

| Canal            | Papel no Hefesto                                    |
| ---------------- | --------------------------------------------------- |
| WhatsApp         | Canal primário de vendas · entrega ao cliente       |
| Telegram (Bot 1) | HITL: notificações + aprovação inline ao operador   |
| Telegram (Bot 2) | Canal de vendas alternativo ao WhatsApp             |
| E-mail (Brevo)   | Propostas formais · entrega PDF · follow-ups longos |

### WhatsAppAdapter

```typescript
// infrastructure/messaging/WhatsAppAdapter.ts
class WhatsAppEvolutionAdapter implements MessagingPort {
  async sendText(to: string, text: string): Promise<MessageId> {
    await this.rateLimiter.consume("whatsapp_daily", 1); // max 50/dia
    await this.humanDelay(); // 1.5s–4s delay humanizado

    const response = await fetch(
      `${this.baseUrl}/message/sendText/${this.instanceName}`,
      {
        method: "POST",
        headers: { apikey: this.apiKey },
        body: JSON.stringify({ number: to, text }),
      },
    );
    return new MessageId((await response.json()).key.id);
  }

  private async humanDelay(): Promise<void> {
    await new Promise((r) => setTimeout(r, 1500 + Math.random() * 2500));
  }
}
```

### TelegramAdapter (v2 — dois bots)

```typescript
// infrastructure/messaging/TelegramAdapter.ts

// BOT 1: HITL — aprovações inline para operador
class TelegramHITLBot {
  async notifyOperator(approval: HITLApproval): Promise<void> {
    await this.telegram.sendMessage({
      chat_id: process.env.TELEGRAM_OPERATOR_CHAT_ID,
      text: this.formatApprovalMessage(approval),
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [
          [
            { text: "✅ APROVAR", callback_data: `approve:${approval.id}` },
            { text: "❌ REJEITAR", callback_data: `reject:${approval.id}` },
            { text: "✏️ EDITAR", callback_data: `edit:${approval.id}` },
          ],
        ],
      },
    });
  }
}

// BOT 2: SALES — canal de vendas com leads
class TelegramSalesBot implements MessagingPort {
  async sendText(chatId: string, text: string): Promise<MessageId>;
  async sendDocument(
    chatId: string,
    file: Buffer,
    filename: string,
  ): Promise<MessageId>;
  listenWebhook(handler: MessageHandler): void;
}

// MessagingRouter — decide canal por lead
class MessagingRouter {
  route(lead: Lead): MessagingPort {
    switch (lead.preferredChannel) {
      case "WHATSAPP":
        return this.whatsapp;
      case "TELEGRAM":
        return this.telegramSales;
      case "EMAIL":
        return this.email;
      default:
        return this.whatsapp;
    }
  }
}
```

### Prevenção de Banimento WhatsApp

```yaml
anti_ban:
  min_delay_ms: 1500
  max_delay_ms: 4000
  max_messages_per_number_per_day: 50
  max_new_contacts_per_day: 20
  typing_indicator: true
  check_account_health_daily: true
  alert_on_warning: true
  fallback_telegram_on_ban: true
  fallback_email_on_ban: true
```

---

## 14. Sistema de Agendamento — Cal.com

### Docker Compose

```yaml
cal_com:
  image: calcom/cal.com:latest
  environment:
    DATABASE_URL: "${CAL_DB_URL}"
    NEXTAUTH_SECRET: "${CAL_AUTH_SECRET}"
    NEXTAUTH_URL: "http://cal-com:3000"
  ports: ["3100:3000"]
  networks: [hefesto-network]
```

### CalComAdapter

```typescript
// infrastructure/scheduling/CalComAdapter.ts
interface SchedulingPort {
  createBookingLink(options: BookingOptions): Promise<BookingLink>;
  getAvailability(eventTypeId: string, date: string): Promise<TimeSlot[]>;
  cancelBooking(bookingId: string): Promise<void>;
  listenBookingWebhook(handler: BookingHandler): void;
}

class CalComAdapter implements SchedulingPort {
  async createBookingLink(options: BookingOptions): Promise<BookingLink> {
    const response = await fetch(`${this.baseUrl}/api/v1/bookings`, {
      method: "POST",
      headers: { Authorization: `Bearer ${this.apiKey}` },
      body: JSON.stringify({
        eventTypeId: parseInt(options.eventTypeId),
        responses: { name: options.attendeeName, email: options.attendeeEmail },
        metadata: options.metadata, // { leadId, dealId }
      }),
    });
    const data = await response.json();
    return new BookingLink(data.uid, data.meetingUrl);
  }
}

// Tipos de evento configurados
const CAL_EVENT_TYPES = {
  BRIEFING_CALL_30: "briefing-call-30min",
  REVISION_CALL_15: "revision-15min",
};
```

---

## 15. Requisitos Funcionais

### RF-001: Autenticação

- Login e-mail + senha (Argon2id memoryCost≥65536, timeCost≥3, parallelism≥4)
- JWT RS256, 1h + refresh rotativo 7 dias
- Rate limit: 5 tentativas/IP/15min
- Resposta genérica em falha (anti-enumeração + anti-timing attack)

### RF-002: Gestão de Agentes e Sub-agentes

- CRUD agentes primários + sub-agentes via UI
- Personas: HUNTER, CLOSER, BRIEFING, BUILDER, QA, DELIVERY, ORCHESTRATOR
- LLM por sub-agente com provider/modelo/temperatura configuráveis
- system_prompt até 32.000 chars com contador de tokens
- Configuração de paralelismo (grupos de execução simultânea)
- Token budget por agente com bloqueio automático
- Audit log de alterações

### RF-003: HITL

- Pontos obrigatórios: mensagem externa, proposta, mockup, deploy, entrega
- Interface: preview + payload + contexto do lead
- Botões: APROVAR / REJEITAR / EDITAR E APROVAR
- Timeout configurável (padrão 60 min) → rejeição automática
- Notificação Telegram com botões inline (aprovar sem abrir painel)
- Fallback: e-mail se Telegram falhar
- Audit log de todas as decisões HITL

### RF-004: CRM com Funil Visual

- Funil: PROSPECTING→OUTREACH→NEGOTIATING→BRIEFING→BUILDING→QA→DELIVERED
- Filtros: status, canal, agente, data, valor
- Perfil: contato, enrichmentData, conversas, deals, projetos, timeline
- Histórico append-only (imutável)
- Detalhamento de precificação com breakdown
- Exportação CSV (LGPD: apenas operador autenticado)

### RF-005: Prospecção Google Maps

- Configuração de categorias por nicho via UI
- Configuração de região (cidade/bairro/raio km)
- Score mínimo configurável (padrão: 40)
- Filtros: sem site, rating mínimo, reviews mínimos, CNPJ ativo
- Deduplicação: não prospectar mesmo Place ID em 30 dias
- Preview da lista antes do HITL de aprovação

### RF-006: Briefing Conversacional

- Roteiro adaptativo por nicho via RAG
- Recebimento de fotos/logo (WhatsApp/Telegram) com validação magic bytes
- JSON estruturado (ClientBriefingDTO) exportável
- Preview pelo operador antes de passar ao Builder

### RF-007: Geração Visual

- Mockup via Claude Design (Opus 4.7) antes do código
- HITL obrigatório para aprovação do mockup
- 6–8 imagens via Nano Banana Pro por site
- Fallback automático DALL-E 3 → Ollama
- Validação magic bytes em todas as imagens geradas
- Conversão WebP automática
- Preview de imagens antes do deploy

### RF-008: Entrega de Sites

- Templates por tipo: institucional, e-commerce, agendamento, portfólio, landing
- Deploy: Vercel, Cloudflare Pages, Render, Hostinger, Netlify
- Preview staging antes de produção
- Score Lighthouse no CRM após entrega
- Tutorial HeyGen personalizado com nome do cliente
- PDF de entrega: URL, credenciais, próximos passos
- Follow-up automático 7 e 30 dias pós-entrega

### RF-009: RAG por Agente

- Upload PDF/MD/TXT com validação MIME + magic bytes
- Chunking + embedding assíncrono
- Collections: lead_qualification_criteria, briefing_templates_by_niche,
  proposal_templates, site_templates, copywriting_rag
- Teste de query inline no painel

### RF-010: Canais de Mensageria

- WhatsApp via Evolution API (anti-spam, delay humanizado)
- Telegram Vendas (Bot 2 — canal alternativo com leads)
- Telegram HITL (Bot 1 — aprovações inline para operador)
- E-mail via Brevo (300/dia grátis)
- Roteamento automático por canal preferido do lead

### RF-011: Agendamento (Cal.com)

- Geração de link de agendamento personalizado pelo Closer
- Tipos de evento: briefing 30min, revisão 15min
- Sincronização com Google Calendar do operador
- Notificação automática ao operador quando reunião é agendada (Telegram)

### RF-012: Cost Dashboard

- Custo real em USD/BRL por site entregue
- Custo por agente, sub-agente, provider, período
- Alerta quando custo por site exceder threshold configurado
- Projeção mensal baseada na cadência atual

---

## 16. Requisitos Não-Funcionais

### Performance

- API: p95 < 500ms endpoints síncronos
- Criação do site (após briefing): < 30 min total (IA + HITL)
- Tempo IA pura: < 15 min
- FCP do painel: < 2s
- Sites entregues: Lighthouse Performance ≥ 85

### Escalabilidade

- API stateless (horizontal scaling)
- BullMQ + Redis para sub-agentes assíncronos
- Sub-agentes executados como workers BullMQ separados
- pgbouncer para connection pooling
- Zero vendor lock-in em LLM via LiteLLM + adapters

### Disponibilidade

- Uptime: 99.5%
- Health check: `GET /health` com status de todas as deps
- Graceful shutdown com drain de filas

### Custo Operacional

- Token budget por agente com bloqueio automático
- Preferência por Ollama local para tarefas simples ($0.00)
- Cost dashboard em tempo real

---

## 17. Segurança — Security First

### 17.1 Autenticação e Sessão

```typescript
const ARGON2_CONFIG = {
  type: argon2.argon2id,
  memoryCost: 2 ** 16, // 64 MB
  timeCost: 3,
  parallelism: 4,
  hashLength: 32,
} as const;

const JWT_CONFIG = {
  algorithm: "RS256", // NUNCA HS256
  accessTokenExpiry: "1h",
  refreshTokenExpiry: "7d",
  issuer: "hefesto.yourdomain.com",
  audience: "hefesto-api",
} as const;
```

### 17.2 Anti-Enumeração + Anti-Timing Attack

```typescript
async function login(email: string, password: string): Promise<AuthResult> {
  const user = await userRepository.findByEmail(email);
  const dummyHash = "$argon2id$v=19$m=65536,t=3,p=4$...";
  const hashToCompare = user?.passwordHash ?? dummyHash;
  const isValid = await argon2.verify(hashToCompare, password);
  if (!user || !isValid) throw new AuthenticationError("Credenciais inválidas");
  return generateTokens(user);
}
```

### 17.3 Validação Magic Bytes (uploads E imagens geradas por IA)

```typescript
async function validateUpload(file: Express.Multer.File): Promise<void> {
  if (file.size > MAX_FILE_SIZE) throw new ValidationError("File too large");
  const detectedType = await fileTypeFromBuffer(file.buffer.slice(0, 12));
  const ALLOWED = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
  if (!detectedType || !ALLOWED.includes(detectedType.mime))
    throw new ValidationError("Tipo de arquivo não permitido");
}

// OBRIGATÓRIO também para imagens geradas pela IA
async function validateGeneratedImage(imageBytes: Buffer): Promise<void> {
  const detected = await fileTypeFromBuffer(imageBytes.slice(0, 12));
  if (
    !detected ||
    !["image/jpeg", "image/png", "image/webp"].includes(detected.mime)
  )
    throw new SecurityError("Imagem gerada com formato inválido — rejeitada");
  const preview = imageBytes.slice(0, 100).toString("utf-8");
  if (preview.includes("<script") || preview.includes("<?php"))
    throw new SecurityError("Arquivo suspeito — rejeitado");
}
```

### 17.4 SSRF Prevention

```typescript
const SSRF_BLOCKLIST = [
  /^localhost/i,
  /^127\./,
  /^10\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^192\.168\./,
  /^169\.254\./,
  /^::1$/,
  /^fc00:/,
  /^fe80:/,
];

function validateExternalUrl(url: string): void {
  const parsed = new URL(url);
  if (SSRF_BLOCKLIST.some((p) => p.test(parsed.hostname)))
    throw new SecurityError("URL interna não permitida");
}
```

### 17.5 Rate Limiting

```typescript
const rateLimits = {
  login: { windowMs: 15 * 60 * 1000, max: 5 },
  api_general: { windowMs: 60 * 1000, max: 100 },
  agent_execute: { windowMs: 60 * 1000, max: 10 },
  file_upload: { windowMs: 60 * 1000, max: 5 },
  hitl_decision: { windowMs: 5 * 1000, max: 3 },
  image_gen: { windowMs: 60 * 1000, max: 20 },
  maps_search: { windowMs: 86400 * 1000, max: 2000 },
};
```

### 17.6 Headers de Segurança HTTP

```typescript
const SECURITY_HEADERS = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=31536000; includeSubDomains; preload",
  },
  {
    key: "Content-Security-Policy",
    value:
      "default-src 'self'; script-src 'self' 'nonce-{NONCE}'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; frame-ancestors 'none'",
  },
];
```

### 17.7 Audit Log Imutável

```typescript
interface AuditEntry {
  id: string; // ULID
  timestamp: Timestamp;
  actor: "OPERATOR" | AgentPersona;
  actorId: string;
  action: string;
  resourceType: string;
  resourceId: string;
  payload: Record<string, unknown>; // PII removido/mascarado
  ipAddress?: string;
  correlationId: UUID;
  causationId?: UUID;
}
// RLS: apenas INSERT. UPDATE/DELETE bloqueados.
```

### 17.8 Gestão de Segredos

```
Dev:        .env.local (gitignored)
Prod:       Infisical self-hosted (gratuito) ou HashiCorp Vault
Código:     refs "secrets/chave" — nunca process.env.KEY em domínio
Injeção:    sempre via constructor DI com interface SecretsProvider
```

---

## 18. API Design

### Princípios

- REST, recursos no plural, versionamento `/api/v1/`
- CQRS: GET=queries, POST/PATCH/DELETE=commands
- Envelope: `{ data, meta, errors }`
- Paginação por cursor

### Endpoints MVP v2

```
AUTH
  POST   /api/v1/auth/login
  POST   /api/v1/auth/refresh
  DELETE /api/v1/auth/logout

AGENTS
  GET    /api/v1/agents
  POST   /api/v1/agents
  GET    /api/v1/agents/:id
  PATCH  /api/v1/agents/:id
  POST   /api/v1/agents/:id/activate
  POST   /api/v1/agents/:id/pause
  GET    /api/v1/agents/:id/logs
  POST   /api/v1/agents/:id/test-llm
  GET    /api/v1/agents/:id/token-usage

SUB-AGENTS (v2)
  GET    /api/v1/agents/:id/sub-agents
  POST   /api/v1/agents/:id/sub-agents
  PATCH  /api/v1/agents/:id/sub-agents/:subId
  DELETE /api/v1/agents/:id/sub-agents/:subId
  POST   /api/v1/agents/:id/sub-agents/:subId/test

AGENT SKILLS
  GET/POST /api/v1/agents/:id/skills
  PATCH/DELETE /api/v1/agents/:id/skills/:skillId

AGENT RAG
  GET    /api/v1/agents/:id/rag/documents
  POST   /api/v1/agents/:id/rag/documents
  DELETE /api/v1/agents/:id/rag/documents/:docId
  POST   /api/v1/agents/:id/rag/query

HITL
  GET    /api/v1/hitl/pending
  GET    /api/v1/hitl/:id
  POST   /api/v1/hitl/:id/approve
  POST   /api/v1/hitl/:id/reject
  PATCH  /api/v1/hitl/:id/edit-and-approve

LEADS
  GET    /api/v1/leads
  GET    /api/v1/leads/:id
  POST   /api/v1/leads
  PATCH  /api/v1/leads/:id/status
  GET    /api/v1/leads/:id/enrichment
  GET    /api/v1/leads/:id/follow-ups

DEALS
  GET    /api/v1/deals
  GET    /api/v1/deals/:id
  POST   /api/v1/deals/:id/cancel
  POST   /api/v1/deals/:id/schedule-meeting

BRIEFINGS (v2)
  GET    /api/v1/briefings
  GET    /api/v1/briefings/:id
  PATCH  /api/v1/briefings/:id/approve
  POST   /api/v1/briefings/:id/assets

PROJECTS
  GET    /api/v1/projects
  GET    /api/v1/projects/:id
  GET    /api/v1/projects/:id/mockup
  GET    /api/v1/projects/:id/assets
  POST   /api/v1/projects/:id/request-revision
  GET    /api/v1/projects/:id/lighthouse

PROSPECTING (v2)
  POST   /api/v1/prospecting/search-maps
  GET    /api/v1/prospecting/queue
  GET    /api/v1/prospecting/config

MEDIA (v2)
  POST   /api/v1/media/generate-image
  GET    /api/v1/media/:id
  DELETE /api/v1/media/:id

SCHEDULING (v2)
  POST   /api/v1/scheduling/booking-link
  GET    /api/v1/scheduling/bookings
  DELETE /api/v1/scheduling/bookings/:id

SYSTEM
  GET    /api/v1/health
  GET    /api/v1/metrics          # Prometheus format
  GET    /api/v1/costs            # Cost dashboard
```

### Contrato de Resposta

```typescript
// Sucesso
{ "data": {...}, "meta": { "requestId": "01HZ...", "timestamp": "2026-..." } }

// Erro
{ "errors": [{ "code": "VALIDATION_ERROR", "message": "...", "field": "...", "requestId": "01HZ..." }] }

// Lista paginada
{ "data": [...], "meta": { "cursor": { "next": "01HZ...", "prev": null }, "total": 142, "limit": 20 } }
```

---

## 19. Schema de Banco de Dados

```sql
-- ============================================================
-- SCHEMA: hefesto v2
-- PostgreSQL 16 · RLS ativado · Append-only em audit e messages
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- IAM
-- ============================================================
CREATE TABLE operators (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email             TEXT NOT NULL UNIQUE,
    password_hash     TEXT NOT NULL,                       -- Argon2id
    name              TEXT NOT NULL,
    telegram_chat_id  TEXT,                                -- v2: HITL inline
    is_active         BOOLEAN NOT NULL DEFAULT true,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE refresh_tokens (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    operator_id UUID NOT NULL REFERENCES operators(id) ON DELETE CASCADE,
    token_hash  TEXT NOT NULL UNIQUE,
    expires_at  TIMESTAMPTZ NOT NULL,
    revoked_at  TIMESTAMPTZ,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- AGENT MANAGEMENT (v2: BRIEFING, DELIVERY, GEMINI adicionados)
-- ============================================================
CREATE TYPE agent_persona AS ENUM (
    'HUNTER','CLOSER','BRIEFING','BUILDER','QA','DELIVERY','ORCHESTRATOR'
);
CREATE TYPE agent_status  AS ENUM ('ACTIVE','INACTIVE','PAUSED');
CREATE TYPE llm_provider  AS ENUM ('OLLAMA','OPENAI','ANTHROPIC','GROQ','GEMINI','CUSTOM');

CREATE TABLE agents (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    operator_id                 UUID NOT NULL REFERENCES operators(id),
    name                        TEXT NOT NULL CHECK (length(name) BETWEEN 3 AND 50),
    persona                     agent_persona NOT NULL,
    status                      agent_status NOT NULL DEFAULT 'INACTIVE',
    llm_provider                llm_provider NOT NULL,
    llm_model                   TEXT NOT NULL,
    llm_base_url                TEXT,
    llm_api_key_ref             TEXT,
    llm_temperature             NUMERIC(3,2) NOT NULL DEFAULT 0.7
                                  CHECK (llm_temperature BETWEEN 0 AND 2),
    llm_max_tokens              INTEGER NOT NULL DEFAULT 4096
                                  CHECK (llm_max_tokens BETWEEN 100 AND 200000),
    llm_system_prompt           TEXT,                     -- v2: sem CHECK de length (32k)
    token_budget_total          BIGINT NOT NULL DEFAULT 1000000,
    token_budget_remaining      BIGINT NOT NULL DEFAULT 1000000,
    token_budget_cost_usd       NUMERIC(10,4) NOT NULL DEFAULT 0,  -- v2
    rag_enabled                 BOOLEAN NOT NULL DEFAULT false,
    rag_collection              TEXT,
    rag_top_k                   INTEGER DEFAULT 5,
    rag_threshold               NUMERIC(3,2) DEFAULT 0.7,
    parallel_execution_enabled  BOOLEAN NOT NULL DEFAULT false,    -- v2
    max_parallel_sub_agents     INTEGER NOT NULL DEFAULT 1,        -- v2
    hitl_timeout_minutes        INTEGER NOT NULL DEFAULT 60,
    hitl_notify_channel         TEXT NOT NULL DEFAULT 'telegram',  -- v2: telegram default
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- v2: Sub-agentes
CREATE TABLE sub_agents (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id        UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    role            TEXT NOT NULL,
    -- PROSPECTOR | SITE_INSPECTOR | DATA_ENRICHER
    -- OUTREACH_WRITER | CONV_HANDLER | PROPOSAL_WRITER | DEAL_TRACKER
    -- INTERVIEWER | BRIEF_EXTRACTOR
    -- COPYWRITER | DESIGNER | IMAGER | CODER | SEO_OPTIMIZER | DEPLOYER
    -- SEC_AUDITOR | PERF_AUDITOR | CONTENT_CHECK
    -- TUTORIAL_GENERATOR | DOC_GENERATOR | NOTIFIER
    llm_provider    llm_provider NOT NULL,
    llm_model       TEXT NOT NULL,
    llm_api_key_ref TEXT,
    llm_temperature NUMERIC(3,2) NOT NULL DEFAULT 0.5,
    llm_max_tokens  INTEGER NOT NULL DEFAULT 4096,
    execution_mode  TEXT NOT NULL DEFAULT 'sequential'
                      CHECK (execution_mode IN ('sequential','parallel')),
    parallel_group  INTEGER,                              -- Mesmo grupo = simultâneo
    max_retries     INTEGER NOT NULL DEFAULT 2,
    timeout_seconds INTEGER NOT NULL DEFAULT 120,
    is_enabled      BOOLEAN NOT NULL DEFAULT true,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE agent_skills (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id     UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    sub_agent_id UUID REFERENCES sub_agents(id) ON DELETE CASCADE,  -- v2
    name         TEXT NOT NULL,
    skill_type   TEXT NOT NULL,
    -- web_search | scraping | email | whatsapp | telegram | file_gen |
    -- deploy | code_gen | rag_query | external_database | image_gen |
    -- design_gen | scheduling
    config       JSONB NOT NULL DEFAULT '{}',
    is_enabled   BOOLEAN NOT NULL DEFAULT true,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE agent_rules (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id   UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    name       TEXT NOT NULL,
    condition  TEXT NOT NULL,
    action     TEXT NOT NULL CHECK (action IN ('BLOCK','WARN','LOG','ESCALATE_HITL')),
    priority   INTEGER NOT NULL DEFAULT 100,
    is_enabled BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE mcp_servers (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id      UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    name          TEXT NOT NULL,
    url           TEXT NOT NULL,
    auth_ref      TEXT,
    allowed_tools JSONB NOT NULL DEFAULT '[]',           -- v2: whitelist
    is_enabled    BOOLEAN NOT NULL DEFAULT true,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- LEAD & PROSPECTING (v2: GOOGLE_MAPS, TELEGRAM, enrichment)
-- ============================================================
CREATE TYPE lead_source AS ENUM ('MANUAL','GOOGLE_MAPS','SCRAPED','REFERRAL','APOLLO');
CREATE TYPE lead_status AS ENUM ('NEW','CONTACTED','QUALIFIED','NEGOTIATING','CONVERTED','LOST');
CREATE TYPE message_direction AS ENUM ('INBOUND','OUTBOUND');
CREATE TYPE message_channel   AS ENUM ('WHATSAPP','TELEGRAM','EMAIL','INTERNAL');

CREATE TABLE leads (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    operator_id         UUID NOT NULL REFERENCES operators(id),
    assigned_agent_id   UUID REFERENCES agents(id),
    contact_name        TEXT NOT NULL,
    contact_email       TEXT,
    contact_phone       TEXT,
    contact_company     TEXT,
    contact_website     TEXT,
    preferred_channel   message_channel NOT NULL DEFAULT 'WHATSAPP',  -- v2
    source              lead_source NOT NULL DEFAULT 'MANUAL',
    qualification_score INTEGER CHECK (qualification_score BETWEEN 0 AND 100),
    status              lead_status NOT NULL DEFAULT 'NEW',
    notes               TEXT,
    enrichment_data     JSONB DEFAULT '{}',
    -- { cnpj, cnpj_status, years_in_business, google_rating,
    --   google_reviews_count, has_website, maps_place_id,
    --   neighborhood, city, state }
    follow_up_count     INTEGER NOT NULL DEFAULT 0,
    next_follow_up_at   TIMESTAMPTZ,
    scheduled_meeting_id TEXT,                                         -- Cal.com UID
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE messages (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id         UUID NOT NULL REFERENCES leads(id),
    agent_id        UUID REFERENCES agents(id),
    sub_agent_id    UUID REFERENCES sub_agents(id),   -- v2
    direction       message_direction NOT NULL,
    channel         message_channel NOT NULL,
    content         TEXT NOT NULL CHECK (length(content) <= 10000),
    content_type    TEXT NOT NULL DEFAULT 'text/plain',
    external_id     TEXT,
    sent_at         TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
    -- Append-only via RLS
);

-- ============================================================
-- SALES & NEGOTIATION
-- ============================================================
CREATE TYPE deal_status  AS ENUM ('PROPOSED','NEGOTIATING','CLOSED','CANCELLED');
CREATE TYPE service_type AS ENUM ('WEBSITE','TRAFFIC','SOCIAL_MEDIA','OTHER');

CREATE TABLE deals (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id           UUID NOT NULL REFERENCES leads(id),
    operator_id       UUID NOT NULL REFERENCES operators(id),
    agent_id          UUID REFERENCES agents(id),
    service_type      service_type NOT NULL,
    status            deal_status NOT NULL DEFAULT 'PROPOSED',
    briefing_summary  JSONB NOT NULL DEFAULT '{}',
    proposal_text     TEXT,
    base_price_cents  BIGINT NOT NULL DEFAULT 0,
    addons            JSONB NOT NULL DEFAULT '[]',
    discount_pct      NUMERIC(5,2) NOT NULL DEFAULT 0
                        CHECK (discount_pct BETWEEN 0 AND 100),
    price_breakdown   JSONB NOT NULL DEFAULT '[]',        -- v2
    total_cents       BIGINT GENERATED ALWAYS AS (
                        ROUND(base_price_cents * (1 - discount_pct / 100))
                      ) STORED,
    currency          TEXT NOT NULL DEFAULT 'BRL',
    proposal_sent_at  TIMESTAMPTZ,
    closed_at         TIMESTAMPTZ,
    closed_reason     TEXT,
    follow_up_count   INTEGER NOT NULL DEFAULT 0,
    last_follow_up_at TIMESTAMPTZ,
    scheduled_meeting_uid TEXT,                           -- v2: Cal.com
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- BRIEFING (v2 — novo contexto)
-- ============================================================
CREATE TYPE briefing_status AS ENUM ('IN_PROGRESS','COMPLETED','APPROVED');
CREATE TYPE site_type AS ENUM ('institutional','ecommerce','scheduling','portfolio','landing');

CREATE TABLE briefings (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    deal_id              UUID NOT NULL REFERENCES deals(id),
    lead_id              UUID NOT NULL REFERENCES leads(id),
    operator_id          UUID NOT NULL REFERENCES operators(id),
    agent_id             UUID REFERENCES agents(id),
    status               briefing_status NOT NULL DEFAULT 'IN_PROGRESS',
    niche                TEXT,
    site_type            site_type,
    structured_brief     JSONB NOT NULL DEFAULT '{}',     -- ClientBriefingDTO
    transcript_vault_ref TEXT,                             -- Vault (PII)
    uploaded_assets      JSONB NOT NULL DEFAULT '[]',
    completed_at         TIMESTAMPTZ,
    approved_at          TIMESTAMPTZ,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE briefing_assets (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    briefing_id           UUID NOT NULL REFERENCES briefings(id) ON DELETE CASCADE,
    file_name             TEXT NOT NULL,
    mime_type             TEXT NOT NULL,
    size_bytes            INTEGER NOT NULL,
    storage_path          TEXT NOT NULL,
    magic_bytes_validated BOOLEAN NOT NULL DEFAULT false,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- DELIVERY & DEVELOPMENT (v2: expandido)
-- ============================================================
CREATE TYPE project_status AS ENUM (
    'PLANNING','DESIGNING','BUILDING','QA','STAGING','DELIVERED','REVISION','CANCELLED'
);

CREATE TABLE projects (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    deal_id              UUID NOT NULL REFERENCES deals(id),
    briefing_id          UUID REFERENCES briefings(id),   -- v2
    operator_id          UUID NOT NULL REFERENCES operators(id),
    assigned_agent_id    UUID REFERENCES agents(id),
    status               project_status NOT NULL DEFAULT 'PLANNING',
    template_id          TEXT,
    site_type            site_type,
    niche                TEXT,
    mockup_url           TEXT,                             -- v2: Claude Design
    mockup_approved_at   TIMESTAMPTZ,
    generated_assets     JSONB NOT NULL DEFAULT '[]',     -- v2: NanaBanana imgs
    deploy_platform      TEXT,                            -- v2
    staging_url          TEXT,
    deliverable_url      TEXT,
    deliverable_meta     JSONB DEFAULT '{}',
    lighthouse_perf      INTEGER,
    lighthouse_a11y      INTEGER,
    lighthouse_seo       INTEGER,
    lighthouse_bp        INTEGER,
    owasp_scan_passed    BOOLEAN,
    content_check_passed BOOLEAN,
    delivery_tutorial_url TEXT,                           -- v2: HeyGen
    delivery_doc_url     TEXT,                            -- v2: PDF
    revision_count       INTEGER NOT NULL DEFAULT 0,
    revision_notes       TEXT,
    qa_cycle_count       INTEGER NOT NULL DEFAULT 0,
    delivered_at         TIMESTAMPTZ,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE generated_assets (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id            UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    asset_type            TEXT NOT NULL,                  -- hero,about,service_icon,gallery
    provider              TEXT NOT NULL,                  -- nano_banana_pro,dalle3,ollama
    storage_url           TEXT NOT NULL,
    prompt_used           TEXT,
    resolution            TEXT,
    format                TEXT NOT NULL DEFAULT 'webp',
    synth_id_present      BOOLEAN NOT NULL DEFAULT false,
    magic_bytes_validated BOOLEAN NOT NULL DEFAULT true,
    generation_cost_usd   NUMERIC(8,4),
    created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- HITL
-- ============================================================
CREATE TYPE hitl_status AS ENUM ('PENDING','APPROVED','REJECTED','EXPIRED','EDITED_APPROVED');

CREATE TABLE hitl_approvals (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    operator_id         UUID NOT NULL REFERENCES operators(id),
    agent_id            UUID NOT NULL REFERENCES agents(id),
    sub_agent_id        UUID REFERENCES sub_agents(id),   -- v2
    action_type         TEXT NOT NULL,
    context_type        TEXT NOT NULL,                    -- LEAD|DEAL|BRIEFING|PROJECT|MOCKUP
    context_id          UUID NOT NULL,
    payload_preview     JSONB NOT NULL,                   -- PII mascarado
    payload_full_ref    TEXT,                             -- Vault ref
    status              hitl_status NOT NULL DEFAULT 'PENDING',
    notify_channel      TEXT NOT NULL DEFAULT 'telegram',
    telegram_message_id TEXT,                             -- v2: edição inline
    expires_at          TIMESTAMPTZ NOT NULL,
    decided_at          TIMESTAMPTZ,
    operator_note       TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- SCHEDULING (v2)
-- ============================================================
CREATE TABLE scheduled_meetings (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id         UUID NOT NULL REFERENCES leads(id),
    deal_id         UUID REFERENCES deals(id),
    cal_booking_uid TEXT NOT NULL UNIQUE,
    event_type      TEXT NOT NULL,
    attendee_name   TEXT NOT NULL,
    attendee_email  TEXT NOT NULL,
    start_time      TIMESTAMPTZ,
    end_time        TIMESTAMPTZ,
    status          TEXT NOT NULL DEFAULT 'SCHEDULED'
                      CHECK (status IN ('SCHEDULED','COMPLETED','CANCELLED','RESCHEDULED')),
    meeting_url     TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- AUDIT LOG (APPEND-ONLY)
-- ============================================================
CREATE TABLE audit_log (
    id             TEXT PRIMARY KEY,    -- ULID
    timestamp      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    actor          TEXT NOT NULL,
    actor_id       TEXT NOT NULL,
    action         TEXT NOT NULL,
    resource_type  TEXT NOT NULL,
    resource_id    TEXT NOT NULL,
    payload        JSONB NOT NULL DEFAULT '{}',  -- PII mascarado
    ip_address     INET,
    correlation_id UUID NOT NULL,
    causation_id   UUID
);
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY audit_insert_only ON audit_log FOR INSERT TO app_role WITH CHECK (true);

-- ============================================================
-- COST TRACKING (v2)
-- ============================================================
CREATE TABLE token_usage_log (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id          UUID NOT NULL REFERENCES agents(id),
    sub_agent_id      UUID REFERENCES sub_agents(id),
    project_id        UUID REFERENCES projects(id),
    lead_id           UUID REFERENCES leads(id),
    provider          llm_provider NOT NULL,
    model             TEXT NOT NULL,
    prompt_tokens     INTEGER NOT NULL DEFAULT 0,
    completion_tokens INTEGER NOT NULL DEFAULT 0,
    total_tokens      INTEGER NOT NULL DEFAULT 0,
    cost_usd          NUMERIC(10,6) NOT NULL DEFAULT 0,
    task_type         TEXT,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- ÍNDICES (v2: expandido)
-- ============================================================
CREATE INDEX idx_leads_status       ON leads(status, operator_id);
CREATE INDEX idx_leads_agent        ON leads(assigned_agent_id);
CREATE INDEX idx_leads_source       ON leads(source);
CREATE INDEX idx_leads_maps_place   ON leads((enrichment_data->>'maps_place_id'));
CREATE INDEX idx_leads_next_followup ON leads(next_follow_up_at)
  WHERE next_follow_up_at IS NOT NULL;
CREATE INDEX idx_messages_lead      ON messages(lead_id, created_at DESC);
CREATE INDEX idx_messages_channel   ON messages(channel, direction);
CREATE INDEX idx_deals_lead         ON deals(lead_id);
CREATE INDEX idx_deals_status       ON deals(status, operator_id);
CREATE INDEX idx_briefings_deal     ON briefings(deal_id);
CREATE INDEX idx_briefings_status   ON briefings(status);
CREATE INDEX idx_projects_status    ON projects(status, operator_id);
CREATE INDEX idx_projects_briefing  ON projects(briefing_id);
CREATE INDEX idx_hitl_pending       ON hitl_approvals(operator_id, status)
  WHERE status = 'PENDING';
CREATE INDEX idx_hitl_expires       ON hitl_approvals(expires_at)
  WHERE status = 'PENDING';
CREATE INDEX idx_sub_agents_agent   ON sub_agents(agent_id);
CREATE INDEX idx_token_usage_agent  ON token_usage_log(agent_id, created_at DESC);
CREATE INDEX idx_token_usage_proj   ON token_usage_log(project_id);
CREATE INDEX idx_audit_resource     ON audit_log(resource_type, resource_id);
CREATE INDEX idx_audit_correlation  ON audit_log(correlation_id);
```

---

## 20. Estratégia de Testes

### Pirâmide

```
         /\   E2E (Playwright) — Fluxos críticos completos
        /--\
       /----\  Integration (Supertest + Testcontainers)
      /------\  API + DB + LLM mocked + Maps mocked
     /--------\
    /----------\ Unit (Vitest) — Domain, use cases, value objects
   /------------\
  /-Security Tests\ OWASP ZAP + testes customizados (100% obrigatório)
```

### BDD — Cenários Principais

```gherkin
Feature: Qualificação de Lead via Google Maps
  Scenario: Lead qualificado com sucesso
    Given agente Hunter ativo com score mínimo 40
    And pizzaria "Bella Napoli" no Maps sem website, nota 4.8, 234 avaliações
    When Hunter busca leads na categoria "restaurant" em Salvador
    And DATA_ENRICHER valida CNPJ como "ATIVA"
    Then lead deve ter score >= 60
    And enrichment_data deve conter maps_place_id
    And HITL deve ser criado com notificação Telegram

  Scenario: Lead bloqueado por CNPJ suspenso
    Given negócio no Maps sem website
    But CNPJ situação "SUSPENSA"
    When Hunter processa o lead
    Then lead deve ser BLOQUEADO pela rule block_suspended_cnpj

Feature: Execução paralela do Builder
  Scenario: Grupo 1 roda em paralelo
    Given briefing aprovado para pizzaria
    When Builder Agent inicia
    Then COPYWRITER, DESIGNER e IMAGER devem iniciar simultaneamente
    And CODER deve iniciar apenas após os três terminarem

Feature: Ciclo completo de entrega
  Scenario: Site entregue com tutorial e PDF
    Given QA aprovado em projeto
    When Delivery Agent processa
    Then tutorial HeyGen deve ser gerado
    And PDF de entrega com credenciais deve ser gerado
    And cliente recebe WhatsApp + E-mail simultaneamente
    And follow-up agendado para 7 dias
```

### Testes de Segurança

```typescript
// Todos obrigatórios — CI bloqueia se falharem

// Auth anti-timing
it("timing similar para e-mail inexistente e senha errada", async () => {
  const t1 = Date.now();
  await login("noexist@test.com", "wrong");
  const d1 = Date.now() - t1;
  const t2 = Date.now();
  await login("real@test.com", "wrong");
  const d2 = Date.now() - t2;
  expect(Math.abs(d1 - d2)).toBeLessThan(200);
});

// Magic bytes em imagens geradas por IA
it("deve rejeitar imagem IA com magic bytes de EXE", async () => {
  const fakeImage = Buffer.from("MZ...", "binary");
  const res = await request
    .post("/api/v1/media/validate")
    .attach("file", fakeImage, {
      filename: "hero.jpg",
      contentType: "image/jpeg",
    });
  expect(res.status).toBe(400);
  expect(res.body.errors[0].code).toBe("INVALID_FILE_TYPE");
});

// SSRF
it("deve bloquear URL localhost no Maps config", async () => {
  const res = await request
    .post("/api/v1/prospecting/search-maps")
    .send({ endpoint: "http://localhost:8080/internal" });
  expect(res.status).toBe(400);
});

// HITL obrigatório
it("deve bloquear mensagem externa sem HITL", async () => {
  const res = await request
    .post("/api/v1/agents/:id/execute")
    .send({ task: "SEND_WHATSAPP", to: "+5511999999999", message: "Olá!" });
  expect(res.status).toBe(403);
  expect(res.body.errors[0].code).toBe("HITL_REQUIRED");
});
```

### Cobertura Mínima

```yaml
coverage:
  statements: 80%
  branches: 75%
  functions: 80%
  lines: 80%
  security_tests: 100% # CI bloqueia qualquer falha de segurança
```

---

## 21. Observabilidade e Escalabilidade

### Logs Estruturados (JSON)

```typescript
interface StructuredLog {
  level: "debug" | "info" | "warn" | "error" | "fatal";
  timestamp: string; // ISO 8601
  service: string;
  traceId: string;
  spanId: string;
  correlationId: string;
  agentId?: string;
  subAgentId?: string; // v2
  action?: string;
  duration_ms?: number;
  cost_usd?: number; // v2: custo do token usage
  provider?: string; // v2: qual LLM foi usado
  message: string;
  error?: { message: string; stack?: string; code?: string };
  // Sem PII (email, telefone, mensagens brutas)
}
```

### Métricas Prometheus

```
# Agentes
agent_tasks_total{agent_id, persona, status}
agent_task_duration_seconds{agent_id, task_type}
agent_token_usage_total{agent_id, sub_agent_id, provider}
agent_token_cost_usd_total{agent_id, provider, model}
agent_llm_errors_total{agent_id, error_type}
sub_agent_parallel_executions_total{agent_id, group}

# Media Generation (v2)
media_generation_total{provider, asset_type, status}
media_generation_duration_seconds{provider}
media_generation_cost_usd_total{provider}

# Prospecting (v2)
leads_from_maps_total{category, city}
leads_cnpj_validated_total{status}

# HITL
hitl_approvals_pending{operator_id, notify_channel}
hitl_decision_time_seconds{decision}
hitl_timeout_total

# Pipeline
leads_created_total{source}
deals_closed_total{service_type}
deals_closed_value_total_brl
projects_delivered_total
project_delivery_time_hours

# API
http_requests_total{method, route, status}
http_request_duration_seconds{method, route}
```

### 6 Dashboards Grafana Obrigatórios

1. **Pipeline**: funil lead→site entregue, taxa de conversão por etapa
2. **Agent Performance**: tokens, tarefas, latência por sub-agente e provider
3. **Cost Dashboard** (v2): custo/site, custo/agente, custo/provider, projeção mensal
4. **HITL**: pendentes, tempo médio, taxa rejeição por tipo de ação
5. **Security**: login bloqueado, erros 4xx/5xx, rate limit hits, uploads rejeitados
6. **Quality** (v2): Lighthouse scores médios, taxa reprovação QA, ciclos de correção

### Alertas Críticos

```yaml
alerts:
  - {
      name: HITLQueueBacklog,
      condition: "hitl_approvals_pending > 10",
      severity: warning,
      notify: telegram,
    }
  - {
      name: AgentHighErrorRate,
      condition: "rate(agent_llm_errors_total[5m]) > 0.1",
      severity: critical,
      notify: email,
    }
  - {
      name: CostThresholdExceeded,
      condition: "agent_token_cost_usd_total > 50",
      severity: warning,
      notify: telegram,
    }
  - {
      name: MediaGenFailed,
      condition: "rate(media_generation_total{status=failed}[5m]) > 0.2",
      severity: warning,
      notify: email,
    }
  - {
      name: MapsQuotaLow,
      condition: "maps_requests_remaining < 200",
      severity: warning,
      notify: telegram,
    }
  - {
      name: SecurityBruteForce,
      condition: "rate(auth_failed_attempts[1m]) > 10",
      severity: critical,
      notify: [email, telegram],
    }
```

---

## 22. Stack Tecnológica

### Backend

| Componente    | Tecnologia            | Justificativa                                 |
| ------------- | --------------------- | --------------------------------------------- |
| Runtime       | Node.js 22 LTS        | TypeScript nativo, ecosystem excelente        |
| Framework API | Fastify 5             | Performance superior ao Express, schema-first |
| ORM           | Drizzle ORM           | Type-safe, sem overhead                       |
| Validação     | Zod                   | Type inference + runtime validation           |
| Queue         | BullMQ + Redis        | Sub-agentes assíncronos em paralelo           |
| Auth          | jose (JWT RS256)      | RFC-compliant                                 |
| Crypto        | argon2 (node binding) | Argon2id nativo                               |
| Testes        | Vitest + Supertest    | Rápido, TypeScript                            |
| E2E           | Playwright            | Testcontainers para deps isoladas             |
| DI            | tsyringe              | Dependency Injection                          |

### Frontend

| Componente    | Tecnologia              | Justificativa                       |
| ------------- | ----------------------- | ----------------------------------- |
| Framework     | Next.js 15 (App Router) | SSR/SSG, TypeScript                 |
| UI Components | shadcn/ui               | Sem vendor lock, acessível          |
| Styling       | Tailwind CSS 4          | Utility-first, performance          |
| State         | Zustand                 | Simples, sem Redux boilerplate      |
| Forms         | React Hook Form + Zod   | Validação compartilhada com backend |
| Fetching      | TanStack Query          | Cache, refetch, optimistic          |

### Agent Orchestration (Python)

| Componente  | Tecnologia                        | Justificativa                               |
| ----------- | --------------------------------- | ------------------------------------------- |
| Framework   | CrewAI (Python 3.12)              | Multi-agent, sub-agents, parallelism nativo |
| LLM Routing | LiteLLM                           | Abstração única: OpenAI/Anthropic/Gemini    |
| RAG         | LangChain + ChromaDB              | Conectores prontos, maturidade              |
| Embeddings  | Ollama nomic-embed-text           | Gratuito, local                             |
| Tracing     | LangSmith (free) ou Phoenix Arize | Observabilidade de LLM calls                |
| HTTP        | httpx (async)                     | Cliente assíncrono                          |
| Scheduling  | APScheduler                       | Cron jobs para DEAL_TRACKER                 |

### Infraestrutura

| Componente      | Tecnologia                                | Custo               |
| --------------- | ----------------------------------------- | ------------------- |
| Database        | PostgreSQL 16 (Supabase free/self-hosted) | Grátis              |
| Vetorial (RAG)  | ChromaDB (Docker)                         | Grátis              |
| Queue/Cache     | Redis 7 (Docker)                          | Grátis              |
| LLM Local       | Ollama + Llama 3.2 3B + CodeLlama + LLaVA | Grátis              |
| Workflow        | n8n (Docker)                              | Grátis              |
| Secrets         | Infisical (self-hosted)                   | Grátis              |
| Hospedagem API  | Hetzner VPS / Railway                     | ~$5/mês             |
| Observabilidade | Prometheus + Grafana + Jaeger             | Grátis              |
| Deploy Sites    | Vercel + Cloudflare Pages + Render        | Grátis              |
| WhatsApp        | Evolution API (Docker)                    | Grátis              |
| Telegram        | Bot API (2 bots)                          | Grátis              |
| Busca RAG       | SearXNG (Docker)                          | Grátis              |
| Prospecção      | Google Maps Places API                    | Grátis até 2.5k/dia |
| Dados BR        | MCP Brasil (Docker)                       | Grátis              |
| Agendamento     | Cal.com (Docker)                          | Grátis              |
| Imagens IA      | Nano Banana Pro (Gemini Image)            | ~$0.04/img          |
| LLM Sonnet      | Claude Sonnet 4.6 (Anthropic)             | ~$0.015/1k          |
| LLM Opus        | Claude Opus 4.8 / 4.7 (Anthropic)         | ~$0.025/1k          |
| Gemini Flash    | Gemini 3.5 Flash                          | ~$0.01/1k           |
| Tutorial Vídeo  | HeyGen API                                | ~$0.50/vídeo        |
| CI/CD           | GitHub Actions                            | Grátis              |

---

## 23. Estrutura de Diretórios

```
hefesto/
├── .github/workflows/
│   ├── ci.yml                  # Lint, test, build
│   ├── security.yml            # OWASP ZAP, Snyk
│   └── deploy.yml
│
├── apps/
│   ├── api/                    # Fastify Backend
│   │   └── src/
│   │       ├── domain/
│   │       │   ├── agent/
│   │       │   │   ├── Agent.ts
│   │       │   │   ├── SubAgent.ts             # v2
│   │       │   │   ├── AgentId.ts
│   │       │   │   ├── LLMConfiguration.ts
│   │       │   │   ├── AgentRepository.ts
│   │       │   │   └── events/
│   │       │   │       ├── AgentActivated.ts
│   │       │   │       ├── SubAgentDispatched.ts  # v2
│   │       │   │       └── SubAgentCompleted.ts   # v2
│   │       │   ├── lead/
│   │       │   │   ├── Lead.ts
│   │       │   │   ├── EnrichmentData.ts          # v2
│   │       │   │   ├── FollowUpSchedule.ts        # v2
│   │       │   │   └── events/
│   │       │   │       ├── LeadEnriched.ts        # v2
│   │       │   │       ├── FollowUpScheduled.ts   # v2
│   │       │   │       └── FollowUpSent.ts        # v2
│   │       │   ├── deal/
│   │       │   ├── briefing/                      # v2: novo BC
│   │       │   │   ├── Briefing.ts
│   │       │   │   ├── ClientBriefingDTO.ts
│   │       │   │   ├── BriefingRepository.ts
│   │       │   │   └── events/
│   │       │   │       ├── BriefingStarted.ts
│   │       │   │       ├── BriefingCompleted.ts
│   │       │   │       └── BriefingApproved.ts
│   │       │   ├── project/
│   │       │   │   ├── Project.ts
│   │       │   │   ├── GeneratedAsset.ts          # v2
│   │       │   │   └── events/
│   │       │   │       ├── MockupGenerated.ts     # v2
│   │       │   │       ├── MockupApproved.ts      # v2
│   │       │   │       └── AssetGenerated.ts      # v2
│   │       │   ├── media/                         # v2: novo BC
│   │       │   │   ├── MediaGenerationPort.ts
│   │       │   │   └── ImagePrompt.ts
│   │       │   ├── scheduling/                    # v2
│   │       │   │   ├── SchedulingPort.ts
│   │       │   │   └── BookingLink.ts
│   │       │   ├── hitl/
│   │       │   └── shared/
│   │       │       ├── DomainEvent.ts
│   │       │       ├── AggregateRoot.ts
│   │       │       └── Result.ts
│   │       │
│   │       ├── application/
│   │       │   ├── agent/     (commands + queries)
│   │       │   ├── lead/
│   │       │   ├── deal/
│   │       │   ├── briefing/                      # v2
│   │       │   ├── project/
│   │       │   ├── media/                         # v2
│   │       │   ├── scheduling/                    # v2
│   │       │   └── hitl/
│   │       │
│   │       ├── infrastructure/
│   │       │   ├── db/
│   │       │   │   ├── schema.ts
│   │       │   │   ├── migrations/
│   │       │   │   └── repositories/
│   │       │   ├── llm/
│   │       │   │   ├── LLMRouter.ts
│   │       │   │   ├── OllamaAdapter.ts
│   │       │   │   ├── OpenAIAdapter.ts
│   │       │   │   ├── AnthropicAdapter.ts        # v2
│   │       │   │   └── GeminiAdapter.ts           # v2
│   │       │   ├── media/                         # v2
│   │       │   │   ├── MediaGenerationRouter.ts
│   │       │   │   ├── NanaBananaAdapter.ts
│   │       │   │   ├── DalleAdapter.ts
│   │       │   │   └── OllamaVisionAdapter.ts
│   │       │   ├── design/                        # v2
│   │       │   │   └── ClaudeDesignAdapter.ts
│   │       │   ├── maps/                          # v2
│   │       │   │   └── GoogleMapsAdapter.ts
│   │       │   ├── mcp/                           # v2
│   │       │   │   └── MCPBrasilAdapter.ts
│   │       │   ├── scheduling/                    # v2
│   │       │   │   └── CalComAdapter.ts
│   │       │   ├── rag/
│   │       │   │   └── ChromaDBAdapter.ts
│   │       │   ├── messaging/
│   │       │   │   ├── WhatsAppAdapter.ts
│   │       │   │   ├── TelegramAdapter.ts         # v2: canal de vendas
│   │       │   │   ├── TelegramHITLBot.ts         # v2: bot HITL
│   │       │   │   ├── EmailAdapter.ts
│   │       │   │   └── MessagingRouter.ts         # v2
│   │       │   ├── deploy/                        # v2: multi-platform
│   │       │   │   ├── DeployRouter.ts
│   │       │   │   ├── VercelAdapter.ts
│   │       │   │   ├── CloudflarePagesAdapter.ts  # v2
│   │       │   │   ├── RenderAdapter.ts           # v2
│   │       │   │   ├── HostingerAdapter.ts        # v2
│   │       │   │   └── NetlifyAdapter.ts
│   │       │   ├── video/                         # v2
│   │       │   │   └── HeyGenAdapter.ts
│   │       │   ├── queue/
│   │       │   │   └── BullMQAdapter.ts
│   │       │   └── secrets/
│   │       │       └── InfisicalAdapter.ts
│   │       │
│   │       ├── http/
│   │       │   ├── routes/
│   │       │   │   ├── auth.routes.ts
│   │       │   │   ├── agents.routes.ts
│   │       │   │   ├── sub-agents.routes.ts       # v2
│   │       │   │   ├── leads.routes.ts
│   │       │   │   ├── deals.routes.ts
│   │       │   │   ├── briefings.routes.ts        # v2
│   │       │   │   ├── projects.routes.ts
│   │       │   │   ├── media.routes.ts            # v2
│   │       │   │   ├── prospecting.routes.ts      # v2
│   │       │   │   ├── scheduling.routes.ts       # v2
│   │       │   │   ├── costs.routes.ts            # v2
│   │       │   │   └── hitl.routes.ts
│   │       │   ├── middleware/
│   │       │   │   ├── auth.middleware.ts
│   │       │   │   ├── rateLimiter.middleware.ts
│   │       │   │   ├── bodySize.middleware.ts
│   │       │   │   └── requestId.middleware.ts
│   │       │   └── schemas/
│   │       │
│   │       └── container.ts
│   │
│   ├── web/                    # Next.js Frontend
│   │   └── src/app/
│   │       ├── (auth)/login/
│   │       └── (dashboard)/
│   │           ├── agents/[id]/sub-agents/        # v2
│   │           ├── leads/
│   │           ├── deals/
│   │           ├── briefings/                     # v2
│   │           ├── projects/[id]/mockup/          # v2
│   │           ├── prospecting/                   # v2
│   │           ├── costs/                         # v2
│   │           └── hitl/
│   │
│   └── agent-runtime/          # Python — CrewAI
│       └── src/
│           ├── agents/
│           │   ├── orchestrator/orchestrator_agent.py
│           │   ├── hunter/
│           │   │   ├── hunter_agent.py
│           │   │   └── sub_agents/
│           │   │       ├── prospector.py
│           │   │       ├── site_inspector.py
│           │   │       └── data_enricher.py
│           │   ├── closer/
│           │   │   ├── closer_agent.py
│           │   │   └── sub_agents/
│           │   │       ├── outreach_writer.py
│           │   │       ├── conv_handler.py
│           │   │       ├── proposal_writer.py
│           │   │       └── deal_tracker.py
│           │   ├── briefing/                      # v2
│           │   │   ├── briefing_agent.py
│           │   │   └── sub_agents/
│           │   │       ├── interviewer.py
│           │   │       └── brief_extractor.py
│           │   ├── builder/
│           │   │   ├── builder_agent.py
│           │   │   └── sub_agents/
│           │   │       ├── copywriter.py
│           │   │       ├── designer.py            # v2: Claude Design
│           │   │       ├── imager.py              # v2: Nano Banana Pro
│           │   │       ├── coder.py
│           │   │       ├── seo_optimizer.py
│           │   │       └── deployer.py
│           │   ├── qa/
│           │   │   ├── qa_agent.py
│           │   │   └── sub_agents/
│           │   │       ├── sec_auditor.py
│           │   │       ├── perf_auditor.py
│           │   │       └── content_check.py
│           │   └── delivery/                      # v2
│           │       ├── delivery_agent.py
│           │       └── sub_agents/
│           │           ├── tutorial_generator.py
│           │           ├── doc_generator.py
│           │           └── notifier.py
│           ├── config/
│           │   ├── llm_routing.py
│           │   └── models.py
│           ├── skills/
│           │   ├── web_search.py
│           │   ├── scraping.py
│           │   ├── google_maps.py                 # v2
│           │   ├── mcp_brasil.py                  # v2
│           │   ├── whatsapp.py
│           │   ├── telegram.py                    # v2
│           │   ├── email_sender.py
│           │   ├── image_gen.py                   # v2
│           │   ├── design_gen.py                  # v2
│           │   ├── deploy.py
│           │   ├── cal_com.py                     # v2
│           │   └── heygen.py                      # v2
│           ├── rag/
│           └── workflows/
│
├── packages/
│   ├── shared-types/
│   │   └── src/
│   │       ├── agents.types.ts
│   │       ├── briefing.types.ts                  # v2
│   │       ├── media.types.ts                     # v2
│   │       └── events.types.ts
│   └── ui/
│
├── infra/
│   ├── docker-compose.yml
│   │   # Serviços: postgres, redis, chromadb, n8n, infisical,
│   │   #   ollama, searxng, evolution-api, cal-com, mcp-brasil
│   ├── docker-compose.prod.yml
│   └── scripts/
│       ├── setup.sh
│       └── seed.sh
│
├── docs/
│   ├── architecture/
│   │   ├── agent-topology.md
│   │   ├── llm-routing.md
│   │   └── media-generation.md
│   ├── api/
│   └── runbooks/
│       ├── whatsapp-ban-recovery.md
│       ├── maps-quota-exceeded.md               # v2
│       ├── llm-provider-fallback.md
│       └── nano-banana-pro-fallback.md          # v2
│
├── .env.example
├── .gitignore
└── README.md
```

---

## 24. Gestão de Segredos e Configuração

### .env.example (v2 — completo)

```bash
# Infisical (prod)
INFISICAL_TOKEN=
INFISICAL_PROJECT_ID=

# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/hefesto

# Ollama (local — Tier 0, grátis)
OLLAMA_BASE_URL=http://localhost:11434

# WhatsApp
EVOLUTION_API_URL=http://localhost:8080
EVOLUTION_API_KEY=
WPP_INSTANCE=hefesto_prod

# Telegram (dois bots)
TELEGRAM_HITL_BOT_TOKEN=          # Bot 1: aprovações HITL inline
TELEGRAM_SALES_BOT_TOKEN=         # Bot 2: canal de vendas com leads
TELEGRAM_OPERATOR_CHAT_ID=        # Chat ID do operador

# n8n
N8N_BASE_URL=http://localhost:5678
N8N_API_KEY=

# Cal.com (self-hosted)
CAL_BASE_URL=http://cal-com:3000
CAL_API_KEY=

# Google Maps Places API
GOOGLE_MAPS_API_KEY=              # Grátis até 2500 req/dia

# HeyGen
HEYGEN_API_KEY=
HEYGEN_AVATAR_ID=                 # Avatar configurado pelo operador

# LLM APIs
ANTHROPIC_API_KEY=                # Opus 4.8, Opus 4.7, Sonnet 4.6, Haiku 4.5
OPENAI_API_KEY=                   # DALL-E 3 (fallback imagens)
GEMINI_API_KEY=                   # Nano Banana Pro + Gemini 3.1 Pro + 3.5 Flash
GROQ_API_KEY=                     # Llama 3.3 70B (velocidade)

# Deploy
VERCEL_TOKEN=
CLOUDFLARE_PAGES_TOKEN=           # v2
RENDER_API_KEY=                   # v2
HOSTINGER_API_KEY=                # v2

# E-mail
BREVO_API_KEY=                    # 300 e-mails/dia grátis

# MCP Brasil
MCP_BRASIL_URL=http://mcp-brasil:8000
TRANSPARENCIA_API_KEY=            # Opcional

# App
NODE_ENV=development
API_PORT=3001
FRONTEND_URL=http://localhost:3000
OPERATOR_NAME=
OPERATOR_EMAIL=
```

---

## 25. Roadmap e Fases

### Fase 0 — Fundação (Semanas 1–2)

- [ ] Setup monorepo (Turborepo)
- [ ] Docker Compose: postgres, redis, chromadb, n8n, ollama, evolution-api, searxng, cal-com, mcp-brasil
- [ ] Schema v2 + migrations
- [ ] Auth (login/logout/refresh + Telegram HITL chat_id)
- [ ] CRUD agentes + sub-agentes
- [ ] CI/CD (GitHub Actions)
- [ ] Testes de segurança base

### Fase 1 — MVP v0: Ciclo de Vendas (Semanas 3–6)

- [ ] Hunter: PROSPECTOR (Google Maps) + SITE_INSPECTOR + DATA_ENRICHER (MCP Brasil)
- [ ] Sistema de qualificação com enrichmentData
- [ ] Closer: OUTREACH_WRITER + CONV_HANDLER + PROPOSAL_WRITER + DEAL_TRACKER
- [ ] HITL completo (Telegram inline + e-mail fallback)
- [ ] CRM com funil visual
- [ ] WhatsApp (Evolution API) + Telegram (Bot 2 vendas)
- [ ] RAG por agente (ChromaDB)
- [ ] Follow-up automático com cadência configurável

### Fase 2 — MVP v1: Entrega Completa (Semanas 7–13)

- [ ] Briefing: INTERVIEWER (roteiro por nicho) + BRIEF_EXTRACTOR
- [ ] Cal.com (agendamento de briefing)
- [ ] MediaGenerationService: NanaBananaPro + DALL-E fallback + Ollama dev
- [ ] ClaudeDesignAdapter (Claude Design via Opus 4.7)
- [ ] Builder: COPYWRITER + DESIGNER + IMAGER (paralelo) + CODER + SEO + DEPLOYER
- [ ] Deploy multi-platform: Vercel + Cloudflare Pages + Render + Hostinger
- [ ] QA: SEC_AUDITOR + PERF_AUDITOR + CONTENT_CHECK (paralelo)
- [ ] Delivery: TUTORIAL_GENERATOR (HeyGen) + DOC_GENERATOR + NOTIFIER
- [ ] Testes E2E fluxo completo

### Fase 3 — Qualidade e Polimento (Semanas 14–17)

- [ ] 6 Dashboards Grafana completos (incluindo Cost Dashboard)
- [ ] Fine-tuning de system prompts por nicho via RAG
- [ ] Runbooks: WhatsApp ban, Maps quota, LLM fallback, NanaBanana fallback
- [ ] Auditoria de segurança interna
- [ ] Documentação do operador

### Fase 4+ — Expansão (v2)

- [ ] Agente de tráfego pago
- [ ] Agente de social media
- [ ] Gateway de pagamento (Stripe + Mercado Pago)
- [ ] Multi-tenant
- [ ] Marketplace de templates

---

## 26. Riscos e Mitigações

| Risco                                           | Prob. | Impacto | Mitigação                                                                 |
| ----------------------------------------------- | ----- | ------- | ------------------------------------------------------------------------- |
| Agente envia mensagem inadequada                | Média | Alto    | HITL obrigatório antes de todo contato externo                            |
| LGPD: armazenamento de dados de leads           | Média | Alto    | Minimização; vault para transcrições; consentimento no 1º contato         |
| LLM gera código com vulnerabilidades            | Alta  | Alto    | SEC_AUDITOR (OWASP) antes de qualquer deploy                              |
| Custo de tokens além do planejado               | Média | Médio   | Budget por agente; bloqueio automático; Ollama local para tarefas simples |
| WhatsApp bane o número                          | Alta  | Alto    | Rate limit; delay humanizado; max 50 msg/dia; fallback Telegram + e-mail  |
| Quebra de contrato da Evolution API             | Média | Alto    | Adapter isolado; Baileys como fallback                                    |
| Google Maps quota excedida (2500/dia free)      | Baixa | Médio   | Cache 24h; alerta em 200 req restantes; upgrade $200/mês se necessário    |
| Nano Banana Pro falha ou sai do ar              | Baixa | Médio   | Fallback automático: DALL-E 3 → Ollama via MediaGenerationRouter          |
| SynthID watermark visível nas imagens           | Baixa | Baixo   | Documentar para cliente; Gemini Ultra remove marca d'água                 |
| Complexidade polyglot Node.js + Python          | Alta  | Médio   | Contratos HTTP claros; considerar LangChain.js se crescer demais          |
| Timeout HITL com operador offline               | Média | Médio   | Botões Telegram inline; fallback e-mail; timeout configurável             |
| MCP Brasil sem manutenção (projeto comunitário) | Baixa | Baixo   | Monitorar repo; contribuir se necessário; fallback manual de CNPJ         |
| Rate limit Cal.com API                          | Baixa | Baixo   | Self-hosted: sem limite de API                                            |
| Claude Design em research preview               | Baixa | Médio   | Fallback GPT-4o Vision para mockup; runbook documentado                   |
| Vibe coding gerar dívida técnica                | Alta  | Médio   | PRD detalhado; GSD; TDD obrigatório; CI bloqueia cobertura < 80%          |

---

## 27. Glossário

| Termo                 | Definição                                                                                           |
| --------------------- | --------------------------------------------------------------------------------------------------- |
| HITL                  | Human-in-the-Loop: aprovação humana obrigatória antes de ações externas                             |
| Persona               | Papel funcional fixo: HUNTER, CLOSER, BRIEFING, BUILDER, QA, DELIVERY, ORCHESTRATOR                 |
| Sub-agente            | Especialista vinculado a um agente primário, com LLM e contexto próprios, foco em tarefa específica |
| Parallel Group        | Grupo de sub-agentes que executam simultaneamente sem dependência entre si                          |
| Skill                 | Ferramenta/capacidade configurada num agente ou sub-agente                                          |
| Rule                  | Condição CEL + ação avaliada em runtime antes de executar uma tarefa                                |
| RAG                   | Retrieval-Augmented Generation: enriquecer prompts com documentos relevantes via ChromaDB           |
| ACL                   | Anti-Corruption Layer: isola domínio de SDKs e APIs externas via adapter                            |
| CQRS                  | Command Query Responsibility Segregation: separação de leitura e escrita                            |
| Aggregate             | Cluster de entidades de domínio tratadas como unidade transacional                                  |
| Bounded Context       | Limite de responsabilidade de um subdomínio no DDD                                                  |
| GSD                   | Get Shit Done: metodologia iterativa de desenvolvimento focado em entrega                           |
| Magic Bytes           | Assinatura binária nos primeiros bytes de arquivo que identifica seu tipo real                      |
| SSRF                  | Server-Side Request Forgery: ataque que força requisições internas via servidor                     |
| Argon2id              | Algoritmo de hashing de senhas resistente a GPU e ataques de memória                                |
| ULID                  | Universally Unique Lexicographically Sortable Identifier: UUID com ordenação temporal               |
| LiteLLM               | Biblioteca Python que abstrai múltiplos providers de LLM com interface unificada                    |
| CrewAI                | Framework Python para orquestração de agentes com suporte a paralelismo via async_execution         |
| Nano Banana Pro       | Modelo Google (base Gemini 3 Pro Image) para geração de imagens 2K/4K via API Gemini                |
| Claude Design         | Produto Anthropic (Opus 4.7) para geração de mockups, wireframes e designs interativos              |
| Evolution API         | API self-hosted para integração com WhatsApp Web                                                    |
| SynthID               | Marca d'água digital da Google em imagens geradas pelo Nano Banana Pro                              |
| MCP Brasil            | MCP Server open-source: 533 tools para 70 fontes de dados públicos brasileiros, 66 sem chave de API |
| Cal.com               | Plataforma open-source de agendamento, self-hostable, gratuita                                      |
| Cloudflare Pages      | Deploy estático: gratuito, CDN edge global em 200+ cidades, sem spin-down                           |
| Render                | Plataforma de deploy: static sites gratuitos, alternativa ao Netlify                                |
| EnrichmentData        | Dados coletados pelo DATA_ENRICHER: CNPJ, Google Maps, CEP, anos no mercado                         |
| ClientBriefingDTO     | JSON estruturado com todos os requisitos do site, gerado pelo BRIEF_EXTRACTOR                       |
| HeyGen                | Plataforma de vídeos com avatar IA, usada pelo TUTORIAL_GENERATOR para tutoriais personalizados     |
| Deal Tracker          | Sub-agente do Closer que monitora negociações e dispara follow-ups por cadência configurável        |
| Token Budget          | Limite configurável de tokens por agente, com bloqueio automático ao esgotar                        |
| Polyglot File         | Arquivo válido em dois formatos simultaneamente, usado em ataques de upload                         |
| MediaGenerationRouter | ACL com fallback chain: NanaBanana → DALL-E → Ollama, garante disponibilidade do serviço            |

---

_Versão 2.0.0 — Última atualização: 2026-05-29_
_Incorpora decisões do ciclo de refinamento arquitetural: Briefing Agent, Delivery Agent, 17 sub-agentes, LLM routing por custo, Claude Design, Nano Banana Pro, Google Maps, MCP Brasil, Telegram dual-bot, Cal.com, Cloudflare Pages + Render + Hostinger, HeyGen, MediaGenerationService, paralelismo de sub-agentes._

**Próximos passos:**

1. Revisão e aprovação do PRD v2 pelos stakeholders
2. Atualizar Issues do GitHub com novos requisitos v2
3. Setup monorepo com estrutura de diretórios v2 (Fase 0, Semana 1)
4. Configurar Docker Compose com todos os serviços (postgres, redis, chromadb, n8n, ollama, evolution-api, searxng, cal-com, mcp-brasil)
5. Primeira sprint GSD: Fundação + Autenticação + Hunter básico (Google Maps + MCP Brasil)

---

## 28. Detalhamento dos Workflows n8n por Agente

O n8n Ã© o orquestrador de workflows que conecta os eventos de domÃ­nio aos agentes Python (CrewAI). Cada workflow Ã© versionado, testÃ¡vel e auditÃ¡vel.

### 28.1 Workflow: Hunter â ProspecÃ§Ã£o DiÃ¡ria

```json
{
  "name": "Hunter â ProspecÃ§Ã£o DiÃ¡ria via Google Maps",
  "version": "2.0.0",
  "trigger": {
    "type": "Schedule",
    "cron": "0 9 * * 1-5",
    "timezone": "America/Sao_Paulo"
  },
  "nodes": [
    {
      "id": "load_config",
      "type": "HTTP Request",
      "url": "{{$env.API_URL}}/api/v1/prospecting/config",
      "method": "GET",
      "headers": { "Authorization": "Bearer {{$env.API_TOKEN}}" }
    },
    {
      "id": "check_maps_quota",
      "type": "Code",
      "code": "const remaining = $input.json.mapsQuotaRemaining; if (remaining < 100) throw new Error('Maps quota crÃ­tico: ' + remaining + ' reqs restantes'); return $input.all();"
    },
    {
      "id": "trigger_hunter_agent",
      "type": "HTTP Request",
      "url": "{{$env.AGENT_RUNTIME_URL}}/agents/hunter/run",
      "method": "POST",
      "body": {
        "categories": "{{$node.load_config.json.categories}}",
        "region": "{{$node.load_config.json.region}}",
        "min_score": "{{$node.load_config.json.minScore}}"
      }
    },
    {
      "id": "wait_for_completion",
      "type": "Wait",
      "event": "webhook",
      "webhook_path": "/n8n/hunter/completed"
    },
    {
      "id": "process_results",
      "type": "Code",
      "code": "const leads = $input.json.leads; const qualified = leads.filter(l => l.score >= $node.load_config.json.minScore); return { qualified, total: leads.length, qualifiedCount: qualified.length };"
    },
    {
      "id": "create_hitl_request",
      "type": "HTTP Request",
      "url": "{{$env.API_URL}}/api/v1/hitl",
      "method": "POST",
      "body": {
        "actionType": "APPROVE_LEAD_LIST",
        "contextType": "LEAD_BATCH",
        "payloadPreview": "{{$node.process_results.json}}",
        "notifyChannel": "telegram"
      }
    },
    {
      "id": "notify_telegram",
      "type": "Telegram",
      "chatId": "{{$env.TELEGRAM_OPERATOR_CHAT_ID}}",
      "text": "ð¯ Hunter encontrou {{$node.process_results.json.qualifiedCount}} leads qualificados de {{$node.process_results.json.total}} encontrados.\nRevise e aprove no painel."
    }
  ]
}
```

### 28.2 Workflow: Closer â Loop de NegociaÃ§Ã£o

```json
{
  "name": "Closer â Loop de NegociaÃ§Ã£o com Follow-up",
  "version": "2.0.0",
  "trigger": {
    "type": "DomainEvent",
    "event": "LeadApprovedForContact"
  },
  "nodes": [
    {
      "id": "load_lead",
      "type": "HTTP Request",
      "url": "{{$env.API_URL}}/api/v1/leads/{{$trigger.json.leadId}}"
    },
    {
      "id": "generate_outreach",
      "type": "HTTP Request",
      "url": "{{$env.AGENT_RUNTIME_URL}}/agents/closer/sub-agents/outreach_writer/run",
      "body": {
        "lead": "{{$node.load_lead.json}}",
        "enrichmentData": "{{$node.load_lead.json.enrichmentData}}"
      }
    },
    {
      "id": "create_hitl_message",
      "type": "HTTP Request",
      "url": "{{$env.API_URL}}/api/v1/hitl",
      "method": "POST",
      "body": {
        "actionType": "SEND_EXTERNAL_MESSAGE",
        "contextType": "LEAD",
        "contextId": "{{$node.load_lead.json.id}}",
        "payloadPreview": {
          "to": "{{$node.load_lead.json.contactPhone}}",
          "channel": "{{$node.load_lead.json.preferredChannel}}",
          "message_preview": "{{$node.generate_outreach.json.message.substring(0,200)}}..."
        }
      }
    },
    {
      "id": "wait_hitl_decision",
      "type": "Wait",
      "event": "webhook",
      "webhook_path": "/n8n/hitl/decided/{{$node.create_hitl_message.json.id}}"
    },
    {
      "id": "route_hitl_decision",
      "type": "Switch",
      "value": "{{$node.wait_hitl_decision.json.decision}}",
      "cases": [
        { "case": "APPROVED", "next": "send_message" },
        { "case": "REJECTED", "next": "log_rejection" },
        { "case": "EDITED_APPROVED", "next": "send_edited_message" }
      ]
    },
    {
      "id": "send_message",
      "type": "HTTP Request",
      "url": "{{$env.AGENT_RUNTIME_URL}}/messaging/send",
      "body": {
        "to": "{{$node.load_lead.json.contactPhone}}",
        "channel": "{{$node.load_lead.json.preferredChannel}}",
        "message": "{{$node.generate_outreach.json.message}}"
      }
    },
    {
      "id": "schedule_followup",
      "type": "HTTP Request",
      "url": "{{$env.API_URL}}/api/v1/leads/{{$node.load_lead.json.id}}/follow-ups",
      "method": "POST",
      "body": { "cadenceDays": [3, 7, 14], "maxAttempts": 3 }
    }
  ]
}
```

### 28.3 Workflow: Builder â CriaÃ§Ã£o Paralela

```json
{
  "name": "Builder â CriaÃ§Ã£o Paralela com Mockup HITL",
  "version": "2.0.0",
  "trigger": {
    "type": "DomainEvent",
    "event": "BriefingApproved"
  },
  "nodes": [
    {
      "id": "load_briefing",
      "type": "HTTP Request",
      "url": "{{$env.API_URL}}/api/v1/briefings/{{$trigger.json.briefingId}}"
    },
    {
      "id": "select_template",
      "type": "HTTP Request",
      "url": "{{$env.AGENT_RUNTIME_URL}}/agents/builder/sub-agents/template_selector/run",
      "body": { "briefing": "{{$node.load_briefing.json}}" }
    },
    {
      "id": "parallel_group_1",
      "type": "Execute Workflows",
      "mode": "parallel",
      "workflows": [
        {
          "id": "run_copywriter",
          "url": "{{$env.AGENT_RUNTIME_URL}}/agents/builder/sub-agents/copywriter/run"
        },
        {
          "id": "run_designer",
          "url": "{{$env.AGENT_RUNTIME_URL}}/agents/builder/sub-agents/designer/run"
        },
        {
          "id": "run_imager",
          "url": "{{$env.AGENT_RUNTIME_URL}}/agents/builder/sub-agents/imager/run"
        }
      ],
      "input": {
        "briefing": "{{$node.load_briefing.json}}",
        "template": "{{$node.select_template.json}}"
      }
    },
    {
      "id": "hitl_mockup",
      "type": "HTTP Request",
      "url": "{{$env.API_URL}}/api/v1/hitl",
      "method": "POST",
      "body": {
        "actionType": "APPROVE_MOCKUP",
        "contextType": "PROJECT",
        "payloadPreview": {
          "mockup_url": "{{$node.parallel_group_1.run_designer.json.mockupUrl}}"
        }
      }
    },
    {
      "id": "wait_mockup_hitl",
      "type": "Wait",
      "event": "webhook",
      "webhook_path": "/n8n/hitl/decided/{{$node.hitl_mockup.json.id}}"
    },
    {
      "id": "run_coder",
      "type": "HTTP Request",
      "url": "{{$env.AGENT_RUNTIME_URL}}/agents/builder/sub-agents/coder/run",
      "body": {
        "texts": "{{$node.parallel_group_1.run_copywriter.json}}",
        "mockup": "{{$node.parallel_group_1.run_designer.json}}",
        "images": "{{$node.parallel_group_1.run_imager.json}}",
        "template": "{{$node.select_template.json}}"
      }
    },
    {
      "id": "parallel_group_3",
      "type": "Execute Workflows",
      "mode": "parallel",
      "workflows": [
        {
          "id": "run_seo",
          "url": "{{$env.AGENT_RUNTIME_URL}}/agents/builder/sub-agents/seo_optimizer/run"
        },
        {
          "id": "run_deployer_staging",
          "url": "{{$env.AGENT_RUNTIME_URL}}/agents/builder/sub-agents/deployer/run"
        }
      ],
      "input": { "codeOutput": "{{$node.run_coder.json}}", "target": "staging" }
    },
    {
      "id": "hitl_staging_preview",
      "type": "HTTP Request",
      "url": "{{$env.API_URL}}/api/v1/hitl",
      "method": "POST",
      "body": {
        "actionType": "APPROVE_STAGING",
        "payloadPreview": {
          "staging_url": "{{$node.parallel_group_3.run_deployer_staging.json.stagingUrl}}"
        }
      }
    },
    {
      "id": "wait_staging_hitl",
      "type": "Wait",
      "event": "webhook",
      "webhook_path": "/n8n/hitl/decided/{{$node.hitl_staging_preview.json.id}}"
    },
    {
      "id": "deploy_production",
      "type": "HTTP Request",
      "url": "{{$env.AGENT_RUNTIME_URL}}/agents/builder/sub-agents/deployer/run",
      "body": {
        "codeOutput": "{{$node.run_coder.json}}",
        "target": "production"
      }
    },
    {
      "id": "emit_project_built",
      "type": "HTTP Request",
      "url": "{{$env.API_URL}}/api/v1/events",
      "method": "POST",
      "body": {
        "type": "ProjectBuilt",
        "projectId": "{{$trigger.json.projectId}}"
      }
    }
  ]
}
```

---

## 29. Detalhamento das Skills por Tipo

### 29.1 Skill Type: external_database (Google Maps)

```typescript
// infrastructure/skills/ExternalDatabaseSkill.ts

class ExternalDatabaseSkill implements Skill {
  readonly type = "external_database";

  async execute(
    config: ExternalDatabaseConfig,
    input: SkillInput,
  ): Promise<SkillOutput> {
    switch (config.provider) {
      case "google_maps":
        return this.executeGoogleMaps(config, input);
      case "mcp_brasil":
        return this.executeMCPBrasil(config, input);
      case "apollo_io":
        return this.executeApollo(config, input);
      default:
        throw new SkillError(`Provider desconhecido: ${config.provider}`);
    }
  }

  private async executeGoogleMaps(config: GoogleMapsConfig, input: SkillInput) {
    // Verificar quota antes de executar
    const quotaOk = await this.rateLimiter.check(
      "maps_daily",
      config.rate_limit_per_day,
    );
    if (!quotaOk)
      throw new QuotaExceededError("Google Maps quota diÃ¡ria excedida");

    // Verificar cache (TTL configurÃ¡vel)
    const cacheKey = `maps:${JSON.stringify(input.query)}`;
    const cached = await this.cache.get(cacheKey);
    if (cached) return JSON.parse(cached);

    // Executar busca
    const result = await this.mapsAdapter.searchLeads(input.query);

    // Cachear resultado
    await this.cache.set(
      cacheKey,
      JSON.stringify(result),
      config.cache_results_ttl_hours * 3600,
    );

    return result;
  }
}
```

### 29.2 Skill Type: design_gen (Claude Design)

```typescript
// infrastructure/skills/DesignGenSkill.ts

class DesignGenSkill implements Skill {
  readonly type = "design_gen";

  async execute(
    config: DesignGenConfig,
    input: SkillInput,
  ): Promise<SkillOutput> {
    // Claude Design via Opus 4.7 â nÃ£o Ã© endpoint separado,
    // Ã© o modelo Opus 4.7 com prompt especializado em design

    const designPrompt = this.buildDesignPrompt(input.briefing);

    const response = await this.llm.complete({
      model: "claude-opus-4-7",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: designPrompt,
            },
          ],
        },
      ],
      max_tokens: 4096,
    });

    // Extrair URL do mockup gerado (Claude Design retorna HTML/SVG)
    const mockupHtml = this.extractMockup(response.content);

    // Salvar em storage e retornar URL
    const mockupUrl = await this.storage.save(mockupHtml, "mockup.html");

    return { mockupUrl, rawDesign: mockupHtml };
  }

  private buildDesignPrompt(briefing: ClientBriefingDTO): string {
    return `Crie um mockup visual completo para um site profissional com as seguintes caracterÃ­sticas:

NEGÃCIO: ${briefing.businessName}
SEGMENTO: ${briefing.niche}
TIPO DE SITE: ${briefing.siteType}
PGINAS: ${briefing.pages.join(", ")}
CORES PREFERIDAS: ${briefing.colorPreferences.join(", ")}
ESTILO DE FONTE: ${briefing.fontStyle || "modern"}
DIFERENCIAIS: ${briefing.differentials.join(", ")}
PBLICO-ALVO: ${briefing.targetAudience}

Gere um mockup em HTML/CSS representando:
1. Header com logo placeholder e navegaÃ§Ã£o
2. Hero section com headline impactante e CTA
3. SeÃ§Ã£o de serviÃ§os/produtos (3 cards)
4. SeÃ§Ã£o "Sobre nÃ³s" com foto placeholder
5. SeÃ§Ã£o de depoimentos (2-3)
6. Footer com contato e redes sociais
7. BotÃ£o flutuante do WhatsApp

Use as cores ${briefing.colorPreferences.join(" e ")} como paleta principal.
Aplique tipografia ${briefing.fontStyle || "moderna"} e design limpo.
O resultado deve ser um HTML completo e autocontido que represente o visual final do site.`;
  }
}
```

### 29.3 Skill Type: scheduling (Cal.com)

```typescript
// infrastructure/skills/SchedulingSkill.ts

class SchedulingSkill implements Skill {
  readonly type = "scheduling";

  async execute(
    config: SchedulingConfig,
    input: SkillInput,
  ): Promise<SkillOutput> {
    switch (input.action) {
      case "create_link":
        return this.createBookingLink(config, input);
      case "get_availability":
        return this.getAvailability(config, input);
      case "cancel":
        return this.cancelBooking(config, input);
      default:
        throw new SkillError(`AÃ§Ã£o desconhecida: ${input.action}`);
    }
  }

  private async createBookingLink(config: SchedulingConfig, input: SkillInput) {
    const link = await this.calCom.createBookingLink({
      eventTypeId: config.event_type_id,
      attendeeName: input.lead.contactName,
      attendeeEmail: input.lead.contactEmail,
      metadata: { leadId: input.lead.id, dealId: input.dealId },
    });

    // Registrar agendamento no banco
    await this.api.post("/api/v1/scheduling/booking-link", {
      leadId: input.lead.id,
      dealId: input.dealId,
      bookingLink: link.url,
    });

    return { bookingLink: link.url, bookingUid: link.uid };
  }
}
```

### 29.4 Skill Type: image_gen (Nano Banana Pro)

```typescript
// infrastructure/skills/ImageGenSkill.ts

class ImageGenSkill implements Skill {
  readonly type = "image_gen";

  // Mapa de prompts por tipo de imagem e nicho
  private readonly PROMPT_TEMPLATES: Record<string, Record<string, string>> = {
    hero: {
      restaurant:
        "Professional hero image for a restaurant called {name}. Warm lighting, food photography style. Colors: {colors}. Inviting atmosphere.",
      clinic:
        "Professional hero image for a medical clinic called {name}. Clean, modern, trustworthy. Colors: {colors}. Healthcare setting.",
      salon:
        "Professional hero image for a beauty salon called {name}. Elegant, stylish. Colors: {colors}. Beauty and wellness.",
      gym: "Professional hero image for a gym called {name}. Energetic, motivational. Colors: {colors}. Fitness equipment visible.",
      lawyer:
        "Professional hero image for a law firm called {name}. Formal, trustworthy. Colors: {colors}. Office setting.",
      default:
        "Professional hero image for {niche} business {name}. Colors: {colors}. Modern, clean, professional.",
    },
    about: {
      restaurant:
        "Warm team photo in a restaurant kitchen. Chef and staff smiling. Professional.",
      clinic:
        "Medical professionals in a clinic setting. Approachable, competent.",
      salon:
        "Beauty professional working with client. Salon environment. Elegant.",
      default:
        "Professional team photo for a {niche} business. Warm, approachable.",
    },
    service_icon: {
      default:
        "Minimal flat icon representing '{service}' for a {niche}. Primary color: {color}. Simple, modern.",
    },
  };

  async execute(
    config: ImageGenConfig,
    input: SkillInput,
  ): Promise<SkillOutput> {
    const { briefing, imageType, serviceIndex } = input;

    // Selecionar template de prompt
    const template =
      this.PROMPT_TEMPLATES[imageType]?.[briefing.niche] ||
      this.PROMPT_TEMPLATES[imageType]?.default ||
      this.PROMPT_TEMPLATES.hero.default;

    // Construir prompt final
    const prompt = this.fillTemplate(template, {
      name: briefing.businessName,
      niche: briefing.niche,
      colors: briefing.colorPreferences.join(", "),
      service: briefing.pages[serviceIndex] || "servico",
      color: briefing.colorPreferences[0] || "azul",
    });

    // Tentar providers em sequÃªncia (fallback chain)
    const options: ImageOptions = {
      resolution: "2K",
      aspectRatio: imageType === "service_icon" ? "1:1" : "16:9",
      format: "webp",
    };

    const asset = await this.mediaRouter.generateImage(
      { description: prompt, ...briefing },
      options,
    );

    return { assetUrl: asset.url, assetId: asset.id, provider: asset.provider };
  }
}
```

---

## 30. ConfiguraÃ§Ã£o Detalhada do Docker Compose

```yaml
# infra/docker-compose.yml (v2 â completo)
version: "3.9"

networks:
  hefesto-network:
    driver: bridge

volumes:
  postgres_data:
  redis_data:
  chromadb_data:
  n8n_data:
  infisical_data:
  ollama_data:

services:
  # ============================================================
  # BANCO DE DADOS
  # ============================================================
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: hefesto
      POSTGRES_USER: hefesto
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./infra/scripts/init.sql:/docker-entrypoint-initdb.d/init.sql
    ports:
      - "5432:5432"
    networks: [hefesto-network]
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U hefesto"]
      interval: 10s
      retries: 5

  # ============================================================
  # CACHE E QUEUE
  # ============================================================
  redis:
    image: redis:7-alpine
    command: redis-server --requirepass ${REDIS_PASSWORD} --maxmemory 512mb --maxmemory-policy allkeys-lru
    volumes:
      - redis_data:/data
    ports:
      - "6379:6379"
    networks: [hefesto-network]
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s

  # ============================================================
  # RAG VETORIAL
  # ============================================================
  chromadb:
    image: chromadb/chroma:latest
    environment:
      CHROMA_SERVER_AUTH_CREDENTIALS: ${CHROMA_AUTH_TOKEN}
      CHROMA_SERVER_AUTH_CREDENTIALS_PROVIDER: chromadb.auth.token.TokenConfigServerAuthCredentialsProvider
      CHROMA_SERVER_AUTH_PROVIDER: chromadb.auth.token.TokenAuthServerProvider
    volumes:
      - chromadb_data:/chroma/chroma
    ports:
      - "8001:8000"
    networks: [hefesto-network]

  # ============================================================
  # WORKFLOW ORCHESTRATION
  # ============================================================
  n8n:
    image: n8nio/n8n:latest
    environment:
      N8N_BASIC_AUTH_ACTIVE: true
      N8N_BASIC_AUTH_USER: ${N8N_USER}
      N8N_BASIC_AUTH_PASSWORD: ${N8N_PASSWORD}
      DB_TYPE: postgresdb
      DB_POSTGRESDB_HOST: postgres
      DB_POSTGRESDB_DATABASE: n8n
      DB_POSTGRESDB_USER: hefesto
      DB_POSTGRESDB_PASSWORD: ${POSTGRES_PASSWORD}
      WEBHOOK_URL: ${N8N_WEBHOOK_URL}
      EXECUTIONS_PROCESS: main
      N8N_ENCRYPTION_KEY: ${N8N_ENCRYPTION_KEY}
    volumes:
      - n8n_data:/home/node/.n8n
    ports:
      - "5678:5678"
    depends_on: [postgres, redis]
    networks: [hefesto-network]

  # ============================================================
  # LLM LOCAL
  # ============================================================
  ollama:
    image: ollama/ollama:latest
    volumes:
      - ollama_data:/root/.ollama
    ports:
      - "11434:11434"
    networks: [hefesto-network]
    deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia
              count: all
              capabilities: [gpu]
              # Remove se nÃ£o tiver GPU â roda em CPU tambÃ©m (mais lento)

  # Puller de modelos do Ollama na inicializaÃ§Ã£o
  ollama-puller:
    image: ollama/ollama:latest
    depends_on: [ollama]
    entrypoint: /bin/sh
    command: >
      -c "sleep 5 &&
          ollama pull llama3.2:3b &&
          ollama pull nomic-embed-text &&
          ollama pull llava"
    environment:
      OLLAMA_HOST: http://ollama:11434
    networks: [hefesto-network]
    restart: no

  # ============================================================
  # WEB SEARCH (SEM RASTREADORES)
  # ============================================================
  searxng:
    image: searxng/searxng:latest
    environment:
      SEARXNG_SECRET: ${SEARXNG_SECRET}
    volumes:
      - ./infra/searxng/settings.yml:/etc/searxng/settings.yml:ro
    ports:
      - "8080:8080"
    networks: [hefesto-network]

  # ============================================================
  # WHATSAPP
  # ============================================================
  evolution-api:
    image: atendai/evolution-api:latest
    environment:
      SERVER_URL: http://evolution-api:8080
      AUTHENTICATION_TYPE: apikey
      AUTHENTICATION_API_KEY: ${EVOLUTION_API_KEY}
      DATABASE_PROVIDER: postgresql
      DATABASE_CONNECTION_URI: postgresql://hefesto:${POSTGRES_PASSWORD}@postgres:5432/evolution
      CACHE_REDIS_URI: redis://:${REDIS_PASSWORD}@redis:6379/1
      WEBHOOK_GLOBAL_ENABLED: true
      WEBHOOK_GLOBAL_URL: ${API_WEBHOOK_URL}/webhooks/whatsapp
    ports:
      - "8082:8080"
    depends_on: [postgres, redis]
    networks: [hefesto-network]

  # ============================================================
  # AGENDAMENTO
  # ============================================================
  cal-com:
    image: calcom/cal.com:latest
    environment:
      DATABASE_URL: postgresql://hefesto:${POSTGRES_PASSWORD}@postgres:5432/calcom
      NEXTAUTH_SECRET: ${CAL_NEXTAUTH_SECRET}
      NEXTAUTH_URL: http://cal-com:3000
      NEXT_PUBLIC_WEBAPP_URL: ${CAL_PUBLIC_URL}
      EMAIL_FROM: ${OPERATOR_EMAIL}
      EMAIL_SERVER_HOST: smtp.brevo.com
      EMAIL_SERVER_PORT: 587
      EMAIL_SERVER_USER: ${BREVO_USER}
      EMAIL_SERVER_PASSWORD: ${BREVO_PASSWORD}
    ports:
      - "3100:3000"
    depends_on: [postgres]
    networks: [hefesto-network]

  # ============================================================
  # MCP BRASIL
  # ============================================================
  mcp-brasil:
    image: ghcr.io/mcp-brasil/mcp-brasil:latest
    command: fastmcp run mcp_brasil.server:mcp --transport http --port 8000
    environment:
      MCP_BRASIL_TOOL_SEARCH: bm25
      TRANSPARENCIA_API_KEY: "${TRANSPARENCIA_API_KEY:-}"
    ports:
      - "8003:8000"
    networks: [hefesto-network]
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/health"]
      interval: 30s
      retries: 3

  # ============================================================
  # GESTÃO DE SEGREDOS
  # ============================================================
  infisical:
    image: infisical/infisical:latest
    environment:
      ENCRYPTION_KEY: ${INFISICAL_ENCRYPTION_KEY}
      AUTH_SECRET: ${INFISICAL_AUTH_SECRET}
      MONGO_URL: mongodb://infisical-mongo:27017/infisical
      SITE_URL: http://infisical:8080
    ports:
      - "8004:8080"
    depends_on: [infisical-mongo]
    networks: [hefesto-network]
    volumes:
      - infisical_data:/app/data

  infisical-mongo:
    image: mongo:6-alpine
    volumes:
      - ./infra/volumes/infisical_mongo:/data/db
    networks: [hefesto-network]

  # ============================================================
  # OBSERVABILIDADE
  # ============================================================
  prometheus:
    image: prom/prometheus:latest
    volumes:
      - ./infra/prometheus/prometheus.yml:/etc/prometheus/prometheus.yml:ro
    ports:
      - "9090:9090"
    networks: [hefesto-network]

  grafana:
    image: grafana/grafana:latest
    environment:
      GF_SECURITY_ADMIN_PASSWORD: ${GRAFANA_PASSWORD}
    volumes:
      - ./infra/grafana/dashboards:/etc/grafana/provisioning/dashboards:ro
      - ./infra/grafana/datasources:/etc/grafana/provisioning/datasources:ro
    ports:
      - "3200:3000"
    depends_on: [prometheus]
    networks: [hefesto-network]

  jaeger:
    image: jaegertracing/all-in-one:latest
    ports:
      - "16686:16686" # Jaeger UI
      - "4318:4318" # OTLP HTTP
    networks: [hefesto-network]

  # ============================================================
  # APLICAÃÃES HEFESTO
  # ============================================================
  api:
    build:
      context: .
      dockerfile: apps/api/Dockerfile
    environment:
      DATABASE_URL: postgresql://hefesto:${POSTGRES_PASSWORD}@postgres:5432/hefesto
      REDIS_URL: redis://:${REDIS_PASSWORD}@redis:6379/0
      CHROMA_URL: http://chromadb:8000
      AGENT_RUNTIME_URL: http://agent-runtime:8000
      N8N_URL: http://n8n:5678
      EVOLUTION_API_URL: http://evolution-api:8082
      CAL_BASE_URL: http://cal-com:3000
      MCP_BRASIL_URL: http://mcp-brasil:8000
      INFISICAL_URL: http://infisical:8080
      NODE_ENV: production
      PORT: 3001
    ports:
      - "3001:3001"
    depends_on: [postgres, redis, chromadb, agent-runtime]
    networks: [hefesto-network]

  agent-runtime:
    build:
      context: .
      dockerfile: apps/agent-runtime/Dockerfile
    environment:
      OLLAMA_BASE_URL: http://ollama:11434
      CHROMADB_URL: http://chromadb:8000
      API_URL: http://api:3001
      REDIS_URL: redis://:${REDIS_PASSWORD}@redis:6379/2
    ports:
      - "8000:8000"
    depends_on: [ollama, chromadb, redis]
    networks: [hefesto-network]

  web:
    build:
      context: .
      dockerfile: apps/web/Dockerfile
    environment:
      NEXT_PUBLIC_API_URL: ${API_PUBLIC_URL}
    ports:
      - "3000:3000"
    depends_on: [api]
    networks: [hefesto-network]
```

---

## 31. ColeÃ§Ãµes RAG â EspecificaÃ§Ã£o Completa

### 31.1 Collection: briefing_templates_by_niche

Esta coleÃ§Ã£o contÃ©m os roteiros de perguntas por nicho para o sub-agente INTERVIEWER. Os documentos sÃ£o vetorizados e recuperados pelo nicho do lead.

```markdown
# Template: Restaurant (Restaurante/Pizzaria/Lanchonete)

## Perguntas ObrigatÃ³rias

1. "Qual o nome completo do restaurante e que tipo de culinÃ¡ria vocÃªs oferecem?"
2. "VocÃªs fazem delivery? Se sim, por qual plataforma (iFood, Rappi) ou diretamente?"
3. "Qual o endereÃ§o completo e horÃ¡rio de funcionamento?"
4. "VocÃªs tÃªm cardÃ¡pio digital que posso usar como referÃªncia para o site?"
5. "Quantas pessoas trabalham no restaurante?"
6. "Pode me enviar o logotipo e algumas fotos dos pratos para colocar no site?"

## Perguntas Complementares

- "Tem estacionamento prÃ³prio?"
- "Aceitam reservas? Se sim, como Ã© feito hoje?"
- "TÃªm Ã¡rea para eventos ou festas?"
- "Quais meios de pagamento aceitam?"

## JSON Output Esperado

{
"businessName": "[nome do restaurante]",
"niche": "restaurant",
"siteType": "institutional",
"pages": ["home", "cardapio", "sobre", "contato"],
"hasWhatsAppButton": true,
"hasScheduling": false,
"deliveryInfo": "[plataformas se aplicÃ¡vel]"
}
```

```markdown
# Template: Clinic (ClÃ­nica MÃ©dica/OdontolÃ³gica/Psicologia)

## Perguntas ObrigatÃ³rias

1. "Qual o nome da clÃ­nica e quais especialidades sÃ£o atendidas?"
2. "Atendem por convÃªnio ou particular? Quais convÃªnios?"
3. "Gostaria de um sistema de agendamento online integrado ao site?"
4. "Quantos profissionais trabalham na clÃ­nica?"
5. "Qual o endereÃ§o e horÃ¡rio de atendimento?"
6. "Pode me enviar o logotipo e fotos da recepÃ§Ã£o/consultÃ³rio?"

## Perguntas Complementares

- "Tem CRM de pacientes integrado?"
- "Precisa de seÃ§Ã£o de artigos ou blog de saÃºde?"
- "Tem telemedicina/teleconsulta?"

## JSON Output Esperado

{
"niche": "clinic",
"siteType": "scheduling",
"hasScheduling": true,
"pages": ["home", "especialidades", "equipe", "convenios", "contato"]
}
```

```markdown
# Template: Salon (SalÃ£o de Beleza/Barbearia/EstÃ©tica)

## Perguntas ObrigatÃ³rias

1. "Qual o nome do salÃ£o e os principais serviÃ§os oferecidos?"
2. "Gostaria de agenda online para os clientes marcarem horÃ¡rio diretamente?"
3. "Qual o diferencial do seu salÃ£o?"
4. "Tem fotos de trabalhos realizados (antes/depois, penteados, etc.)?"
5. "Qual o horÃ¡rio de funcionamento e endereÃ§o completo?"

## JSON Output Esperado

{
"niche": "salon",
"siteType": "scheduling",
"hasScheduling": true,
"pages": ["home", "servicos", "galeria", "agendamento", "contato"]
}
```

### 31.2 Collection: lead_qualification_criteria

CritÃ©rios de qualificaÃ§Ã£o baseados em casos reais de conversÃ£o.

```markdown
# CritÃ©rios de Alta Probabilidade de ConversÃ£o

## Score 80-100: Lead Premium

- CNPJ ativo hÃ¡ mais de 3 anos
- Sem site ou site antes de 2019
- Rating Google â¥ 4.5 com mais de 100 avaliaÃ§Ãµes
- Segmento: saÃºde, jurÃ­dico, estÃ©tica, gastronomia
- LocalizaÃ§Ã£o: bairro comercial ou nobre
- Responde em atÃ© 2 horas

## Score 60-79: Lead Qualificado

- CNPJ ativo hÃ¡ 1-3 anos
- Sem site ou site sem mobile
- Rating Google 4.0-4.4
- 20-100 avaliaÃ§Ãµes
- Qualquer segmento ativo

## Score 40-59: Lead Morno

- NegÃ³cio com 6 meses a 1 ano
- Site desatualizado (2019-2021)
- Rating 3.5-3.9
- Menos de 20 avaliaÃ§Ãµes

## Bloqueios AutomÃ¡ticos

- CNPJ suspenso, inapto ou baixado
- Rating < 3.5 com mais de 50 avaliaÃ§Ãµes (reputaÃ§Ã£o problemÃ¡tica)
- Setor governamental
- JÃ¡ contatado nos Ãºltimos 30 dias
```

### 31.3 Collection: proposal_templates

```markdown
# Template de Proposta: Site Institucional â Pequeno NegÃ³cio

## ApresentaÃ§Ã£o

"OlÃ¡, [NOME]! ApÃ³s nossa conversa, preparei uma proposta personalizada para [EMPRESA]."

## O que estÃ¡ incluÃ­do:

â Site profissional responsivo (abre perfeitamente no celular)
â AtÃ© [N] pÃ¡ginas: [LISTA DE PÃGINAS]
â Textos profissionais criados para o seu negÃ³cio
â Fotos/imagens otimizadas
â BotÃ£o do WhatsApp integrado
â FormulÃ¡rio de contato funcional
â SEO bÃ¡sico (para aparecer no Google)
â HTTPS (cadeado de seguranÃ§a)
â 30 dias de suporte pÃ³s-entrega

## Prazo: [N] dias Ãºteis apÃ³s aprovaÃ§Ã£o

## Investimento: R$ [VALOR]

_Parcelamento disponÃ­vel mediante consulta_

## Por que [EMPRESA] precisa de um site?

Seus [N] clientes satisfeitos no Google (nota [RATING]) merecem te encontrar online.
[PORCENTAGEM]% das pessoas pesquisam no Google antes de contratar um serviÃ§o como o seu.

"Pronto para levar [EMPRESA] para o prÃ³ximo nÃ­vel?"
```

### 31.4 Collection: site_templates

````markdown
# Template 06: Site Institucional + Cal.com (Agendamento)

## Stack

- Next.js 15 (App Router)
- Tailwind CSS 4
- TypeScript 5.5
- Cal.com Atoms (widget de agendamento embedado)
- Formspree (formulÃ¡rio de contato)
- Google Analytics 4

## PÃ¡ginas IncluÃ­das

- `/` â Home com hero, serviÃ§os e CTA de agendamento
- `/sobre` â Sobre a empresa/profissional
- `/servicos` â Listagem de serviÃ§os com preÃ§os (opcional)
- `/agendamento` â Cal.com widget fullpage
- `/contato` â FormulÃ¡rio + mapa + informaÃ§Ãµes

## Componentes ObrigatÃ³rios

- `<Header />` â Logo, navegaÃ§Ã£o, CTA
- `<Hero />` â Headline, subheadline, botÃ£o agendar
- `<Services />` â Grid de cards de serviÃ§os
- `<About />` â Foto + texto + diferenciais
- `<Testimonials />` â 3 depoimentos reais ou placeholders
- `<CalWidget />` â Cal.com embed com event_type_id configurado
- `<WhatsAppButton />` â Flutuante, mobile-first
- `<Footer />` â Links, redes sociais, CNPJ

## Lighthouse Baseline (antes da customizaÃ§Ã£o)

- Performance: 96
- Accessibility: 100
- Best Practices: 100
- SEO: 100

## Security Headers (next.config.js)

```typescript
const securityHeaders = [
  { key: "X-DNS-Prefetch-Control", value: "on" },
  { key: "X-XSS-Protection", value: "0" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
];
```
````

````

---

## 32. Runbooks Operacionais

### 32.1 Runbook: WhatsApp Ban Recovery

```markdown
# Runbook: RecuperaÃ§Ã£o de Banimento do WhatsApp

## Sintomas
- Evolution API retorna erro 403 ou "Phone number banned"
- Mensagens nÃ£o entregues (status pending indefinido)
- Alerta do Grafana: whatsapp_delivery_failures > threshold

## AÃ§Ã£o Imediata (< 5 min)
1. Pausar agente Closer no painel (Status â PAUSED)
2. Ativar fallback automÃ¡tico no MessagingRouter:
   ```bash
   curl -X PATCH $API_URL/api/v1/agents/$CLOSER_ID      -H "Authorization: Bearer $TOKEN"      -d '{"defaultChannel": "EMAIL"}'
````

3. Verificar fila de mensagens pendentes no BullMQ
4. Notificar operador via Telegram (Bot 1 HITL)

## RecuperaÃ§Ã£o (1-7 dias)

1. NÃ£o usar o nÃºmero banido por 24-72h
2. Se banimento permanente: configurar novo nÃºmero no Evolution API
3. Aquecer novo nÃºmero (warm-up): 5 msg/dia semana 1, 15/dia semana 2, 30/dia semana 3
4. Nunca ultrapassar 50 msg/dia nos primeiros 30 dias

## PrevenÃ§Ã£o

- max_messages_per_day: 50 (configurado)
- anti_spam_delay_ms: 1500-4000 (configurado)
- typing_indicator: true (humanizaÃ§Ã£o)
- NÃ£o enviar links nas primeiras 3 mensagens com um contato novo

````

### 32.2 Runbook: Google Maps Quota Exceeded

```markdown
# Runbook: Quota do Google Maps Excedida

## Sintomas
- Skill google_maps_prospector retorna erro 429
- Alerta: maps_requests_remaining < 100

## Plano de AÃ§Ã£o
1. Verificar consumo atual:
   ```bash
   curl "https://maps.googleapis.com/maps/api/quota"      -H "X-Goog-Api-Key: $GOOGLE_MAPS_KEY"
````

2. Se cota < 200: pausar Hunter atÃ© meia-noite (reset diÃ¡rio)
3. Se crÃ­tico: ativar modo batch (processar leads do cache)

## Aumento de Quota

- Upgrade para $200/mÃªs habilita 100.000 requests/mÃªs
- ROI calculado: $200 = ~48 sites, receita ~R$24.000-72.000

## Cache de Leads

- TTL configurado: 24h
- Cache key: `maps:${categoria}:${regiÃ£o}:${data}`
- Leads cacheados nÃ£o consomem quota

## Fontes Alternativas (backup)

- SearXNG: busca web por "pizzaria Salvador sem site"
- Apollo.io: filtro por domÃ­nio vazio (free tier: 50 contatos/mÃªs)

````

### 32.3 Runbook: LLM Provider Fallback

```markdown
# Runbook: Fallback de Provider LLM

## Hierarquia de Fallback por Tier

### Tier 0 (Ollama local)
- Fallback: Nenhum (se Ollama cair, usar Haiku como emergÃªncia)
- AÃ§Ã£o: `docker restart ollama && ollama pull llama3.2:3b`

### Tier 1 (Gemini 3.5 Flash)
- Fallback: Groq llama-3.3-70b (velocidade similar, custo similar)
- Fallback 2: GPT-4o-mini
- Configurar em: `llm_routing.py` â `prospecting` key

### Tier 3 (Sonnet 4.6)
- Fallback: GPT-4o (qualidade similar, preÃ§o similar)
- Fallback 2: Gemini 3.1 Pro
- Jamais usar Haiku para copywriting de vendas

### Tier 4 (Opus 4.8)
- Fallback: GPT-4o (para cÃ³digo)
- Jamais usar Sonnet para cÃ³digo de produÃ§Ã£o (qualidade menor)

## Sinais de Alerta
- LatÃªncia p95 > 30s em qualquer provider
- Taxa de erro > 5% em 5 min
- Alerta Grafana: agent_llm_errors_total > threshold

## AtivaÃ§Ã£o Manual
```bash
# Trocar provider do sub-agente CODER para GPT-4o
curl -X PATCH $API_URL/api/v1/agents/$BUILDER_ID/sub-agents/$CODER_ID   -H "Authorization: Bearer $TOKEN"   -d '{"llm_provider": "OPENAI", "llm_model": "gpt-4o"}'
````

````

### 32.4 Runbook: Nano Banana Pro Fallback

```markdown
# Runbook: Fallback do Nano Banana Pro

## Sintomas
- Skill image_gen retorna erro do provider nano_banana_pro
- Alerta: media_generation_total{provider=nano_banana_pro, status=failed} > 0

## Fallback AutomÃ¡tico (jÃ¡ configurado no MediaGenerationRouter)
1. nano_banana_pro â DALL-E 3 (fallback automÃ¡tico em < 1s)
2. DALL-E 3 â Ollama LLaVA (fallback local, qualidade menor)

## VerificaÃ§Ã£o
```bash
# Testar Nano Banana Pro diretamente
curl -X POST https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-001:generateImages   -H "x-goog-api-key: $GEMINI_API_KEY"   -d '{"prompt": "test image", "number_of_images": 1}'
````

## Notas sobre SynthID

- Nano Banana Pro: SynthID sempre presente (watermark digital invisÃ­vel)
- DALL-E 3: Content-Credentials metadata (C2PA)
- Ollama LLaVA: sem watermark
- Documentar ao cliente qual provider foi usado se necessÃ¡rio

````

---

## 33. DefiniÃ§Ã£o de Done (DoD) por Feature

Cada feature implementada deve passar por todos os critÃ©rios antes de ser considerada pronta.

### DoD Global (todas as features)

```markdown
## CÃ³digo
- [ ] TypeScript sem erros (tsc --noEmit passa)
- [ ] ESLint sem warnings ou erros
- [ ] Prettier aplicado
- [ ] Nenhum console.log em cÃ³digo de produÃ§Ã£o

## Testes
- [ ] Testes unitÃ¡rios escritos ANTES do cÃ³digo (TDD)
- [ ] Cobertura de statements â¥ 80%
- [ ] Testes de integraÃ§Ã£o cobrindo happy path + error path
- [ ] Testes de seguranÃ§a relevantes passando

## SeguranÃ§a
- [ ] Inputs validados com Zod
- [ ] Magic bytes validados em uploads
- [ ] Nenhuma secret hardcoded
- [ ] Rate limiting aplicado em endpoint pÃºblico
- [ ] Headers de seguranÃ§a configurados

## DomÃ­nio
- [ ] Domain Event emitido para mudanÃ§as de estado
- [ ] Aggregate atualizado de forma consistente
- [ ] RepositÃ³rio usado apenas na camada de infra
- [ ] Use case sem imports de infra

## Observabilidade
- [ ] Log estruturado em pontos crÃ­ticos
- [ ] MÃ©trica Prometheus registrada
- [ ] Span de tracing OpenTelemetry criado
- [ ] correlationId propagado

## DocumentaÃ§Ã£o
- [ ] README do mÃ³dulo atualizado (se aplicÃ¡vel)
- [ ] Schema de banco com migration versionada
- [ ] API endpoint documentado (se novo)

## Review
- [ ] PR com descriÃ§Ã£o clara do que foi feito
- [ ] Self-review antes de submeter
- [ ] CI passou (todos os checks verdes)
````

### DoD EspecÃ­fico: IntegraÃ§Ã£o com ServiÃ§o Externo

```markdown
## Adicional para adapters (Maps, MCP Brasil, HeyGen, etc.)

- [ ] Interface de domÃ­nio (Port) definida antes do adapter
- [ ] Adapter implementa apenas a interface â sem lÃ³gica de domÃ­nio
- [ ] SSRF prevention no adapter (se URL configurÃ¡vel)
- [ ] Rate limiting configurado
- [ ] Retry com exponential backoff (max 3 tentativas)
- [ ] Timeout configurÃ¡vel (padrÃ£o: 30s)
- [ ] Teste de mock do serviÃ§o externo (nunca chamar API real em testes)
- [ ] Fallback documentado no runbook
- [ ] Alerta Grafana configurado para falha > threshold
```

### DoD EspecÃ­fico: Sub-agente

```markdown
## Adicional para cada sub-agente

- [ ] Role definido no enum SubAgentRole
- [ ] LLM tier justificado (ver tabela seÃ§Ã£o 9)
- [ ] execution_mode e parallel_group definidos
- [ ] system_prompt â¤ 32.000 chars
- [ ] max_retries e timeout_seconds configurados
- [ ] Skills mÃ­nimas necessÃ¡rias listadas em skills_refs
- [ ] CenÃ¡rio BDD escrito antes da implementaÃ§Ã£o
- [ ] Output do sub-agente validado (JSON schema se estruturado)
- [ ] Token usage logado no token_usage_log
- [ ] Sub-agente testado isoladamente com mock do LLM
```

---

## 34. Matriz de Responsabilidades por Agente

```
TAREFA                          â HUNTER â CLOSER â BRIEFING â BUILDER â QA â DELIVERY â ORCH.
âââââââââââââââââââââââââââââââââ¼âââââââââ¼âââââââââ¼âââââââââââ¼ââââââââââ¼âââââ¼âââââââââââ¼ââââââ
Buscar leads no Google Maps     â   â   â        â          â         â    â          â
Validar CNPJ via MCP Brasil     â   â   â        â          â         â    â          â
Calcular qualification score    â   â   â        â          â         â    â          â
Analisar site atual do lead     â   â   â        â          â         â    â          â
Escrever 1Âº contato             â        â   â   â          â         â    â          â
Conduzir negociaÃ§Ã£o             â        â   â   â          â         â    â          â
Gerar proposta PDF              â        â   â   â          â         â    â          â
Calcular preÃ§o                  â        â   â   â          â         â    â          â
Agendar reuniÃ£o (Cal.com)       â        â   â   â          â         â    â          â
Fazer follow-up automÃ¡tico      â        â   â   â          â         â    â          â
Conduzir entrevista de briefing â        â        â    â    â         â    â          â
Extrair JSON estruturado        â        â        â    â    â         â    â          â
Receber fotos/logo do cliente   â        â        â    â    â         â    â          â
Selecionar template             â        â        â          â   â    â    â          â
Gerar mockup visual             â        â        â          â   â    â    â          â
Gerar textos (copywriting)      â        â        â          â   â    â    â          â
Gerar imagens (Nano Banana Pro) â        â        â          â   â    â    â          â
Gerar cÃ³digo Next.js            â        â        â          â   â    â    â          â
Configurar SEO                  â        â        â          â   â    â    â          â
Fazer deploy                    â        â        â          â   â    â    â          â
Auditar seguranÃ§a (OWASP)       â        â        â          â         â â â          â
Auditar performance (Lighthouse)â        â        â          â         â â â          â
Verificar textos e a11y         â        â        â          â         â â â          â
Gerar tutorial HeyGen           â        â        â          â         â    â    â    â
Gerar PDF de entrega            â        â        â          â         â    â    â    â
Enviar site ao cliente          â        â        â          â         â    â    â    â
Agendar follow-up pÃ³s-entrega   â        â        â          â         â    â    â    â
Rotear eventos entre agentes    â        â        â          â         â    â          â  â
Gerenciar estado do pipeline    â        â        â          â         â    â          â  â
Controlar retries e timeouts    â        â        â          â         â    â          â  â
```

---

## 35. Estrutura de Eventos de DomÃ­nio â Payload Completo

```typescript
// Todos os eventos seguem esta estrutura base
// domain/shared/DomainEvent.ts

interface BaseDomainEvent {
  eventId: string;          // UUID v4
  eventType: string;        // 'LeadQualified', 'DealClosed', etc.
  aggregateId: string;      // ID da entidade principal
  aggregateType: string;    // 'Lead', 'Deal', 'Project', etc.
  occurredAt: string;       // ISO 8601
  correlationId: string;    // UUID â rastreia todo o fluxo de uma aÃ§Ã£o
  causationId?: string;     // UUID â evento que causou este
  schemaVersion: string;    // '1.0.0' â para evoluÃ§Ã£o do schema
}

// ============================================================
// EXEMPLOS DE PAYLOADS COMPLETOS
// ============================================================

// LeadQualified
{
  eventType: 'LeadQualified',
  aggregateType: 'Lead',
  payload: {
    leadId: 'uuid',
    contactName: 'JoÃ£o Silva',
    businessName: 'Bella Napoli Pizzaria',
    qualificationScore: 78,
    source: 'GOOGLE_MAPS',
    enrichmentData: {
      cnpj: '12.345.678/0001-90',
      cnpjStatus: 'ATIVA',
      yearsInBusiness: 4,
      googleMapsPlaceId: 'ChIJabc123',
      googleRating: 4.8,
      googleReviewsCount: 234,
      hasWebsite: false,
      neighborhood: 'Barra',
      city: 'Salvador',
      state: 'BA'
    },
    assignedAgentId: 'uuid',
    preferredChannel: 'WHATSAPP'
  }
}

// BriefingCompleted
{
  eventType: 'BriefingCompleted',
  aggregateType: 'Briefing',
  payload: {
    briefingId: 'uuid',
    dealId: 'uuid',
    leadId: 'uuid',
    niche: 'restaurant',
    siteType: 'institutional',
    structured: {
      businessName: 'Bella Napoli',
      businessDescription: 'Pizzaria artesanal com massas frescas desde 2020',
      siteType: 'institutional',
      pages: ['home', 'cardapio', 'sobre', 'contato'],
      colorPreferences: ['vermelho', 'branco', 'dourado'],
      fontStyle: 'classic',
      differentials: ['Massa artesanal', 'Forno a lenha', 'Delivery em 30min'],
      hasEcommerce: false,
      hasBlog: false,
      hasCustomForm: true,
      hasScheduling: false,
      hasWhatsAppButton: true,
      needsCopywriting: true,
      deliveryDays: 3,
      contactPhone: '+55 71 99999-0000',
      logoProvided: true,
      photosProvided: true
    },
    uploadedAssetsCount: 5,
    interviewDurationMinutes: 12
  }
}

// MockupApproved
{
  eventType: 'MockupApproved',
  aggregateType: 'Project',
  payload: {
    projectId: 'uuid',
    mockupUrl: 'https://storage.hefesto.com/mockups/uuid/mockup.html',
    approvedBy: 'operator_uuid',
    approvedAt: '2026-05-29T10:30:00Z',
    hitlApprovalId: 'uuid',
    notes: 'Aprovado. Trocar vermelho escuro por vermelho mais vivo.'
  }
}

// AssetGenerated (Nano Banana Pro)
{
  eventType: 'AssetGenerated',
  aggregateType: 'Project',
  payload: {
    projectId: 'uuid',
    assetId: 'uuid',
    assetType: 'hero',
    provider: 'nano_banana_pro',
    storageUrl: 'https://storage.hefesto.com/assets/uuid/hero.webp',
    resolution: '2K',
    format: 'webp',
    synthIdPresent: true,
    magicBytesValidated: true,
    generationCostUsd: 0.04,
    promptUsed: 'Professional hero image for restaurant Bella Napoli...'
  }
}

// SiteDeliveredToClient
{
  eventType: 'SiteDeliveredToClient',
  aggregateType: 'Project',
  payload: {
    projectId: 'uuid',
    deliverableUrl: 'https://bellanapoli.com.br',
    deployPlatform: 'vercel',
    deliveryTutorialUrl: 'https://heygen.com/share/abc123',
    deliveryDocUrl: 'https://storage.hefesto.com/docs/uuid/entrega.pdf',
    lighthouseScores: {
      performance: 96,
      accessibility: 100,
      bestPractices: 100,
      seo: 95
    },
    owaspScanPassed: true,
    contentCheckPassed: true,
    deliveredAt: '2026-05-29T14:00:00Z',
    followUpScheduledAt: '2026-06-05T09:00:00Z'
  }
}
```

---

## 36. PolÃ­tica de Dados e LGPD

### 36.1 Dados Coletados e Base Legal

| Dado                      | Finalidade                        | Base Legal LGPD        | RetenÃ§Ã£o          |
| ------------------------- | --------------------------------- | ---------------------- | ------------------- |
| Nome e telefone do lead   | ProspecÃ§Ã£o e comunicaÃ§Ã£o      | LegÃ­timo interesse    | 180 dias            |
| E-mail do lead            | ComunicaÃ§Ã£o e proposta          | Consentimento (opt-in) | 180 dias            |
| CNPJ                      | QualificaÃ§Ã£o do lead            | LegÃ­timo interesse    | 180 dias            |
| TranscriÃ§Ã£o de briefing | ExecuÃ§Ã£o do serviÃ§o contratado | ExecuÃ§Ã£o de contrato | DuraÃ§Ã£o + 30 dias |
| Dados do site criado      | Entrega do produto                | ExecuÃ§Ã£o de contrato | 1 ano               |
| Logs de auditoria         | Compliance e seguranÃ§a           | ObrigaÃ§Ã£o legal      | 5 anos              |
| Token usage               | Billing e otimizaÃ§Ã£o            | LegÃ­timo interesse    | 1 ano               |

### 36.2 Direitos do Titular

O sistema deve suportar os direitos do titular previstos na LGPD (Art. 18):

```typescript
// application/privacy/PrivacyUseCase.ts

class PrivacyUseCase {
  // Direito de acesso (Art. 18, I)
  async exportLeadData(leadId: string): Promise<LeadDataExport> {
    const lead = await this.leadRepo.findById(leadId);
    const messages = await this.messageRepo.findByLead(leadId);
    const deals = await this.dealRepo.findByLead(leadId);
    // Exportar sem dados de terceiros (enrichment de APIs governamentais)
    return { lead: this.sanitize(lead), messages, deals };
  }

  // Direito de eliminaÃ§Ã£o (Art. 18, VI)
  async anonymizeLead(leadId: string): Promise<void> {
    await this.leadRepo.anonymize(leadId, {
      contactName: "ANONIMIZADO",
      contactEmail: null,
      contactPhone: null,
      // Manter: score, status, datas â para analytics anonimizados
    });
    await this.auditLog.record("LEAD_ANONYMIZED", leadId);
  }

  // Direito de portabilidade (Art. 18, V)
  async exportToCSV(leadId: string): Promise<Buffer> {
    const data = await this.exportLeadData(leadId);
    return this.csvExporter.export(data);
  }
}
```

### 36.3 Consentimento no Primeiro Contato

O sub-agente OUTREACH_WRITER deve sempre incluir no primeiro contato:

```
"[Mensagem de prospecÃ§Ã£o]

Caso nÃ£o tenha interesse em receber nossas mensagens, responda PARAR
e nÃ£o entraremos mais em contato.

[Nome do operador]
[Empresa do operador]"
```

E o sistema deve processar automaticamente respostas com "PARAR", "STOP", "NÃO QUERO":

```typescript
// No Conv. Handler sub-agent
const OPT_OUT_PATTERNS = [/parar/i, /stop/i, /nÃ£o quero/i, /remover/i];

if (OPT_OUT_PATTERNS.some((p) => p.test(message.content))) {
  await this.leadRepo.updateStatus(lead.id, "OPTED_OUT");
  await this.blocklist.add(lead.contactPhone);
  // Nunca mais contatar este nÃºmero
}
```

---

## 37. Plano de Testes E2E â Fluxo Completo

### CenÃ¡rio E2E 1: Ciclo Completo de um Site Institucional

```typescript
// tests/e2e/full_cycle_institutional.spec.ts
import { test, expect } from "@playwright/test";

test.describe("Fluxo Completo: Site Institucional", () => {
  test("lead sem site â site entregue em < 30min IA", async ({
    page,
    request,
  }) => {
    // 1. Simular lead qualificado do Google Maps
    const leadResp = await request.post("/api/v1/leads", {
      data: {
        contactName: "JoÃ£o Silva",
        businessName: "Bella Napoli",
        contactPhone: "+5571999999999",
        source: "GOOGLE_MAPS",
        enrichmentData: {
          cnpjStatus: "ATIVA",
          yearsInBusiness: 4,
          googleRating: 4.8,
          hasWebsite: false,
        },
      },
    });
    const { id: leadId } = await leadResp.json();
    expect(leadResp.status()).toBe(201);

    // 2. Simular HITL de aprovaÃ§Ã£o do lead
    const hitlResp = await page.waitForResponse(
      (r) => r.url().includes("/api/v1/hitl") && r.status() === 201,
      { timeout: 30000 },
    );
    const { id: hitlId } = await hitlResp.json();

    await request.post(`/api/v1/hitl/${hitlId}/approve`, {
      data: { note: "Aprovado para contato" },
    });

    // 3. Aguardar deal fechado (simulado)
    await request.post(`/api/v1/deals`, {
      data: { leadId, serviceType: "WEBSITE", status: "CLOSED" },
    });

    // 4. Aguardar briefing completado
    const briefingEvent = await page.waitForResponse(
      (r) => r.url().includes("/api/v1/briefings") && r.status() === 201,
      { timeout: 60000 },
    );

    // 5. Aprovar briefing
    const { id: briefingId } = await briefingEvent.json();
    await request.patch(`/api/v1/briefings/${briefingId}/approve`);

    // 6. Aguardar mockup gerado (HITL)
    const mockupHitl = await page.waitForResponse(
      (r) =>
        r.url().includes("/api/v1/hitl") &&
        r.request().postDataJSON()?.actionType === "APPROVE_MOCKUP",
      { timeout: 300000 }, // 5 min para geraÃ§Ã£o
    );
    const { id: mockupHitlId } = await mockupHitl.json();
    await request.post(`/api/v1/hitl/${mockupHitlId}/approve`);

    // 7. Aguardar staging deploy (HITL)
    const stagingHitl = await page.waitForResponse(
      (r) =>
        r.url().includes("/api/v1/hitl") &&
        r.request().postDataJSON()?.actionType === "APPROVE_STAGING",
      { timeout: 600000 }, // 10 min para build + deploy staging
    );
    const { id: stagingHitlId } = await stagingHitl.json();
    const stagingData = await stagingHitl.json();

    // 8. Verificar scores do staging
    expect(
      stagingData.payloadPreview.lighthouseScores.performance,
    ).toBeGreaterThanOrEqual(85);
    expect(stagingData.payloadPreview.lighthouseScores.accessibility).toBe(100);
    expect(stagingData.payloadPreview.owaspPassed).toBe(true);

    // 9. Aprovar staging â deploy produÃ§Ã£o
    await request.post(`/api/v1/hitl/${stagingHitlId}/approve`);

    // 10. Verificar entrega final
    const deliveryEvent = await page.waitForResponse(
      (r) =>
        r.url().includes("/api/v1/events") &&
        r.request().postDataJSON()?.type === "SiteDeliveredToClient",
      { timeout: 120000 },
    );
    const delivery = await deliveryEvent.json();

    expect(delivery.payload.deliverableUrl).toMatch(/^https:\/\//);
    expect(delivery.payload.deliveryTutorialUrl).toBeTruthy();
    expect(delivery.payload.deliveryDocUrl).toBeTruthy();
    expect(
      delivery.payload.lighthouseScores.performance,
    ).toBeGreaterThanOrEqual(85);
  });
});
```

---

## 38. ConfiguraÃ§Ã£o do Prometheus

```yaml
# infra/prometheus/prometheus.yml

global:
  scrape_interval: 15s
  evaluation_interval: 15s

alerting:
  alertmanagers:
    - static_configs:
        - targets: ["alertmanager:9093"]

rule_files:
  - /etc/prometheus/rules/*.yml

scrape_configs:
  - job_name: "hefesto-api"
    static_configs:
      - targets: ["api:3001"]
    metrics_path: /api/v1/metrics

  - job_name: "hefesto-agent-runtime"
    static_configs:
      - targets: ["agent-runtime:8000"]
    metrics_path: /metrics

  - job_name: "postgres"
    static_configs:
      - targets: ["postgres-exporter:9187"]

  - job_name: "redis"
    static_configs:
      - targets: ["redis-exporter:9121"]

  - job_name: "n8n"
    static_configs:
      - targets: ["n8n:5678"]
    metrics_path: /metrics
```

```yaml
# infra/prometheus/rules/hefesto.yml

groups:
  - name: hefesto_alerts
    rules:
      - alert: HITLQueueBacklog
        expr: hitl_approvals_pending > 10
        for: 5m
        labels: { severity: warning }
        annotations:
          summary: "HITL queue com {{ $value }} itens pendentes"
          description: "Operador deve revisar aprovaÃ§Ãµes pendentes"

      - alert: AgentHighErrorRate
        expr: rate(agent_llm_errors_total[5m]) > 0.1
        for: 2m
        labels: { severity: critical }
        annotations:
          summary: "Taxa de erro alta no agente {{ $labels.agent_id }}"

      - alert: CostThresholdExceeded
        expr: sum(agent_token_cost_usd_total) > 50
        for: 1m
        labels: { severity: warning }
        annotations:
          summary: "Custo total de tokens excedeu $50"

      - alert: WhatsAppDeliveryFailed
        expr: rate(whatsapp_delivery_failures_total[5m]) > 0.2
        for: 2m
        labels: { severity: critical }
        annotations:
          summary: "20%+ das mensagens WhatsApp falhando â possÃ­vel banimento"

      - alert: MapsQuotaLow
        expr: maps_requests_remaining < 200
        for: 1m
        labels: { severity: warning }
        annotations:
          summary: "Quota Google Maps baixa: {{ $value }} requests restantes"

      - alert: SecurityBruteForce
        expr: rate(auth_failed_attempts_total[1m]) > 10
        for: 30s
        labels: { severity: critical }
        annotations:
          summary: "PossÃ­vel ataque de forÃ§a bruta detectado"

      - alert: MediaGenerationProviderDown
        expr: rate(media_generation_total{provider="nano_banana_pro",status="failed"}[5m]) > 0.5
        for: 2m
        labels: { severity: warning }
        annotations:
          summary: "Nano Banana Pro com alta taxa de falha â usando fallback DALL-E"
```

---

_Fim do PRD Hefesto v2.0.0_
_Total de seÃ§Ãµes: 38_
_Documento aprovado para inÃ­cio da implementaÃ§Ã£o apÃ³s revisÃ£o dos stakeholders._

---

## 39. Fluxo de Autenticação e Sessão — Detalhamento

### 39.1 Diagrama de Sequência: Login

```
Operador          API (Fastify)        DB (PostgreSQL)    Infisical
   │                   │                     │               │
   │── POST /login ───►│                     │               │
   │   {email, pass}   │                     │               │
   │                   │── findByEmail() ───►│               │
   │                   │◄── {user} ──────────│               │
   │                   │                     │               │
   │                   │ argon2.verify(      │               │
   │                   │   hash, password)   │               │
   │                   │ [SEMPRE executa,    │               │
   │                   │  mesmo user null]   │               │
   │                   │                     │               │
   │                   │── signJWT(RS256) ──►│               │
   │                   │── generateRefresh ─►│               │
   │                   │── auditLog() ──────►│               │
   │                   │                     │               │
   │◄── 200 OK ────────│                     │               │
   │  {accessToken,    │                     │               │
   │   refreshToken}   │                     │               │
```

### 39.2 Fluxo de Refresh Token

```typescript
// application/auth/RefreshTokenUseCase.ts

class RefreshTokenUseCase {
  async execute(refreshToken: string): Promise<AuthTokens> {
    // 1. Hash do token recebido
    const tokenHash = await this.hash(refreshToken);

    // 2. Buscar no banco (não armazenar token raw)
    const stored = await this.tokenRepo.findByHash(tokenHash);
    if (!stored) throw new UnauthorizedError();
    if (stored.revokedAt) throw new UnauthorizedError();
    if (stored.expiresAt < new Date()) throw new UnauthorizedError();

    // 3. Revogar token atual (rotação)
    await this.tokenRepo.revoke(stored.id);

    // 4. Gerar novo par de tokens
    const newTokens = await this.generateTokens(stored.operatorId);

    // 5. Auditoria
    await this.auditLog.record("TOKEN_REFRESHED", stored.operatorId);

    return newTokens;
  }
}
```

### 39.3 Middleware de Autenticação

```typescript
// http/middleware/auth.middleware.ts

const authMiddleware = async (req: FastifyRequest, reply: FastifyReply) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return reply.status(401).send({ errors: [{ code: "UNAUTHORIZED" }] });
  }

  const token = authHeader.slice(7);

  try {
    // Verificar JWT RS256 com chave pública
    const payload = await jwtVerify(token, publicKey, {
      issuer: JWT_CONFIG.issuer,
      audience: JWT_CONFIG.audience,
    });

    // Injetar operador na request (sem query adicional ao banco)
    req.operator = {
      id: payload.sub as string,
      email: payload.email as string,
    };
  } catch (error) {
    if (error instanceof errors.JWTExpired) {
      return reply.status(401).send({ errors: [{ code: "TOKEN_EXPIRED" }] });
    }
    return reply.status(401).send({ errors: [{ code: "INVALID_TOKEN" }] });
  }
};
```

---

## 40. Estratégia de Migrations de Banco

### 40.1 Convenção de Nomenclatura

```
migrations/
  0001_initial_schema.sql
  0002_add_sub_agents.sql           # v2: tabela sub_agents
  0003_add_briefings.sql            # v2: bounded context Briefing
  0004_add_media_assets.sql         # v2: generated_assets
  0005_add_enrichment_data.sql      # v2: coluna enrichment_data em leads
  0006_add_telegram_support.sql     # v2: message_channel enum + telegram_chat_id
  0007_add_scheduling.sql           # v2: tabela scheduled_meetings
  0008_add_cost_tracking.sql        # v2: token_usage_log
  0009_add_delivery_fields.sql      # v2: delivery_tutorial_url, delivery_doc_url
  0010_expand_system_prompt.sql     # v2: remover CHECK de length em system_prompt
```

### 40.2 Script de Migration Crítica: Expandir system_prompt

```sql
-- migrations/0010_expand_system_prompt.sql
-- CONTEXTO: O campo llm_system_prompt tinha CHECK length <= 8000 (PRD v1)
-- v2: Remover esse limite — system prompts de sub-agentes podem ter até 32k chars
-- ROLLBACK SEGURO: se reverter, não perde dados (apenas restrição)

BEGIN;

-- Remover a constraint de tamanho
ALTER TABLE agents
  DROP CONSTRAINT IF EXISTS agents_llm_system_prompt_check;

-- Adicionar nova constraint mais permissiva (32k)
-- Validamos no application layer por ser TEXT longo
-- Não há CHECK no banco — performance em INSERT/UPDATE

-- Registrar migration
INSERT INTO schema_migrations (version, applied_at)
VALUES ('0010', NOW());

COMMIT;
```

### 40.3 Drizzle Schema Completo dos Novos Tipos

```typescript
// infrastructure/db/schema.ts — extensoes v2

import {
  pgEnum,
  pgTable,
  uuid,
  text,
  integer,
  boolean,
  numeric,
  timestamp,
  jsonb,
  bigint,
  inet,
} from "drizzle-orm/pg-core";

// Enums atualizados
export const agentPersonaEnum = pgEnum("agent_persona", [
  "HUNTER",
  "CLOSER",
  "BRIEFING",
  "BUILDER",
  "QA",
  "DELIVERY",
  "ORCHESTRATOR",
]);

export const llmProviderEnum = pgEnum("llm_provider", [
  "OLLAMA",
  "OPENAI",
  "ANTHROPIC",
  "GROQ",
  "GEMINI",
  "CUSTOM",
]);

export const messageChannelEnum = pgEnum("message_channel", [
  "WHATSAPP",
  "TELEGRAM",
  "EMAIL",
  "INTERNAL",
]);

export const projectStatusEnum = pgEnum("project_status", [
  "PLANNING",
  "DESIGNING",
  "BUILDING",
  "QA",
  "STAGING",
  "DELIVERED",
  "REVISION",
  "CANCELLED",
]);

export const siteTypeEnum = pgEnum("site_type", [
  "institutional",
  "ecommerce",
  "scheduling",
  "portfolio",
  "landing",
]);

// Sub-agentes (v2)
export const subAgents = pgTable("sub_agents", {
  id: uuid("id").primaryKey().defaultRandom(),
  agentId: uuid("agent_id")
    .references(() => agents.id, { onDelete: "cascade" })
    .notNull(),
  role: text("role").notNull(),
  llmProvider: llmProviderEnum("llm_provider").notNull(),
  llmModel: text("llm_model").notNull(),
  llmApiKeyRef: text("llm_api_key_ref"),
  llmTemperature: numeric("llm_temperature", { precision: 3, scale: 2 })
    .default("0.5")
    .notNull(),
  llmMaxTokens: integer("llm_max_tokens").default(4096).notNull(),
  executionMode: text("execution_mode").default("sequential").notNull(),
  parallelGroup: integer("parallel_group"),
  maxRetries: integer("max_retries").default(2).notNull(),
  timeoutSeconds: integer("timeout_seconds").default(120).notNull(),
  isEnabled: boolean("is_enabled").default(true).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// Briefings (v2)
export const briefings = pgTable("briefings", {
  id: uuid("id").primaryKey().defaultRandom(),
  dealId: uuid("deal_id")
    .references(() => deals.id)
    .notNull(),
  leadId: uuid("lead_id")
    .references(() => leads.id)
    .notNull(),
  operatorId: uuid("operator_id")
    .references(() => operators.id)
    .notNull(),
  agentId: uuid("agent_id").references(() => agents.id),
  status: text("status").default("IN_PROGRESS").notNull(),
  niche: text("niche"),
  siteType: siteTypeEnum("site_type"),
  structuredBrief: jsonb("structured_brief").default({}).notNull(),
  transcriptVaultRef: text("transcript_vault_ref"),
  uploadedAssets: jsonb("uploaded_assets").default([]).notNull(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  approvedAt: timestamp("approved_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// Generated Assets (v2)
export const generatedAssets = pgTable("generated_assets", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id")
    .references(() => projects.id, { onDelete: "cascade" })
    .notNull(),
  assetType: text("asset_type").notNull(),
  provider: text("provider").notNull(),
  storageUrl: text("storage_url").notNull(),
  promptUsed: text("prompt_used"),
  resolution: text("resolution"),
  format: text("format").default("webp").notNull(),
  synthIdPresent: boolean("synth_id_present").default(false).notNull(),
  magicBytesValidated: boolean("magic_bytes_validated").default(true).notNull(),
  generationCostUsd: numeric("generation_cost_usd", { precision: 8, scale: 4 }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// Token Usage Log (v2)
export const tokenUsageLog = pgTable("token_usage_log", {
  id: uuid("id").primaryKey().defaultRandom(),
  agentId: uuid("agent_id")
    .references(() => agents.id)
    .notNull(),
  subAgentId: uuid("sub_agent_id").references(() => subAgents.id),
  projectId: uuid("project_id").references(() => projects.id),
  leadId: uuid("lead_id").references(() => leads.id),
  provider: llmProviderEnum("provider").notNull(),
  model: text("model").notNull(),
  promptTokens: integer("prompt_tokens").default(0).notNull(),
  completionTokens: integer("completion_tokens").default(0).notNull(),
  totalTokens: integer("total_tokens").default(0).notNull(),
  costUsd: numeric("cost_usd", { precision: 10, scale: 6 })
    .default("0")
    .notNull(),
  taskType: text("task_type"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});
```

---

## 41. Configuração do Agent Runtime (Python/CrewAI)

### 41.1 Estrutura da API do Agent Runtime

O agent-runtime expõe uma API HTTP interna consumida pelo n8n e pela API principal:

```python
# apps/agent-runtime/src/main.py

from fastapi import FastAPI, BackgroundTasks
from pydantic import BaseModel
import uvicorn

app = FastAPI(title="Hefesto Runtime", version="2.0.0")

class AgentRunRequest(BaseModel):
    agent_id: str
    task_type: str
    payload: dict
    correlation_id: str

@app.post("/agents/{persona}/run")
async def run_agent(persona: str, request: AgentRunRequest, bg: BackgroundTasks):
    """Inicia um agente em background e retorna job_id imediatamente."""
    job_id = await queue.enqueue(persona, request)
    return {"job_id": job_id, "status": "queued"}

@app.get("/agents/{persona}/jobs/{job_id}")
async def get_job_status(persona: str, job_id: str):
    """Consulta status de um job de agente."""
    job = await queue.get(job_id)
    return {"job_id": job_id, "status": job.status, "result": job.result}

@app.post("/agents/{persona}/sub-agents/{role}/run")
async def run_sub_agent(persona: str, role: str, request: AgentRunRequest):
    """Executa um sub-agente específico (síncrono para tarefas rápidas)."""
    result = await sub_agent_registry.run(persona, role, request.payload)
    return result

@app.get("/health")
async def health():
    return {
        "status": "ok",
        "ollama": await check_ollama(),
        "chromadb": await check_chromadb(),
        "redis": await check_redis(),
    }

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
```

### 41.2 Sub-agent Base Class

```python
# apps/agent-runtime/src/agents/base_sub_agent.py

from abc import ABC, abstractmethod
from crewai import Agent, Task
from litellm import completion
import structlog
import time

logger = structlog.get_logger()

class BaseSubAgent(ABC):
    """Classe base para todos os sub-agentes do Hefesto."""

    persona: str        # Ex: 'builder'
    role: str           # Ex: 'COPYWRITER'
    llm_model: str      # Ex: 'claude-sonnet-4-6'

    def __init__(self, config: dict, secrets: dict):
        self.config = config
        self.secrets = secrets
        self.crewai_agent = self._build_agent()

    def _build_agent(self) -> Agent:
        return Agent(
            role=self.role,
            goal=self.get_goal(),
            backstory=self.get_backstory(),
            llm=self.llm_model,
            verbose=True,
            allow_delegation=False,   # Sub-agentes nao delegam
            max_iter=self.config.get('max_retries', 2),
        )

    @abstractmethod
    def get_goal(self) -> str: ...

    @abstractmethod
    def get_backstory(self) -> str: ...

    @abstractmethod
    def build_task(self, input: dict) -> Task: ...

    async def execute(self, input: dict) -> dict:
        start = time.time()
        log = logger.bind(
            persona=self.persona,
            role=self.role,
            model=self.llm_model,
            correlation_id=input.get('correlationId'),
        )

        log.info("sub_agent_started")
        try:
            task = self.build_task(input)
            result = self.crewai_agent.execute_task(task)

            # Log de custo
            usage = result.token_usage
            cost = self._calculate_cost(usage)
            await self._log_token_usage(input, usage, cost)

            log.info("sub_agent_completed",
                duration_ms=int((time.time()-start)*1000),
                cost_usd=cost)

            return {"success": True, "output": result.raw, "cost_usd": cost}

        except Exception as e:
            log.error("sub_agent_failed", error=str(e),
                duration_ms=int((time.time()-start)*1000))
            raise

    def _calculate_cost(self, usage) -> float:
        """Calcula custo em USD baseado no modelo e tokens."""
        COST_PER_1K = {
            'claude-opus-4-8': 0.025,
            'claude-opus-4-7': 0.025,
            'claude-sonnet-4-6': 0.015,
            'claude-haiku-4-5-20251001': 0.003,
            'gemini/gemini-3.5-flash': 0.01,
            'gemini/gemini-3.1-pro': 0.02,
            'ollama/llama3.2:3b': 0.0,
        }
        rate = COST_PER_1K.get(self.llm_model, 0.01)
        return (usage.total_tokens / 1000) * rate

    async def _log_token_usage(self, input: dict, usage, cost: float):
        """Persiste o uso de tokens no banco via API."""
        import httpx
        async with httpx.AsyncClient() as client:
            await client.post(
                f"{self.config['api_url']}/internal/token-usage",
                json={
                    "agentId": input.get('agentId'),
                    "subAgentId": input.get('subAgentId'),
                    "projectId": input.get('projectId'),
                    "leadId": input.get('leadId'),
                    "provider": self.llm_model.split('/')[0],
                    "model": self.llm_model,
                    "promptTokens": usage.prompt_tokens,
                    "completionTokens": usage.completion_tokens,
                    "totalTokens": usage.total_tokens,
                    "costUsd": cost,
                    "taskType": self.role,
                }
            )
```

### 41.3 Implementação: CopywriterSubAgent

```python
# apps/agent-runtime/src/agents/builder/sub_agents/copywriter.py

from ..base_sub_agent import BaseSubAgent
from crewai import Task

class CopywriterSubAgent(BaseSubAgent):
    persona = 'builder'
    role = 'COPYWRITER'
    llm_model = 'claude-sonnet-4-6'

    def get_goal(self) -> str:
        return (
            "Criar textos profissionais, persuasivos e otimizados para SEO "
            "para todos os segmentos do site do cliente. Os textos devem "
            "refletir o tom de voz do negócio e conversar com o público-alvo."
        )

    def get_backstory(self) -> str:
        return (
            "Voce e um copywriter senior especializado em pequenos e medios "
            "negocios brasileiros. Seus textos convertem visitantes em clientes. "
            "Voce conhece cada nicho de mercado e adapta o tom de voz "
            "perfeitamente: informal para restaurantes, tecnico para clinicas, "
            "elegante para saloes."
        )

    def build_task(self, input: dict) -> Task:
        briefing = input['briefing']
        return Task(
            description=f"""
Crie todos os textos para o site de {briefing['businessName']}.

BRIEFING COMPLETO:
- Negocio: {briefing['businessName']}
- Segmento: {briefing['niche']}
- Tipo de site: {briefing['siteType']}
- Paginas: {', '.join(briefing['pages'])}
- Diferenciais: {', '.join(briefing['differentials'])}
- Publico-alvo: {briefing['targetAudience']}
- Descricao: {briefing['businessDescription']}

Para cada pagina, crie:
1. Headline principal (impactante, ate 10 palavras)
2. Subheadline (complementar, ate 20 palavras)
3. 3-4 paragrafos de conteudo
4. Call-to-action (botao)
5. Meta description (SEO, ate 160 chars)

Retorne em JSON com a estrutura:
{{
  "pages": {{
    "home": {{"headline": "", "subheadline": "", "body": "", "cta": "", "meta": ""}},
    "sobre": {{"headline": "", "body": "", "meta": ""}},
    ...
  }}
}}
""",
            expected_output="JSON com textos para todas as paginas do site",
            agent=self.crewai_agent,
        )
```

### 41.4 Implementação: ImagerSubAgent (Nano Banana Pro)

```python
# apps/agent-runtime/src/agents/builder/sub_agents/imager.py

from ..base_sub_agent import BaseSubAgent
from crewai import Task
import google.generativeai as genai
import httpx
import asyncio

class ImagerSubAgent(BaseSubAgent):
    persona = 'builder'
    role = 'IMAGER'
    llm_model = 'gemini/imagen-3.0-generate-001'   # Nano Banana Pro

    IMAGE_TYPES = ['hero', 'about', 'service_1', 'service_2', 'service_3']

    PROMPT_TEMPLATES = {
        'restaurant': {
            'hero': "Professional hero image for restaurant {name}. Warm lighting, artisanal food. Colors: {colors}. Inviting, appetizing.",
            'about': "Warm team photo in restaurant kitchen. Chef and staff smiling. Professional quality.",
        },
        'clinic': {
            'hero': "Professional hero for medical clinic {name}. Clean, modern, trustworthy. Colors: {colors}.",
            'about': "Medical professionals in clinic. Approachable, competent healthcare setting.",
        },
        'salon': {
            'hero': "Elegant hero for beauty salon {name}. Stylish, professional. Colors: {colors}.",
            'about': "Beauty professional working with client in salon. Elegant atmosphere.",
        },
        'default': {
            'hero': "Professional hero image for {niche} business {name}. Colors: {colors}. Modern, clean.",
            'about': "Professional team photo for {niche} business. Warm, approachable.",
        },
    }

    def __init__(self, config, secrets):
        super().__init__(config, secrets)
        genai.configure(api_key=secrets['gemini_key'])

    async def execute(self, input: dict) -> dict:
        briefing = input['briefing']
        niche = briefing.get('niche', 'default')
        templates = self.PROMPT_TEMPLATES.get(niche, self.PROMPT_TEMPLATES['default'])

        assets = []
        # Gerar imagens em batch (concorrente)
        tasks = []
        for image_type in self.IMAGE_TYPES:
            template = templates.get(image_type, templates.get('hero'))
            prompt = template.format(
                name=briefing['businessName'],
                niche=briefing['niche'],
                colors=', '.join(briefing.get('colorPreferences', ['azul', 'branco'])),
            )
            tasks.append(self._generate_single(image_type, prompt, briefing))

        results = await asyncio.gather(*tasks, return_exceptions=True)

        for image_type, result in zip(self.IMAGE_TYPES, results):
            if isinstance(result, Exception):
                # Tentar fallback DALL-E
                result = await self._fallback_dalle(image_type, briefing)
            assets.append(result)

        return {"assets": assets, "total_generated": len(assets)}

    async def _generate_single(self, image_type: str, prompt: str, briefing: dict) -> dict:
        model = genai.ImageGenerationModel("imagen-3.0-generate-001")
        result = model.generate_images(
            prompt=prompt,
            number_of_images=1,
            aspect_ratio="16:9" if image_type != 'service' else "4:3",
            output_mime_type="image/webp",
        )

        image_bytes = result.images[0]._image_bytes

        # Validacao obrigatoria de magic bytes
        self._validate_magic_bytes(image_bytes)

        # Upload para storage
        url = await self._upload_to_storage(image_bytes, f"{image_type}.webp")

        return {
            "type": image_type,
            "url": url,
            "provider": "nano_banana_pro",
            "synth_id_present": True,
            "magic_bytes_validated": True,
            "format": "webp",
            "resolution": "2K",
        }

    def _validate_magic_bytes(self, image_bytes: bytes) -> None:
        WEBP_MAGIC = b'RIFF'
        JPEG_MAGIC = b'\xff\xd8\xff'
        PNG_MAGIC = b'\x89PNG'

        header = image_bytes[:4]
        if not any(image_bytes[:len(m)] == m for m in [WEBP_MAGIC, JPEG_MAGIC, PNG_MAGIC]):
            raise ValueError(f"Magic bytes invalidos na imagem gerada: {header.hex()}")

        # Check por scripts embutidos (polyglot attack)
        preview = image_bytes[:200].decode('latin-1', errors='ignore')
        if '<script' in preview or '<?php' in preview:
            raise ValueError("Arquivo suspeito detectado na imagem gerada")

    def get_goal(self) -> str:
        return "Gerar imagens profissionais e contextualizadas para o site."

    def get_backstory(self) -> str:
        return "Especialista em geracao de assets visuais para sites."

    def build_task(self, input: dict) -> Task:
        return Task(
            description="Gerar imagens para o site",
            expected_output="Lista de URLs de imagens geradas",
            agent=self.crewai_agent,
        )
```

---

## 42. Integracoes de Pagamento — Planejamento para v2

Embora o gateway de pagamento esteja fora do MVP, o schema e a arquitetura devem suportar sua adicao sem quebrar o sistema existente.

### 42.1 Schema de Pagamentos (futuro)

```sql
-- Preparado para v2 — nao incluso no MVP
CREATE TYPE payment_status AS ENUM (
    'PENDING', 'PROCESSING', 'PAID', 'FAILED', 'REFUNDED', 'CANCELLED'
);

CREATE TYPE payment_provider AS ENUM (
    'STRIPE', 'MERCADO_PAGO', 'PIX_MANUAL'
);

CREATE TABLE payments (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    deal_id            UUID NOT NULL REFERENCES deals(id),
    operator_id        UUID NOT NULL REFERENCES operators(id),
    amount_cents       BIGINT NOT NULL,
    currency           TEXT NOT NULL DEFAULT 'BRL',
    provider           payment_provider NOT NULL,
    provider_payment_id TEXT,              -- ID externo (Stripe charge id, MP id)
    status             payment_status NOT NULL DEFAULT 'PENDING',
    paid_at            TIMESTAMPTZ,
    refunded_at        TIMESTAMPTZ,
    refund_reason      TEXT,
    metadata           JSONB DEFAULT '{}',
    created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE payment_webhooks (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider      payment_provider NOT NULL,
    event_type    TEXT NOT NULL,           -- payment.paid, payment.failed
    raw_payload   JSONB NOT NULL,
    processed_at  TIMESTAMPTZ,
    payment_id    UUID REFERENCES payments(id),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### 42.2 Interface de Dominio para Pagamentos

```typescript
// domain/payment/PaymentPort.ts (para v2)
interface PaymentPort {
  createCheckout(
    deal: Deal,
    options: CheckoutOptions,
  ): Promise<CheckoutSession>;
  getPaymentStatus(paymentId: string): Promise<PaymentStatus>;
  processWebhook(payload: unknown, signature: string): Promise<PaymentEvent>;
  refund(paymentId: string, reason: string): Promise<RefundResult>;
}

// Implementacoes planejadas:
// infrastructure/payment/StripeAdapter.ts
// infrastructure/payment/MercadoPagoAdapter.ts
// infrastructure/payment/PixManualAdapter.ts (para operadores sem gateway)
```

---

## 43. Extensibilidade — Como Adicionar um Novo Agente

O sistema foi projetado para que adicionar um novo agente primario (ex: Agente de Trafego Pago) nao exija modificar o codigo existente.

### 43.1 Checklist para Novo Agente

```markdown
## Checklist: Adicionar Agente de Trafego Pago

### 1. Domain

- [ ] Adicionar 'TRAFFIC' ao enum agent_persona (migration)
- [ ] Criar domain events: CampaignCreated, CampaignPublished, CampaignPaused
- [ ] Criar aggregate: Campaign com status, budget, platform

### 2. Database

- [ ] Migration: adicionar 'TRAFFIC' ao enum agent_persona
- [ ] Tabela campaigns: id, project_id, platform, status, budget_cents, metrics JSONB
- [ ] Indices relevantes

### 3. Application

- [ ] CreateCampaignCommand + Handler
- [ ] PauseCampaignCommand + Handler
- [ ] GetCampaignMetricsQuery + Handler

### 4. Infrastructure

- [ ] GoogleAdsAdapter implements TrafficPort
- [ ] MetaAdsAdapter implements TrafficPort
- [ ] TrafficRouter (ACL, escolhe provider por config)

### 5. Agent Runtime

- [ ] TrafficAgent extends BaseAgent
- [ ] Sub-agentes: KeywordResearcher, AdWriter, BudgetOptimizer, ReportGenerator
- [ ] Skills: google_ads_skill, meta_ads_skill, analytics_reader

### 6. API

- [ ] /api/v1/campaigns (CRUD)
- [ ] /api/v1/campaigns/:id/metrics
- [ ] /api/v1/campaigns/:id/pause

### 7. n8n

- [ ] Workflow: Traffic — Criacao de Campanha
- [ ] Workflow: Traffic — Otimizacao Semanal
- [ ] Workflow: Traffic — Relatorio Mensal

### 8. Testes

- [ ] Unit tests para Campaign aggregate
- [ ] BDD scenarios para criacao e pausa de campanha
- [ ] Mock dos adapters Google Ads e Meta Ads

### 9. Observabilidade

- [ ] Metrica: campaign_spend_total{platform, campaign_id}
- [ ] Metrica: campaign_conversions_total{platform}
- [ ] Alerta: campaign_budget_exhausted

### 10. Documentacao

- [ ] Seccao no PRD: Agente de Trafego Pago
- [ ] Runbook: Pausa de emergencia de campanha
- [ ] Glossario: novos termos de trafego
```

---

## 44. Metricas de Negocio e Growth

Alem das metricas tecnicas, o sistema deve rastrear indicadores de negocio que guiam decisoes de produto.

### 44.1 Funil de Conversao

```
PROSPECÇÃO (Hunter)
│  Leads encontrados no Maps/dia            → target: 100+
│  Taxa de qualificação (score >= 40)       → target: 40%
│  Taxa de aprovação HITL do operador       → target: 85%
▼
OUTREACH (Closer - 1º contato)
│  Taxa de abertura (mensagem lida)         → target: 60%
│  Taxa de resposta ao 1º contato           → target: 15%
│  Tempo médio até 1ª resposta              → target: < 24h
▼
NEGOCIAÇÃO (Closer)
│  Taxa de interesse após resposta          → target: 40%
│  Taxa de proposta enviada                 → target: 70% dos interessados
│  Taxa de fechamento (deal closed)         → target: 25% das propostas
▼
BRIEFING
│  Taxa de briefing completado              → target: 90%
│  NPS da experiência de briefing           → target: >= 8
▼
ENTREGA (Builder + QA + Delivery)
│  Taxa de aprovação QA na 1ª tentativa    → target: 70%
│  Cycles médios de correção QA             → target: < 1.5
│  Taxa de aprovação mockup na 1ª vez      → target: 60%
│  NPS do site entregue                     → target: >= 9
▼
POS-ENTREGA
│  Taxa de indicação (referrals)            → target: 20%
│  Taxa de upsell (ex: trafego, social)     → target: 15%
│  Churn (pedidos de cancelamento/reembolso)→ target: < 2%
```

### 44.2 Unit Economics

```typescript
// Calculo automatico no Cost Dashboard
interface UnitEconomics {
  // Por site entregue
  revenueBrl: number; // Receita media por site
  cogUsd: number; // Custo de tokens + APIs
  cogBrl: number; // COG em BRL
  grossMarginPct: number; // Margem bruta %
  operationalCostBrl: number; // Infra + VPS + subscricoes / volume mensal
  netMarginPct: number; // Margem liquida %

  // Por lead
  costPerLeadUsd: number; // Custo de prospectar 1 lead
  costPerQualifiedLead: number; // Custo de lead com score >= 40
  costPerSaleUsd: number; // CAC (custo de aquisicao)
  revenuePerLeadBrl: number; // Receita / total de leads

  // Eficiência
  conversionRate: number; // Leads → Clientes
  leadsToHitBreakeven: number; // Leads necessários para cobrir custo fixo
}
```

---

## 45. Configuração Inicial — Script de Setup

```bash
#!/bin/bash
# infra/scripts/setup.sh
# Script de configuração do ambiente Hefesto do zero

set -euo pipefail

echo "=== Hefesto Setup v2 ==="
echo ""

# 1. Verificar dependências
echo "1. Verificando dependências..."
command -v docker >/dev/null 2>&1 || { echo "Docker não encontrado. Instale em https://docs.docker.com/get-docker/"; exit 1; }
command -v docker-compose >/dev/null 2>&1 || { echo "docker-compose não encontrado."; exit 1; }
command -v node >/dev/null 2>&1 || { echo "Node.js não encontrado. Versão 22 LTS recomendada."; exit 1; }
command -v python3 >/dev/null 2>&1 || { echo "Python 3.12+ necessário."; exit 1; }
echo "   ✅ Dependências verificadas"

# 2. Copiar .env
echo "2. Configurando variáveis de ambiente..."
if [ ! -f .env ]; then
  cp .env.example .env
  echo "   📝 .env criado. EDITE o arquivo com suas configurações antes de continuar."
  echo "   Pressione Enter quando terminar de editar o .env..."
  read -r
else
  echo "   ✅ .env já existe"
fi

# 3. Subir serviços base
echo "3. Iniciando serviços de infraestrutura..."
docker-compose up -d postgres redis chromadb
echo "   Aguardando postgres ficar pronto..."
until docker-compose exec postgres pg_isready -U hefesto >/dev/null 2>&1; do
  sleep 2
done
echo "   ✅ PostgreSQL pronto"

# 4. Executar migrations
echo "4. Executando migrations do banco..."
cd apps/api
npm install
npx drizzle-kit push
cd ../..
echo "   ✅ Migrations executadas"

# 5. Subir serviços adicionais
echo "5. Iniciando todos os serviços..."
docker-compose up -d
echo "   Aguardando Ollama..."
until curl -s http://localhost:11434/api/tags >/dev/null 2>&1; do sleep 3; done
echo "   ✅ Ollama pronto"

# 6. Baixar modelos Ollama
echo "6. Baixando modelos LLM locais (isso pode levar alguns minutos)..."
docker-compose exec ollama ollama pull llama3.2:3b
docker-compose exec ollama ollama pull nomic-embed-text
echo "   ✅ Modelos baixados"

# 7. Criar coleções RAG
echo "7. Configurando coleções RAG no ChromaDB..."
python3 infra/scripts/seed_rag.py
echo "   ✅ RAG configurado"

# 8. Importar workflows n8n
echo "8. Importando workflows no n8n..."
for workflow in infra/n8n/workflows/*.json; do
  curl -s -X POST http://localhost:5678/api/v1/workflows \
    -H "X-N8N-API-KEY: $N8N_API_KEY" \
    -H "Content-Type: application/json" \
    -d @"$workflow" >/dev/null
  echo "   Importado: $workflow"
done
echo "   ✅ Workflows importados"

# 9. Configurar Telegram bots
echo "9. Configurando Telegram bots..."
echo "   Bot HITL (Bot 1): configure o webhook em:"
echo "   https://api.telegram.org/bot${TELEGRAM_HITL_BOT_TOKEN}/setWebhook?url=${API_PUBLIC_URL}/webhooks/telegram/hitl"
echo ""
echo "   Bot Vendas (Bot 2): configure o webhook em:"
echo "   https://api.telegram.org/bot${TELEGRAM_SALES_BOT_TOKEN}/setWebhook?url=${API_PUBLIC_URL}/webhooks/telegram/sales"

echo ""
echo "=== Setup Concluído! ==="
echo ""
echo "URLs de acesso:"
echo "  Painel Hefesto: http://localhost:3000"
echo "  API:              http://localhost:3001"
echo "  n8n:              http://localhost:5678"
echo "  Grafana:          http://localhost:3200"
echo "  Cal.com:          http://localhost:3100"
echo ""
echo "Próximos passos:"
echo "  1. Acesse http://localhost:3000 e crie sua conta de operador"
echo "  2. Configure os agentes Hunter e Closer no painel"
echo "  3. Adicione sua API key do Google Maps nas configurações"
echo "  4. Configure o número WhatsApp no Evolution API"
echo "  5. Execute o primeiro teste de prospecção manual"
```

---

## 46. Notas de Implementação — Considerações Importantes

### 46.1 Polyglot Node.js + Python: Decisão Arquitetural

O sistema usa dois runtimes distintos:

- **Node.js/TypeScript**: API principal, banco, autenticação, HITL, CRM
- **Python**: CrewAI, LiteLLM, agentes, sub-agentes

Esta decisão tem prós e contras que o time deve conhecer:

**Prós:**

- CrewAI e LiteLLM são maturos em Python — melhores bibliotecas disponíveis
- LangChain, ChromaDB, embeddings — ecossistema Python superior
- Separação clara de responsabilidades: API vs Runtime de Agentes

**Contras:**

- Dois runtimes = dois Dockerfiles, dois deploys, mais complexidade ops
- Comunicação via HTTP interno (latência ~1ms por chamada)
- Dois conjuntos de dependências para manter

**Mitigação:**

- Contratos HTTP bem definidos (OpenAPI spec para a API interna)
- Docker Compose garante rede interna (sem latência de rede externa)
- Se escalar para muitos sites simultâneos: considerar LangChain.js para unificar
- Documentar a fronteira clara: "tudo que envolve LLM vai para Python"

### 46.2 Sobre o Vibe Coding no Contexto deste PRD

Este projeto usa a metodologia GSD (Get Shit Done) com vibe coding assistido por IA.
Isso significa velocidade alta de implementação, mas requer disciplina extra:

```
REGRAS DO VIBE CODING SEGURO:
1. Nunca gerar código sem TDD — IA pode gerar código funcionando mas inseguro
2. Sempre revisar o código gerado antes de commitar — especialmente adapters externos
3. HITL obrigatório antes de qualquer ação externa — mesmo que a IA "pareça certa"
4. Security tests BLOQUEANTES no CI — não há exceção
5. Magic bytes em todo upload/geração — mesmo que a fonte seja "confiável"
6. PRD é a fonte da verdade — qualquer divergência, o PRD ganha
7. Audit log de tudo — se não está no log, não aconteceu
```

### 46.3 SynthID e Responsabilidade sobre Imagens Geradas por IA

O Nano Banana Pro aplica SynthID automaticamente em todas as imagens geradas.
O sistema deve:

1. Registrar `synth_id_present: true` em todos os assets do Nano Banana Pro
2. Na entrega ao cliente, incluir no PDF:
   _"As imagens do seu site foram geradas com auxílio de inteligência artificial
   e contêm uma marca d'água digital (SynthID) para rastreabilidade."_
3. O cliente tem o direito de solicitar imagens próprias — o sistema aceita uploads
   no Briefing Agent como alternativa às imagens geradas
4. Nunca usar imagens geradas por IA que contenham rostos reconhecíveis de pessoas reais
5. O prompt do IMAGER sub-agent deve explicitamente evitar: "no real people faces, no brands, no logos"

### 46.4 Limitações Conhecidas do MVP

1. **Sem suporte a sites em inglês**: todos os templates, prompts e workflows estão em pt-BR. Internacionalização é v2+.
2. **Sites estáticos apenas**: sem backend próprio para os sites entregues. E-commerce usa plataformas externas (Nuvemshop, WooCommerce). Sistemas customizados são v2+.
3. **Um operador por instância**: multi-tenant é v2+. Cada operador deve ter sua própria instalação no MVP.
4. **Sem fine-tuning de modelos**: os modelos base são usados com system prompts. Fine-tuning por nicho é v2+.
5. **Agendamento limitado**: Cal.com é configurado manualmente pelo operador. UI de gestão de tipos de evento é v2+.
6. **HeyGen síncrono**: tutoriais em vídeo podem levar 2-5 minutos para gerar. O sistema aguarda assincronamente, mas o cliente recebe o vídeo com algum delay.

---

_FIM DO PRD HEFESTO v2.0.0_

_Documento gerado e revisado em: 2026-05-29_  
_Versão: 2.0.0 | Seções: 46 | Status: Pronto para implementação_

---

---

## 47. Detalhamento do Sistema HITL — Fluxo Completo

### 47.1 Estados de um HITL Approval

```
PENDING ──► APPROVED
    │
    ├──► REJECTED
    │
    ├──► EDITED_APPROVED (operador editou e aprovou)
    │
    └──► EXPIRED (timeout sem decisão → rejeição automática)
```

### 47.2 Interface de Aprovação Telegram (Bot 1 — HITL)

O operador recebe notificações no Telegram com botões inline para aprovar, rejeitar ou editar sem abrir o painel:

```typescript
// infrastructure/messaging/TelegramHITLBot.ts

class TelegramHITLBot {
  private buildApprovalMessage(approval: HITLApproval): string {
    const icons: Record<string, string> = {
      SEND_EXTERNAL_MESSAGE: "📨",
      SEND_PROPOSAL: "📋",
      APPROVE_MOCKUP: "🎨",
      APPROVE_STAGING: "🌐",
      DEPLOY_SITE: "🚀",
    };

    return `
${icons[approval.actionType] ?? "⚡"} *APROVAÇÃO NECESSÁRIA*

*Tipo:* ${approval.actionType}
*Contexto:* ${approval.contextType} #${approval.contextId.slice(0, 8)}
*Expira em:* ${approval.expiresAt.toLocaleString("pt-BR")}

*Preview:*
\`\`\`json
${JSON.stringify(approval.payloadPreview, null, 2).slice(0, 800)}
\`\`\`

_Clique para decidir:_
    `.trim();
  }

  private buildInlineKeyboard(approvalId: string): TelegramInlineKeyboard {
    return {
      inline_keyboard: [
        [
          { text: "✅ APROVAR", callback_data: `hitl:approve:${approvalId}` },
          { text: "❌ REJEITAR", callback_data: `hitl:reject:${approvalId}` },
        ],
        [
          {
            text: "✏️ EDITAR E APROVAR",
            callback_data: `hitl:edit:${approvalId}`,
          },
          {
            text: "🔍 VER COMPLETO",
            url: `${process.env.FRONTEND_URL}/hitl/${approvalId}`,
          },
        ],
      ],
    };
  }

  async handleCallbackQuery(query: TelegramCallbackQuery): Promise<void> {
    const [prefix, action, approvalId] = query.data.split(":");
    if (prefix !== "hitl") return;

    switch (action) {
      case "approve":
        await this.api.post(`/api/v1/hitl/${approvalId}/approve`, {
          note: "Aprovado via Telegram",
        });
        await this.editMessage(
          query.message.chat.id,
          query.message.message_id,
          "✅ *APROVADO* — Ação executada com sucesso.",
        );
        break;

      case "reject":
        await this.api.post(`/api/v1/hitl/${approvalId}/reject`, {
          note: "Rejeitado via Telegram",
        });
        await this.editMessage(
          query.message.chat.id,
          query.message.message_id,
          "❌ *REJEITADO* — Ação cancelada.",
        );
        break;

      case "edit":
        // Redirecionar para painel web para edição complexa
        await this.answerCallbackQuery(
          query.id,
          `Abra o painel para editar: ${process.env.FRONTEND_URL}/hitl/${approvalId}`,
        );
        break;
    }
  }
}
```

### 47.3 HITL Timeout Handler

```typescript
// application/hitl/HITLTimeoutUseCase.ts

class HITLTimeoutUseCase {
  // Executado pelo BullMQ a cada 5 minutos
  async processExpiredApprovals(): Promise<void> {
    const expired = await this.hitlRepo.findExpired();

    for (const approval of expired) {
      // Marcar como EXPIRED
      await this.hitlRepo.updateStatus(approval.id, "EXPIRED");

      // Emitir evento para o Orchestrator
      await this.eventBus.publish({
        eventType: "HITLExpired",
        aggregateId: approval.id,
        payload: {
          approvalId: approval.id,
          actionType: approval.actionType,
          contextId: approval.contextId,
          contextType: approval.contextType,
          expiredAt: new Date().toISOString(),
        },
      });

      // Notificar operador sobre o timeout
      await this.telegramHITL.sendMessage(
        process.env.TELEGRAM_OPERATOR_CHAT_ID!,
        `⏰ *HITL EXPIRADO*\n\nA aprovação para *${approval.actionType}* expirou sem decisão.\n` +
          `O agente foi pausado automaticamente. Acesse o painel para retomar.`,
      );

      // Registrar no audit log
      await this.auditLog.record("HITL_EXPIRED", {
        approvalId: approval.id,
        actionType: approval.actionType,
        expiredAt: new Date(),
      });
    }
  }
}
```

### 47.4 Payload Preview — Mascaramento de PII

```typescript
// domain/hitl/HITLPayloadMasker.ts

class HITLPayloadMasker {
  mask(payload: Record<string, unknown>): Record<string, unknown> {
    const PII_KEYS = [
      "email",
      "phone",
      "contactPhone",
      "contactEmail",
      "cpf",
      "cnpj",
      "address",
      "password",
    ];
    const PARTIAL_MASK_KEYS = ["contactName", "businessName"];

    const masked = { ...payload };

    for (const key of PII_KEYS) {
      if (key in masked) {
        masked[key] = "***REDACTED***";
      }
    }

    for (const key of PARTIAL_MASK_KEYS) {
      if (key in masked && typeof masked[key] === "string") {
        const val = masked[key] as string;
        // Mostrar apenas primeiros 3 chars: "João" → "Joã***"
        masked[key] = val.slice(0, 3) + "***";
      }
    }

    // Mascarar mensagem de WhatsApp (exibir apenas preview)
    if ("message" in masked && typeof masked.message === "string") {
      masked.message = (masked.message as string).slice(0, 150) + "...";
      masked.message_full_in_vault = true;
    }

    return masked;
  }
}
```

---

## 48. Estratégia de Cache e Performance

### 48.1 Camadas de Cache

```typescript
// infrastructure/cache/CacheStrategy.ts

enum CacheTTL {
  MAPS_SEARCH_RESULT = 86400, // 24h — resultados do Google Maps
  LEAD_SCORE = 3600, // 1h — score de qualificação
  RAG_QUERY_RESULT = 1800, // 30min — resultados de RAG
  AGENT_CONFIG = 300, // 5min — configuração de agente
  TEMPLATE_LIST = 3600, // 1h — lista de templates
  LIGHTHOUSE_SCORE = 86400, // 24h — score de site já entregue
  CNPJ_VALIDATION = 604800, // 7 dias — CNPJ não muda frequentemente
}

class CacheService {
  constructor(private redis: Redis) {}

  async get<T>(key: string): Promise<T | null> {
    const raw = await this.redis.get(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  }

  async set<T>(key: string, value: T, ttl: CacheTTL): Promise<void> {
    await this.redis.setex(key, ttl, JSON.stringify(value));
  }

  async invalidate(pattern: string): Promise<void> {
    const keys = await this.redis.keys(pattern);
    if (keys.length > 0) await this.redis.del(...keys);
  }

  // Cache de resultados do Google Maps — evita desperdiçar quota
  mapsKey(category: string, region: string): string {
    const today = new Date().toISOString().slice(0, 10);
    return `maps:${category}:${region}:${today}`;
  }

  // Cache de validação CNPJ — dados governamentais mudam raramente
  cnpjKey(cnpj: string): string {
    return `cnpj:${cnpj.replace(/\D/g, "")}`;
  }

  // Cache de RAG — mesmas queries recorrentes
  ragKey(collection: string, query: string): string {
    const hash = this.simpleHash(query);
    return `rag:${collection}:${hash}`;
  }

  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = (hash << 5) - hash + str.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash).toString(36);
  }
}
```

### 48.2 Connection Pooling (pgbouncer)

```ini
# infra/pgbouncer/pgbouncer.ini

[databases]
hefesto = host=postgres port=5432 dbname=hefesto

[pgbouncer]
listen_port = 6432
listen_addr = 0.0.0.0
auth_type = md5
auth_file = /etc/pgbouncer/userlist.txt
pool_mode = transaction       ; transaction pooling = melhor performance
max_client_conn = 200
default_pool_size = 25
min_pool_size = 5
reserve_pool_size = 5
reserve_pool_timeout = 3
server_idle_timeout = 600
log_connections = 0
log_disconnections = 0
```

### 48.3 Queue de Sub-agentes com BullMQ

```typescript
// infrastructure/queue/SubAgentQueue.ts

import { Queue, Worker, Job } from "bullmq";

const SUB_AGENT_QUEUE = "sub-agent-tasks";

// Producer (API)
class SubAgentQueueProducer {
  private queue: Queue;

  constructor(redis: Redis) {
    this.queue = new Queue(SUB_AGENT_QUEUE, {
      connection: redis,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: "exponential", delay: 2000 },
        removeOnComplete: 100,
        removeOnFail: 500,
      },
    });
  }

  async enqueue(subAgentJob: SubAgentJob): Promise<string> {
    const job = await this.queue.add(
      `${subAgentJob.persona}:${subAgentJob.role}`,
      subAgentJob,
      {
        priority: this.getPriority(subAgentJob.role),
        // Agentes de entrega têm prioridade maior que prospecção
      },
    );
    return job.id!;
  }

  private getPriority(role: string): number {
    const priorities: Record<string, number> = {
      NOTIFIER: 1, // Mais alta — entrega ao cliente
      SEC_AUDITOR: 2, // Segurança é crítica
      CODER: 3,
      CONV_HANDLER: 4, // Negociação em andamento
      OUTREACH_WRITER: 5,
      COPYWRITER: 6,
      DESIGNER: 6,
      IMAGER: 6,
      PROSPECTOR: 10, // Mais baixa — background task
    };
    return priorities[role] ?? 5;
  }
}

// Consumer (Agent Runtime Python consome via API HTTP)
// O worker Python faz long-polling no endpoint /internal/queue/next
// ou usa websocket para receber jobs

// Worker TypeScript para jobs simples (deploy, SEO)
class SubAgentQueueWorker {
  private worker: Worker;

  constructor(redis: Redis) {
    this.worker = new Worker(
      SUB_AGENT_QUEUE,
      async (job: Job) => {
        const { persona, role, payload } = job.data;

        // Jobs Python são despachados para o agent-runtime
        if (this.isPythonJob(role)) {
          await fetch(
            `${process.env.AGENT_RUNTIME_URL}/agents/${persona}/sub-agents/${role}/run`,
            {
              method: "POST",
              body: JSON.stringify(payload),
            },
          );
          return;
        }

        // Jobs TypeScript são executados aqui mesmo
        return await this.executeTypescriptJob(role, payload);
      },
      { connection: redis, concurrency: 10 },
    );

    this.worker.on("failed", (job, err) => {
      logger.error("sub_agent_job_failed", {
        jobId: job?.id,
        role: job?.data?.role,
        error: err.message,
        attempts: job?.attemptsMade,
      });
    });
  }

  private isPythonJob(role: string): boolean {
    const pythonRoles = [
      "PROSPECTOR",
      "SITE_INSPECTOR",
      "DATA_ENRICHER",
      "OUTREACH_WRITER",
      "CONV_HANDLER",
      "PROPOSAL_WRITER",
      "INTERVIEWER",
      "BRIEF_EXTRACTOR",
      "COPYWRITER",
      "DESIGNER",
      "IMAGER",
      "CODER",
      "SEC_AUDITOR",
      "PERF_AUDITOR",
      "TUTORIAL_GENERATOR",
    ];
    return pythonRoles.includes(role);
  }
}
```

---

## 49. Testes de Integração — Configuração com Testcontainers

```typescript
// tests/integration/setup.ts

import {
  PostgreSqlContainer,
  StartedPostgreSqlContainer,
} from "@testcontainers/postgresql";
import { RedisContainer, StartedRedisContainer } from "@testcontainers/redis";
import { GenericContainer, StartedTestContainer } from "testcontainers";

let postgres: StartedPostgreSqlContainer;
let redis: StartedRedisContainer;
let chromadb: StartedTestContainer;

beforeAll(async () => {
  // Postgres real para testes de integração
  postgres = await new PostgreSqlContainer("postgres:16-alpine")
    .withDatabase("hefesto_test")
    .withUsername("test")
    .withPassword("test")
    .start();

  // Redis real para BullMQ e cache
  redis = await new RedisContainer("redis:7-alpine").start();

  // ChromaDB real para RAG
  chromadb = await new GenericContainer("chromadb/chroma:latest")
    .withExposedPorts(8000)
    .start();

  // Configurar variáveis de ambiente para os testes
  process.env.DATABASE_URL = postgres.getConnectionUri();
  process.env.REDIS_URL = `redis://${redis.getHost()}:${redis.getFirstMappedPort()}`;
  process.env.CHROMA_URL = `http://${chromadb.getHost()}:${chromadb.getMappedPort(8000)}`;

  // Executar migrations no banco de teste
  await runMigrations(process.env.DATABASE_URL);

  console.log("✅ Testcontainers iniciados");
}, 60000);

afterAll(async () => {
  await Promise.all([postgres.stop(), redis.stop(), chromadb.stop()]);
});

// Limpar dados entre testes (não entre suites)
beforeEach(async () => {
  await db.execute(sql`TRUNCATE TABLE leads, deals, briefings, projects, messages,
    hitl_approvals, audit_log, token_usage_log CASCADE`);
});
```

```typescript
// tests/integration/hunter/lead_qualification.test.ts

describe("Hunter: Qualificação de Lead via Google Maps", () => {
  let mapsAdapterMock: jest.Mocked<GoogleMapsAdapter>;
  let mcpBrasilMock: jest.Mocked<MCPBrasilAdapter>;

  beforeEach(() => {
    // Mock dos serviços externos — nunca chamar APIs reais em testes
    mapsAdapterMock = {
      searchLeads: jest.fn().mockResolvedValue([
        {
          id: "ChIJtest123",
          displayName: { text: "Bella Napoli Pizzaria" },
          formattedAddress: "Rua Teste, 123, Salvador, BA",
          nationalPhoneNumber: "+55 71 99999-0000",
          websiteUri: undefined, // Sem site = lead quente
          rating: 4.8,
          userRatingCount: 234,
        },
      ]),
    } as any;

    mcpBrasilMock = {
      consultarCNPJ: jest.fn().mockResolvedValue({
        cnpj: "12.345.678/0001-90",
        situacaoCadastral: "ATIVA",
        dataAbertura: "2020-03-15",
        nomeFantasia: "Bella Napoli",
      }),
    } as any;
  });

  test("deve qualificar lead sem site com CNPJ ativo", async () => {
    const useCase = new QualifyLeadUseCase(
      leadRepo,
      mapsAdapterMock,
      mcpBrasilMock,
      scoringService,
      hitlService,
    );

    const result = await useCase.execute({
      category: "restaurant",
      region: "Salvador, BA",
      minScore: 40,
    });

    expect(result.qualifiedLeads).toHaveLength(1);
    expect(result.qualifiedLeads[0].qualificationScore).toBeGreaterThanOrEqual(
      60,
    );
    expect(result.qualifiedLeads[0].enrichmentData.cnpjStatus).toBe("ATIVA");
    expect(result.qualifiedLeads[0].enrichmentData.hasWebsite).toBe(false);

    // Verificar que HITL foi criado
    const hitls = await hitlRepo.findPending(operatorId);
    expect(hitls).toHaveLength(1);
    expect(hitls[0].actionType).toBe("APPROVE_LEAD_LIST");
  });

  test("deve bloquear lead com CNPJ suspenso", async () => {
    mcpBrasilMock.consultarCNPJ.mockResolvedValue({
      cnpj: "12.345.678/0001-90",
      situacaoCadastral: "SUSPENSA", // CNPJ suspenso
      dataAbertura: "2020-03-15",
    });

    const useCase = new QualifyLeadUseCase(
      leadRepo,
      mapsAdapterMock,
      mcpBrasilMock,
      scoringService,
      hitlService,
    );

    const result = await useCase.execute({
      category: "restaurant",
      region: "Salvador, BA",
      minScore: 40,
    });

    // Lead bloqueado pela rule block_suspended_cnpj
    expect(result.qualifiedLeads).toHaveLength(0);
    expect(result.blockedLeads).toHaveLength(1);
    expect(result.blockedLeads[0].blockReason).toBe("block_suspended_cnpj");

    // Nenhum HITL criado para lead bloqueado
    const hitls = await hitlRepo.findPending(operatorId);
    expect(hitls).toHaveLength(0);
  });

  test("deve deduplicar lead com mesmo Maps Place ID nos últimos 30 dias", async () => {
    // Criar lead existente com mesmo place_id
    await leadRepo.create({
      contactName: "João",
      source: "GOOGLE_MAPS",
      enrichmentData: { googleMapsPlaceId: "ChIJtest123" },
      createdAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000), // 15 dias atrás
    });

    const useCase = new QualifyLeadUseCase(
      leadRepo,
      mapsAdapterMock,
      mcpBrasilMock,
      scoringService,
      hitlService,
    );

    const result = await useCase.execute({
      category: "restaurant",
      region: "Salvador, BA",
      minScore: 40,
    });

    // Lead ignorado por deduplicação
    expect(result.qualifiedLeads).toHaveLength(0);
    expect(result.skippedLeads[0].skipReason).toBe("duplicate_within_30_days");
  });
});
```

---

## 50. Guia do Operador — Primeiros Passos

### 50.1 Configurando o Hunter pela Primeira vez

```markdown
# Guia: Configurar o Agente Hunter

## Passo 1: Criar o Agente Hunter

1. Acesse o painel → Agentes → Novo Agente
2. Preencha:
   - Nome: "Hunter Principal"
   - Persona: HUNTER
   - Status: INATIVO (até terminar a configuração)

## Passo 2: Configurar o LLM do Hunter

O Hunter em si usa Gemini 3.5 Flash para ser rápido e econômico:

- Provider: GEMINI
- Modelo: gemini/gemini-3.5-flash
- API Key: [sua chave Gemini]
- Temperatura: 0.1 (mais determinístico para extração de dados)
- Max Tokens: 4096

## Passo 3: Configurar Sub-agentes

### Sub-agente 1: PROSPECTOR

- Role: PROSPECTOR
- Provider: GEMINI | Modelo: gemini/gemini-3.5-flash
- Execution Mode: PARALLEL | Parallel Group: 1
- Max Retries: 2 | Timeout: 60s

### Sub-agente 2: SITE_INSPECTOR

- Role: SITE_INSPECTOR
- Provider: GEMINI | Modelo: gemini/gemini-3.5-flash
- Execution Mode: PARALLEL | Parallel Group: 1 (mesmo grupo do PROSPECTOR)
- Max Retries: 2 | Timeout: 30s

### Sub-agente 3: DATA_ENRICHER

- Role: DATA_ENRICHER
- Provider: OLLAMA | Modelo: llama3.2:3b (gratuito!)
- Execution Mode: SEQUENTIAL
- Max Retries: 3 | Timeout: 20s

## Passo 4: Adicionar Skills

### Skill: Google Maps Prospector

- Tipo: external_database
- Provider: google_maps
- API Key: [sua chave Google Maps]
- Raio de Busca: 10 km
- Categorias: selecione as que deseja prospectar
- Filtros: sem site, rating ≥ 3.5, reviews ≥ 10

### Skill: MCP Brasil

- Tipo: external_database
- Provider: mcp_brasil
- URL: http://mcp-brasil:8000/mcp
- Tools: brasilapi_consultar_cnpj, brasilapi_consultar_cep

## Passo 5: Configurar HITL

- Timeout: 60 minutos
- Canal de notificação: Telegram
- Ações que requerem aprovação:
  ✅ APPROVE_LEAD_LIST (obrigatório)

## Passo 6: Configurar Prospecção

- Acesse: Prospecção → Configuração
- Defina:
  - Região: Salvador, BA (ou sua cidade)
  - Categorias: Restaurantes, Salões, Clínicas
  - Score mínimo: 40
  - Horário de execução: 09:00 (dias úteis)

## Passo 7: Ativar e Testar

1. Ative o agente (Status → ATIVO)
2. Execute uma prospecção manual: Prospecção → Executar Agora
3. Aguarde a notificação no Telegram
4. Revise a lista de leads no painel
5. Aprove os leads desejados
```

### 50.2 Configurando o Closer pela primeira vez

```markdown
# Guia: Configurar o Agente Closer

## Passo 1: Vincular WhatsApp

1. Acesse: Configurações → WhatsApp → Conectar Número
2. Escaneie o QR Code com seu WhatsApp
3. Aguarde confirmação de conexão
4. Teste: envie uma mensagem de teste para você mesmo

## Passo 2: Vincular Telegram (opcional)

1. Acesse: Configurações → Telegram → Novo Bot de Vendas
2. Crie um bot no @BotFather e copie o token
3. Cole o token no painel
4. Configure o webhook (o sistema faz automaticamente)

## Passo 3: Configurar Templates de Outreach

Acesse: Closer → RAG → Templates de Proposta

Faça upload do arquivo `proposal_templates.md` com seus modelos de mensagem personalizados.

O sistema usa esses templates como base e o Claude Sonnet personaliza para cada lead.

## Passo 4: Configurar Preços

Acesse: Closer → Configurações → Precificação

Defina:

- Preço base: R$ 800 (padrão)
- Multiplicador e-commerce: 2x
- Adicional agendamento: R$ 250
- Adicional copywriting: R$ 300
- Máximo sem override humano: R$ 5.000

## Passo 5: Testar o Fluxo Completo

1. Aprove um lead qualificado (do Hunter)
2. O Closer gerará uma mensagem de abordagem
3. Você receberá a mensagem no Telegram para aprovar
4. Aprove e verifique se chegou no WhatsApp do contato
5. Simule uma resposta e veja o Conv. Handler responder
```

---

## 51. Matriz de Custos Detalhada por Cenário

### 51.1 Cenário: 10 sites/mês (pequena escala)

```
CUSTOS FIXOS MENSAIS:
  VPS Hetzner (2 vCPU, 4GB RAM):        R$ 25
  Domínio próprio do operador:           R$ 3  (anual / 12)
  Total fixo:                            R$ 28/mês

CUSTOS VARIÁVEIS (por site):
  LLM tokens (média):                    R$ 8
  Nano Banana Pro (8 imagens):           R$ 12
  HeyGen (1 vídeo tutorial):             R$ 2,50
  Brevo (e-mails):                       R$ 0  (free tier)
  Google Maps:                           R$ 0  (free tier)
  Cal.com:                               R$ 0  (self-hosted)
  Total variável por site:               ~R$ 22,50

CUSTO TOTAL (10 sites/mês):
  Fixo:          R$ 28
  Variável:      R$ 225
  Total:         R$ 253/mês

RECEITA (10 sites × R$ 800 médio):      R$ 8.000/mês
MARGEM BRUTA:                           R$ 7.747/mês (96.8%)
```

### 51.2 Cenário: 50 sites/mês (escala média)

```
CUSTOS FIXOS MENSAIS:
  VPS Hetzner (4 vCPU, 8GB RAM):        R$ 60
  Google Maps upgrade (além do free):    R$ 0  (ainda no free tier c/ cache)
  Total fixo:                            R$ 60/mês

CUSTOS VARIÁVEIS (50 sites):
  LLM tokens:                            R$ 400
  Nano Banana Pro:                       R$ 600
  HeyGen:                                R$ 125
  Total variável:                        R$ 1.125

CUSTO TOTAL (50 sites/mês):             R$ 1.185/mês
RECEITA (50 × R$ 900 médio):            R$ 45.000/mês
MARGEM BRUTA:                           R$ 43.815/mês (97.4%)
```

### 51.3 Cenário: 200 sites/mês (alta escala)

```
CUSTOS FIXOS MENSAIS:
  VPS Hetzner (8 vCPU, 16GB RAM) × 2:  R$ 250
  Google Maps upgrade:                   R$ 1.000 (além do free)
  Brevo Pro (>300 emails/dia):           R$ 100
  Total fixo:                            R$ 1.350/mês

CUSTOS VARIÁVEIS (200 sites):
  LLM tokens:                            R$ 1.600
  Nano Banana Pro:                       R$ 2.400
  HeyGen:                                R$ 500
  Total variável:                        R$ 4.500

CUSTO TOTAL (200 sites/mês):            R$ 5.850/mês
RECEITA (200 × R$ 1.000 médio):         R$ 200.000/mês
MARGEM BRUTA:                           R$ 194.150/mês (97.1%)

NOTA: A 200 sites/mês, considere:
  - Contratar um humano para revisar HITL (R$ 3.000/mês)
  - Fine-tuning de modelos por nicho (reduz custo em ~30%)
  - Desconto de volume com Anthropic Enterprise
  Margem ajustada:                       ~94%
```

---

## 52. Changelog e Controle de Versão do PRD

### Histórico de Versões

```markdown
## v2.0.0 — 2026-05-29 (versão atual)

### Adicionado

- Agente Briefing (novo bounded context, 2 sub-agentes)
- Agente Delivery (novo bounded context, 3 sub-agentes)
- Agente Orchestrator com máquina de estados completa
- 17 sub-agentes especificados (4 Hunter, 4 Closer, 2 Briefing, 6 Builder, 3 QA, 3 Delivery)
- LLM Routing Strategy por tier de custo (seção 9)
- Estratégia de paralelismo com grupos de execução (seção 10)
- MediaGenerationService com Nano Banana Pro como primário (seção 11)
- Integração Google Maps Places API (seção 12)
- Integração MCP Brasil — CNPJ/CEP sem chave de API (seção 12)
- TelegramAdapter dual-bot: HITL + canal de vendas (seção 13)
- Cal.com agendamento self-hosted (seção 14)
- Cloudflare Pages, Render e Hostinger como plataformas de deploy (seção 8)
- Claude Design via Opus 4.7 para mockup visual (seção 11)
- HeyGen para tutoriais em vídeo na entrega (seção 8)
- Deal Tracker sub-agent com cadência de follow-up (seção 8)
- Cost Dashboard e token_usage_log (seção 19, 21)
- 6 dashboards Grafana obrigatórios (seção 21)
- LGPD: política de dados, mascaramento PII, opt-out automático (seção 36)
- Runbooks: WhatsApp ban, Maps quota, LLM fallback, Nano Banana fallback (seção 32)
- Definição de Done detalhada por categoria (seção 33)
- Workflows n8n detalhados (seção 28)
- Docker Compose completo com todos os serviços (seção 30)
- Guia do Operador (seção 50)
- Matriz de Custos por cenário (seção 51)

### Modificado

- system_prompt: limite expandido de 8.000 para 32.000 chars
- agent_persona enum: adicionado BRIEFING e DELIVERY
- llm_provider enum: adicionado GEMINI
- message_channel enum: adicionado TELEGRAM
- project_status enum: adicionado DESIGNING e STAGING
- Schema SQL: 8 novas tabelas, 15 novas colunas em tabelas existentes
- Cobertura de testes: security_tests agora 100% obrigatório no CI

### Removido

- Replicate como provider de imagens (substituído por Nano Banana Pro)
- nano-banana identificado como aplicação Google, não ferramenta independente

## v1.0.0 — 2026-04 (versão inicial)

### Contexto

- Versão inicial do PRD com Hunter, Closer e Builder como agentes monolíticos
- Sem sub-agentes, sem paralelismo, sem MediaGenerationService
- Sem Google Maps, sem MCP Brasil, sem Cal.com
- system_prompt limitado a 8.000 chars
- Apenas WhatsApp como canal de mensageria
- Apenas Vercel e Netlify como plataformas de deploy
```

### Processo de Atualização do PRD

```markdown
## Como Atualizar Este PRD

1. **Nunca editar diretamente em produção** — criar branch `prd/descricao-da-mudanca`
2. **Registrar no Changelog** (seção 52) com:
   - Versão semântica (MAJOR.MINOR.PATCH)
   - Data da mudança
   - Categorias: Adicionado | Modificado | Removido | Corrigido
3. **Atualizar o índice** se uma nova seção foi criada
4. **Review obrigatório** por 1 pessoa além do autor
5. **Merge apenas após** todos os impactos no código terem Issues criadas no GitHub
6. **Comunicar o time** via Telegram/Slack sobre mudanças críticas

## Critérios para Bump de Versão

- MAJOR (x.0.0): mudança arquitetural significativa (ex: novo bounded context)
- MINOR (x.y.0): nova feature ou agente (ex: novo sub-agente)
- PATCH (x.y.z): correção de inconsistência, clarificação, typo
```

---

## 53. Referências e Recursos

### Ferramentas e Documentação

```markdown
## LLM e IA

- Anthropic API: https://docs.anthropic.com
- Claude Design: https://support.claude.com/pt/articles/14604416-comece-com-claude-design
- Gemini API (Nano Banana Pro): https://ai.google.dev/gemini-api/docs/imagen
- LiteLLM: https://docs.litellm.ai
- CrewAI: https://docs.crewai.com
- LangChain: https://python.langchain.com

## Infraestrutura

- n8n: https://docs.n8n.io
- ChromaDB: https://docs.trychroma.com
- BullMQ: https://docs.bullmq.io
- Ollama: https://ollama.com/library

## Mensageria

- Evolution API: https://doc.evolution-api.com
- Telegram Bot API: https://core.telegram.org/bots/api
- Telegraf.js: https://telegraf.js.org

## Prospecção

- Google Maps Places API (New): https://developers.google.com/maps/documentation/places/web-service/op-overview
- MCP Brasil: https://github.com/Mcp-Brasil/mcp-brasil
- Apollo.io API: https://apolloio.github.io/apollo-api-docs/

## Deploy

- Vercel: https://vercel.com/docs
- Cloudflare Pages: https://developers.cloudflare.com/pages
- Render: https://render.com/docs

## Agendamento

- Cal.com: https://cal.com/docs
- Cal.com API: https://cal.com/docs/api-reference

## Segurança

- OWASP Top 10: https://owasp.org/www-project-top-ten
- OWASP ZAP: https://www.zaproxy.org
- Argon2: https://github.com/ranisalt/node-argon2
- LGPD: https://www.gov.br/esporte/pt-br/acesso-a-informacao/lgpd

## Observabilidade

- Prometheus: https://prometheus.io/docs
- Grafana: https://grafana.com/docs
- Jaeger: https://www.jaegertracing.io/docs
- OpenTelemetry: https://opentelemetry.io/docs

## Entrega de Sites

- Next.js 15: https://nextjs.org/docs
- Tailwind CSS 4: https://tailwindcss.com/docs
- Formspree: https://formspree.io/docs
- Cal.com Atoms: https://cal.com/docs/platform/atoms
```

---

_PRD Hefesto v2.0.0 — DOCUMENTO COMPLETO_
_Total de seções: 53 | Status: Aprovado para Implementação_
_Salvador, Bahia — 2026-05-29_

---

## 54. Especificação do Painel Web — Componentes Principais

### 54.1 Dashboard Principal

```typescript
// apps/web/src/app/(dashboard)/page.tsx — Overview do Operador

// Métricas exibidas na home do painel:
interface DashboardMetrics {
  // Pipeline atual
  leadsProspectedToday: number;
  leadsInNegotiation: number;
  hitlPendingCount: number; // Alerta vermelho se > 0
  projectsInProgress: number;
  sitesDeliveredThisMonth: number;

  // Financeiro
  revenueThisMonthBrl: number;
  avgSitePriceThisMonth: number;
  tokenCostThisMonthUsd: number; // Custo real em LLM
  marginPct: number; // Receita - Custo LLM / Receita

  // Qualidade
  avgLighthouseScore: number;
  qaFirstPassRate: number; // % que passa no 1º ciclo de QA
  avgDeliveryHours: number; // Briefing → Entrega (média)

  // Agentes
  agentsActive: number;
  agentsPaused: number;
  lastAgentError?: AgentErrorSummary;
}

// Widgets obrigatórios na home:
// 1. HITL Pendentes (prioridade máxima — sempre no topo)
// 2. Pipeline Kanban (mini) — colunas: Prospecção → Negociação → Em Dev → Entregue
// 3. Gráfico: Sites entregues por dia (últimos 30 dias)
// 4. Gráfico: Custo LLM por dia (últimos 30 dias)
// 5. Tabela: Últimos 5 leads adicionados
// 6. Card: Status dos agentes (verde/amarelo/vermelho)
```

### 54.2 Tela de Gestão de Agentes

```typescript
// Estrutura da tela de edição de um agente

interface AgentEditorTabs {
  overview: {
    // Nome, persona, status, ativar/pausar
  };
  llm: {
    // Provider, modelo, temperatura, max_tokens
    // Editor de system_prompt com:
    //   - Contador de tokens (real-time)
    //   - Indicador visual: verde (<16k), amarelo (16-28k), vermelho (>28k)
    //   - Botão "Testar LLM" — envia prompt de teste e exibe resposta
  };
  subAgents: {
    // Lista de sub-agentes com:
    //   - Role, modelo, execution_mode, parallel_group
    //   - Botão "Testar sub-agente isoladamente"
    //   - Visualização do grafo de dependências
  };
  skills: {
    // Lista de skills ativas
    // Formulário de nova skill por tipo
    // Testar skill individualmente
  };
  rules: {
    // Lista de rules com condição CEL e ação
    // Editor de condição com autocomplete de variáveis
    // Simulador: testar rule com payload de exemplo
  };
  rag: {
    // Upload de documentos
    // Lista de documentos indexados
    // Testar query RAG com resultado
    // Configurar: collection, top_k, threshold
  };
  mcp: {
    // Servidores MCP configurados
    // Whitelist de tools por servidor
    // Testar ferramenta individualmente
  };
  hitl: {
    // Configuração de timeout
    // Canal de notificação
    // Ações que requerem aprovação
  };
  logs: {
    // Últimas 100 execuções do agente
    // Filtros: status, data, correlation_id
    // Detalhamento de cada execução com tokens e custo
  };
}
```

### 54.3 Tela de HITL Pendentes

```typescript
// apps/web/src/app/(dashboard)/hitl/page.tsx

// Esta tela é a mais crítica do sistema — operador passa mais tempo aqui

interface HITLQueueItem {
  id: string;
  actionType: string; // Ex: SEND_EXTERNAL_MESSAGE
  contextType: string; // Ex: LEAD
  contextId: string;
  payloadPreview: Record<string, unknown>; // PII mascarado
  createdAt: Date;
  expiresAt: Date;
  timeRemainingMinutes: number; // Countdown visual
  agentPersona: string;
  subAgentRole?: string;
  leadName?: string; // Para contexto rápido (mascarado)
}

// Ações disponíveis inline (sem abrir modal para ações simples):
// - Aprovar com 1 clique
// - Rejeitar com 1 clique + campo de nota opcional
// - Abrir detalhes (modal com payload completo descriptografado)
// - Ver histórico do lead (contexto da conversa)
// - Editar payload + Aprovar (para mensagens)

// Ordenação padrão: por tempo restante (que vai expirar primeiro)
// Alerta sonoro se HITL pendente há mais de 45 min (configurável)
// Badge no favicon com contagem de HITL pendentes
```

### 54.4 Tela do Projeto (Timeline Visual)

```typescript
// apps/web/src/app/(dashboard)/projects/[id]/page.tsx

interface ProjectTimeline {
  stages: Array<{
    name: string;
    status: "completed" | "in_progress" | "pending" | "failed";
    startedAt?: Date;
    completedAt?: Date;
    durationMinutes?: number;
    costUsd?: number; // Custo de LLM nesta etapa
    actions?: TimelineAction[]; // HITL tomadas, deploys, etc.
  }>;

  // Estágios:
  // 1. Briefing (com transcrição expandível)
  // 2. Design (mockup com preview inline)
  // 3. Copywriting (textos gerados)
  // 4. Geração de Imagens (preview das 6-8 imagens)
  // 5. Desenvolvimento (link para o código no Vercel/GitHub)
  // 6. QA (scores Lighthouse + OWASP + Content)
  // 7. Deploy Staging (link para preview)
  // 8. Deploy Produção (link para site ao vivo)
  // 9. Entrega ao Cliente (status WhatsApp + Email)
}

// Seções da tela do projeto:
// - Header: nome do negócio, tipo de site, status atual
// - Timeline: visual horizontal com etapas
// - Assets: galeria das imagens geradas
// - Mockup: iframe com o HTML do mockup
// - Qualidade: scores Lighthouse em cards
// - Custo: breakdown de custo por etapa
// - HITL History: todas as aprovações do projeto
// - Links: staging, produção, tutorial HeyGen, PDF de entrega
```

---

## 55. Segurança — Checklist de Auditoria Interna

Antes de qualquer deploy em produção, o operador deve executar esta checklist:

```markdown
## Checklist de Segurança — Hefesto v2

### Autenticação

- [ ] Argon2id configurado corretamente (memoryCost=65536, timeCost=3)
- [ ] JWT usando RS256 (verificar: NÃO está usando HS256)
- [ ] Refresh tokens sendo hasheados antes de armazenar
- [ ] Rate limiting de 5 tentativas/15min está ativo no login
- [ ] Teste de anti-timing: diferença < 200ms entre user existente e não-existente

### Uploads e Geração de Imagens

- [ ] Magic bytes validados em TODOS os uploads de arquivos
- [ ] Magic bytes validados em imagens geradas pelo Nano Banana Pro e DALL-E
- [ ] Tipos MIME na whitelist: jpeg, png, webp, svg, pdf (apenas)
- [ ] Limite de tamanho de arquivo configurado (MAX_FILE_SIZE)
- [ ] Teste de polyglot file (HTML+JPEG) sendo rejeitado

### SSRF

- [ ] Lista de IPs bloqueados cobre: localhost, 127.x, 10.x, 172.16-31.x, 192.168.x
- [ ] Validação de URL aplicada em: scraping skill, image_gen providers, web_search

### API

- [ ] Todos os endpoints exigem autenticação (exceto /health e /auth/login)
- [ ] Rate limiting geral aplicado (100 req/min)
- [ ] Body size limit configurado (< 10MB para uploads)
- [ ] CORS configurado apenas para o domínio do frontend
- [ ] Headers de segurança HTTP presentes (CSP, HSTS, X-Frame-Options)

### Dados e PII

- [ ] Transcrições de briefing armazenadas no vault (não no banco principal)
- [ ] Payload HITL com PII mascarado antes de salvar em payloadPreview
- [ ] Audit log append-only (RLS configurado: apenas INSERT)
- [ ] Chaves de API dos LLMs acessíveis apenas via Infisical (não em .env de produção)
- [ ] Conexão com banco usando TLS (ssl=require)

### HITL

- [ ] Nenhum agente pode enviar mensagem externa sem HITL aprovado
- [ ] Timeout de HITL está ativo (expiração automática)
- [ ] Notificação de expiração enviada ao operador

### Infra

- [ ] Portas internas do Docker NÃO expostas na internet (apenas 3000, 3001)
- [ ] Redis com senha configurada
- [ ] PostgreSQL sem senha vazia
- [ ] Ollama não acessível externamente
- [ ] Evolution API com apikey configurada

### Logs

- [ ] Nenhum dado PII nos logs estruturados (email, telefone, CNPJ)
- [ ] Nenhuma API key nos logs (verificar LLM calls)
- [ ] Correlation ID presente em todos os logs de uma request

### Dependências

- [ ] `npm audit` sem vulnerabilidades críticas
- [ ] `pip audit` sem vulnerabilidades críticas
- [ ] Imagens Docker baseadas em alpine (menor superfície de ataque)
- [ ] Dependências com versões fixadas (não usar `latest` em produção)
```

---

_PRD Hefesto v2.0.0 — VERSÃO FINAL COMPLETA_
_53 seções de especificação + 2 seções finais de operação_
_Total: 55 seções | >7.000 linhas | Pronto para implementação_
