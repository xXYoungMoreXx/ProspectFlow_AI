# SPEC-13: Agent Capability Studio — Redesign da Página de Agentes

> Versão: 1.0.0 | Fase: 4 | Dependências: SPEC-02 (Agent Management), SPEC-14 (Service Catalog)

---

## Escopo

Redesign completo da página `/agents/[id]` em um "Capability Studio" com:

- UI em abas: Overview · Sub-agentes · Skills · MCPs · Regras · RAG · Workflows · Analytics
- **Workflow Builder** visual para orquestração de sub-agentes em grupos parallel/sequential
- **Skills Catalog** com skills pré-carregadas e import do catálogo global (SPEC-14)
- **MCP Server Manager** — adicionar, configurar e testar MCP servers por agente
- **Sub-agent Studio** — criar, configurar, testar sub-agentes individualmente
- Padrão Anthropic: agente orquestrador → sub-agentes especializados → skills/MCPs como ferramentas

---

## Regras de Negócio Novas

```
9.  O Workflow Builder não pode ter ciclos (grafo dirigido acíclico — DAG obrigatório).
10. Sub-agente sem skill atribuída pode existir mas não pode ser ativado no workflow.
11. Skills do catálogo global são copiadas para o agente (imutáveis na origem).
12. MCP Servers são testados com "ping" antes de aceitos — recusado se não responder.
13. Skill type 'prompt_template' não consome créditos de API externos.
14. Workflow só pode ser executado se o agente pai estiver ACTIVE.
15. Sub-agentes de grupo parallel devem ter o mesmo parallelGroup (inteiro >= 1).
16. Um MCP server pode ser restrito a sub-agentes específicos via allowedSubAgentIds.
```

---

## Página: Capability Studio — Layout por Aba

### Aba: Overview

```
┌─────────────────────────────────────────────────────────────┐
│  🤖 [nome do agente]   [PERSONA badge]  [status badge]      │
│  [modelo LLM] · [provedor]                                  │
│  Budget: [████░░] 847k / 1.000k tokens  ($0.42 gasto)       │
│                                                             │
│  ── Estatísticas ──                                         │
│  Skills: N  |  MCPs: N  |  Sub-agentes: N  |  Rules: N      │
│  Última execução: YYYY-MM-DD HH:MM  |  Próxima: HH:MM       │
│                                                             │
│  ── Configuração LLM ──                                     │
│  Provider: [select]  Model: [input]  Temp: [slider 0-2]     │
│  Max Tokens: [input]  System Prompt: [textarea]             │
│                                                             │
│  ── HITL ──                                                 │
│  Timeout: [input] min  Canal: [email|telegram]              │
│                                                             │
│  [SAVE CONFIG]  [TEST LLM →]  [ACTIVATE]  [PAUSE]          │
└─────────────────────────────────────────────────────────────┘
```

### Aba: Sub-agentes

```
┌─────────────────────────────────────────────────────────────┐
│  [+ Novo Sub-agente]                                        │
│                                                             │
│  ┌──────────────────┬──────────┬────────┬──────────────┐   │
│  │ Role             │ Modelo   │ Modo   │ Ações        │   │
│  ├──────────────────┼──────────┼────────┼──────────────┤   │
│  │ PROSPECTOR       │ gemini.. │ ║ p:1  │ [Edit][Test] │   │
│  │ SITE_INSPECTOR   │ gemini.. │ ║ p:1  │ [Edit][Test] │   │
│  │ DATA_ENRICHER    │ llama..  │ ▶ seq  │ [Edit][Test] │   │
│  └──────────────────┴──────────┴────────┴──────────────┘   │
│                                                             │
│  Legenda: ║ = parallel  ▶ = sequential  p:N = grupo N       │
│                                                             │
│  ── Criar / Editar Sub-agente (inline panel) ──             │
│  Role: [select roles válidos para esta persona]             │
│  Provider: [select]  Model: [input]                         │
│  Modo: [sequential|parallel]  Grupo: [N]                    │
│  Timeout: [N]s  Retries: [N]                               │
│  Skills: [multi-select das skills do agente pai]            │
│  [SAVE]  [TEST SUB-AGENT]  [CANCEL]                         │
└─────────────────────────────────────────────────────────────┘
```

### Aba: Skills

```
┌─────────────────────────────────────────────────────────────┐
│  [+ Add do Catálogo]  [Criar Custom]                        │
│                                                             │
│  ── Skills Ativas ─────────────────────────────────────────│
│  ● places_search     PROSPECTOR    [enabled●] [Test] [⚙] [×]│
│  ● cnpj_lookup       DATA_ENRICHER [enabled●] [Test] [⚙] [×]│
│  ● web_search        ALL           [enabled●] [Test] [⚙] [×]│
│                                                             │
│  ── Adicionar do Catálogo ─────────────────────────────────│
│  [Buscar skills...]  [Filtrar: Serviço ▼] [Filtrar: Persona ▼]│
│                                                             │
│  🎨 UI/UX Design Pro    prompt_template  Site               │
│     Design patterns, cor, acessibilidade, UI best practices │
│     [+ Add ao Agente]                                       │
│                                                             │
│  💻 ECC Code Quality    prompt_template  Site               │
│     Clean arch, TDD, TypeScript strict, security patterns   │
│     [+ Add ao Agente]                                       │
│                                                             │
│  🚀 Caveman Deploy      prompt_template  Todos              │
│     Git workflow, CI/CD, deploy automation, branch strategy │
│     [+ Add ao Agente]                                       │
│                                                             │
│  📊 Traffic Manager     prompt_template  Tráfego            │
│     Google Ads, Meta Ads, UTM, conversion tracking         │
│     [+ Add ao Agente]                                       │
│                                                             │
│  📱 Social Media Strat  prompt_template  Social Media       │
│     Content calendar, hashtags, engagement, analytics       │
│     [+ Add ao Agente]                                       │
└─────────────────────────────────────────────────────────────┘
```

### Aba: MCPs

```
┌─────────────────────────────────────────────────────────────┐
│  [+ Adicionar MCP Server]                                   │
│                                                             │
│  ── MCP Servers Configurados ──────────────────────────────│
│  🟢 brasilapi        http://mcp-brasil:3001  [Test] [⚙] [×]│
│     Ferramentas: cnpj_lookup, cep_lookup, banks             │
│     Restrito a: DATA_ENRICHER                               │
│  🟡 searxng          http://searxng:8080     [Test] [⚙] [×]│
│     Ferramentas: web_search                                 │
│     Restrito a: TODOS                                       │
│                                                             │
│  ── Adicionar MCP Server ──────────────────────────────────│
│  Nome: [input]                                              │
│  URL: [input]  (SSRF validation automática)                 │
│  Auth: [None|Bearer|API Key]  Token/Key: [input mascarado]  │
│  Ferramentas permitidas: [multi-select após connect]        │
│  Sub-agentes permitidos: [multi-select | TODOS]             │
│  [CONNECT & TEST]  [SAVE]                                   │
└─────────────────────────────────────────────────────────────┘
```

### Aba: Workflows

```
┌─────────────────────────────────────────────────────────────┐
│  Workflow Visual Builder                [RUN TEST] [SAVE]   │
│                                                             │
│  ┌──────────────┐   ┌──────────────┐                        │
│  │  PROSPECTOR  │   │SITE_INSPECTOR│                        │
│  │  parallel:1  │   │  parallel:1  │                        │
│  │ gemini-flash │   │ gemini-flash │                        │
│  └──────┬───────┘   └──────┬───────┘                        │
│         └─────────┬─────────┘                               │
│               [grupo 1 — ambos concluídos]                  │
│                   │                                         │
│                   ▼                                         │
│          ┌──────────────┐                                   │
│          │ DATA_ENRICHER│                                   │
│          │  sequential  │                                   │
│          │ llama3.2:3b  │                                   │
│          └──────────────┘                                   │
│                   │                                         │
│                   ▼ (resultado final)                       │
│          [leads enriquecidos → HITL]                        │
│                                                             │
│  Modo: [Sequential | Parallel | Mixed ●]                    │
│  Max workers: [3]  Timeout global: [300]s                   │
│  Em falha: [STOP | CONTINUE | ESCALATE_HITL ●]             │
│                                                             │
│  [+ Adicionar Nó]  [Limpar]  [Exportar YAML]               │
└─────────────────────────────────────────────────────────────┘
```

### Aba: Analytics

```
┌─────────────────────────────────────────────────────────────┐
│  Período: [Hoje | 7 dias | 30 dias ●]                       │
│                                                             │
│  Tokens totais: ████████░░  847.321 / 1.000.000            │
│  Custo total:   $0.42                                       │
│                                                             │
│  ── Por Sub-agente ──                ── Tempo médio ───     │
│  PROSPECTOR     312k tokens  $0.18   2.3s / execução        │
│  SITE_INSPECTOR  89k tokens  $0.05   4.1s / execução        │
│  DATA_ENRICHER  446k tokens  $0.19   1.8s / execução        │
│                                                             │
│  ── Últimas execuções ──────────────────────────────────── │
│  2026-06-10 09:00  ✅ 45 leads  18.2s  $0.04               │
│  2026-06-09 09:00  ✅ 38 leads  16.7s  $0.03               │
│  2026-06-08 09:00  ❌ Maps quota exceeded                   │
└─────────────────────────────────────────────────────────────┘
```

---

## Novos Endpoints de API (SPEC-02 extensions)

### MCP Servers CRUD

```
GET    /api/v1/agents/:id/mcp-servers
  Response 200: { data: MCPServer[] }

POST   /api/v1/agents/:id/mcp-servers
  Body: { name, url, authType, authSecretRef?, allowedTools, allowedSubAgentIds? }
  Validação: SSRF check em url (bloquear IPs RFC1918 exceto whitelist ALLOWED_MCP_HOSTS)
  Ação: tenta conectar e listar ferramentas disponíveis no MCP
  Response 201: { data: MCPServer }
  Erro 422: MCP_CONNECTION_FAILED
  Erro 400: SSRF_BLOCKED

PATCH  /api/v1/agents/:id/mcp-servers/:mcpId
  Response 200: { data: MCPServer }

DELETE /api/v1/agents/:id/mcp-servers/:mcpId
  Response 204

POST   /api/v1/agents/:id/mcp-servers/:mcpId/test
  Response 200: { data: { connected: boolean, tools: string[], latencyMs: number } }
```

### Workflow Management

```
GET    /api/v1/agents/:id/workflow
  Response 200: { data: WorkflowDefinition }

PUT    /api/v1/agents/:id/workflow
  Body: WorkflowDefinition
  Validação: grafo deve ser DAG (sem ciclos), subAgentIds devem existir
  Response 200: { data: WorkflowDefinition }
  Erro 422: WORKFLOW_HAS_CYCLE | SUBAGENT_NOT_FOUND

POST   /api/v1/agents/:id/workflow/test
  Body: { testPayload: Record<string, unknown> }
  Response 202: { data: { jobId, estimatedSeconds } }
  Note: executa workflow completo sem persistir resultados (modo sandbox)
```

### Skills com Catálogo

```
GET    /api/v1/skill-catalog
  Query: serviceType?, persona?, search?, limit?, cursor?
  Response 200: { data: SkillCatalogEntry[], meta: PaginationMeta }

POST   /api/v1/agents/:id/skills/from-catalog
  Body: { catalogSkillId: string, subAgentId?: string }
  Response 201: { data: AgentSkill }
  Note: clona a skill do catálogo para o agente (editável, origem inalterada)
```

---

## Database Schema — Adições

```sql
-- Adicionar coluna de sub-agentes permitidos em mcp_servers
ALTER TABLE mcp_servers
  ADD COLUMN IF NOT EXISTS allowed_sub_agent_ids uuid[] NOT NULL DEFAULT '{}';

-- Tabela de definições de workflow (uma por agente)
CREATE TABLE IF NOT EXISTS workflow_definitions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id    uuid NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  definition  jsonb NOT NULL DEFAULT '{}',
  -- Estrutura: { nodes: [{subAgentId, executionMode, parallelGroup?, position}],
  --             edges: [{from, to, condition?}],
  --             globalTimeoutSeconds, maxParallelWorkers, onFailure }
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX idx_workflow_agent ON workflow_definitions(agent_id);

-- Tabela de catálogo global de skills (seeds via SPEC-14)
CREATE TABLE IF NOT EXISTS skill_catalog (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name            text NOT NULL,
  slug            text NOT NULL UNIQUE,
  description     text NOT NULL,
  skill_type      text NOT NULL,
  config_template jsonb NOT NULL DEFAULT '{}',
  service_types   text[] NOT NULL DEFAULT '{}',
  persona_hints   text[] NOT NULL DEFAULT '{}',
  is_builtin      boolean NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now()
);
```

---

## WorkflowDefinition — Tipos TypeScript

```typescript
// domain/agent/WorkflowDefinition.ts

interface WorkflowNode {
  subAgentId: string;
  executionMode: "sequential" | "parallel";
  parallelGroup?: number;
  position: { x: number; y: number };
}

interface WorkflowEdge {
  from: string;
  to: string;
  condition?: string; // expressão CEL opcional
}

interface WorkflowDefinition {
  agentId: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  globalTimeoutSeconds: number;
  maxParallelWorkers: number;
  onFailure: "STOP" | "CONTINUE" | "ESCALATE_HITL";
}

// Validação de DAG — nenhum ciclo permitido
function validateWorkflowDAG(def: WorkflowDefinition): void {
  const visited = new Set<string>();
  const inStack = new Set<string>();
  const adj = new Map<string, string[]>();

  for (const edge of def.edges) {
    adj.set(edge.from, [...(adj.get(edge.from) ?? []), edge.to]);
  }

  function dfs(node: string): void {
    visited.add(node);
    inStack.add(node);
    for (const neighbor of adj.get(node) ?? []) {
      if (!visited.has(neighbor)) dfs(neighbor);
      else if (inStack.has(neighbor)) {
        throw new ValidationError(
          `Workflow tem ciclo envolvendo sub-agente ${node}`,
          "workflow",
        );
      }
    }
    inStack.delete(node);
  }

  for (const node of def.nodes) {
    if (!visited.has(node.subAgentId)) dfs(node.subAgentId);
  }
}
```

---

## MCPServer — Tipo TypeScript (expansão do domínio)

```typescript
// domain/agent/MCPServer.ts

type MCPAuthType = "none" | "bearer" | "api_key";

class MCPServer {
  constructor(
    readonly id: MCPServerId,
    readonly agentId: AgentId,
    readonly name: string,
    readonly url: string,
    readonly authType: MCPAuthType,
    readonly authSecretRef: string | undefined,
    readonly allowedTools: string[],
    readonly allowedSubAgentIds: SubAgentId[],
    readonly isEnabled: boolean,
  ) {}

  static create(props: CreateMCPServerProps): MCPServer {
    if (!isAllowedMCPUrl(props.url)) {
      throw new SecurityError(`URL MCP não permitida (SSRF): ${props.url}`);
    }
    return new MCPServer(
      MCPServerId.create(),
      props.agentId,
      props.name,
      props.url,
      props.authType,
      props.authSecretRef,
      props.allowedTools,
      props.allowedSubAgentIds ?? [],
      true,
    );
  }
}

// Hosts internos permitidos são configurados em ALLOWED_MCP_HOSTS (ENV)
function isAllowedMCPUrl(url: string): boolean {
  const parsed = new URL(url);
  const ALLOWED = (process.env["ALLOWED_MCP_HOSTS"] ?? "")
    .split(",")
    .filter(Boolean);
  return !isRFC1918(parsed.hostname) || ALLOWED.includes(parsed.hostname);
}
```

---

## Componentes Frontend (apps/web/src)

```
components/agents/
  capability-studio/
    AgentCapabilityStudio.tsx      ← container principal, gerencia abas
    tabs/
      OverviewTab.tsx              ← config LLM + stats + botões activate/pause
      SubAgentsTab.tsx             ← lista + form inline de sub-agentes
      SkillsTab.tsx                ← skills ativas + modal catálogo
      MCPsTab.tsx                  ← lista MCP + form add/edit
      RulesTab.tsx                 ← regras CEL (existente, refatorado)
      RAGTab.tsx                   ← documentos RAG (existente, refatorado)
      WorkflowsTab.tsx             ← builder visual (ReactFlow ou similar)
      AnalyticsTab.tsx             ← gráficos tokens/custo
    SkillCatalogModal.tsx          ← modal de busca e adição de skills
    WorkflowBuilder/
      WorkflowBuilder.tsx          ← orquestrador do builder
      WorkflowNode.tsx             ← nó de sub-agente no canvas
      WorkflowEdge.tsx             ← aresta com condição CEL
```

---

## Testes Obrigatórios (Novos)

```typescript
describe('validateWorkflowDAG()') {
  it('lança ValidationError para grafo com ciclo A→B→A')
  it('lança ValidationError para auto-loop A→A')
  it('passa para DAG linear A→B→C')
  it('passa para DAG com paralelo (A,B)→C')
}

describe('MCPServer.create()') {
  it('lança SecurityError para 127.0.0.1 (loopback)')
  it('lança SecurityError para 192.168.1.1 sem whitelist')
  it('aceita hostname interno quando está em ALLOWED_MCP_HOSTS')
  it('aceita URL pública https://api.example.com')
}

describe('POST /api/v1/agents/:id/mcp-servers') {
  it('201 para MCP externo válido que responde ao ping')
  it('422 MCP_CONNECTION_FAILED quando MCP não responde em 5s')
  it('400 SSRF_BLOCKED para IP interno não na whitelist')
}

describe('PUT /api/v1/agents/:id/workflow') {
  it('200 para workflow DAG válido com paralelo e sequencial')
  it('422 WORKFLOW_HAS_CYCLE para workflow com ciclo')
  it('422 SUBAGENT_NOT_FOUND para subAgentId inexistente')
}

describe('GET /api/v1/skill-catalog') {
  it('retorna todas as skills is_builtin=true sem filtro')
  it('filtra por serviceType=SITE_CREATION corretamente')
  it('filtra por persona=BUILDER corretamente')
  it('search por nome parcial retorna matches')
}
```

---

## Critérios de Aceite

- [ ] Aba Workflows: sub-agentes configuráveis com grupos parallel/sequential no builder visual
- [ ] Workflow com ciclo rejeitado pelo backend (422) e sinalizado no frontend
- [ ] Aba MCPs: SSRF check bloqueia IPs internos não na whitelist ALLOWED_MCP_HOSTS
- [ ] MCP server recusado se não responder ao ping em 5s (422 MCP_CONNECTION_FAILED)
- [ ] Aba Skills: catálogo global carregado, filtrável por serviceType e persona
- [ ] Skill clonada do catálogo para o agente (editável no agente, catálogo inalterado)
- [ ] Test sub-agent executa tarefa real e retorna output + custo em USD
- [ ] Analytics por sub-agente com granularidade de tokens e custo USD
- [ ] Workflow test executa no modo sandbox sem persistir leads
- [ ] MCP server restrito a sub-agentes específicos via allowedSubAgentIds
- [ ] Página /agents/[id] usa novo AgentCapabilityStudio component com 8 abas
