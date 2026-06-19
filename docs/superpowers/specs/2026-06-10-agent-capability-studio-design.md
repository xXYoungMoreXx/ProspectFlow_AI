# Design: Agent Capability Studio + Service Catalog + Full Lead Enrichment

**Date:** 2026-06-10  
**Status:** Approved (via /goal directive)  
**Specs:** SPEC-02 (v2.1), SPEC-03 (v2.1), SPEC-13 (new), SPEC-14 (new)

---

## Problem Statement

The Hefesto agents page is minimal: basic CRUD, no way to visually compose subagent workflows, no skills catalog, no MCP management per-agent. The prospecting menu captures only 9 Google Maps fields and has a single hardcoded qualification formula. There is no concept of which service to offer each lead.

---

## What We Are Building

Four interconnected features delivered as Fase 4:

1. **Agent Capability Studio** — full redesign of `/agents/[id]` as an 8-tab studio
2. **Full Lead Enrichment** — pull all available Google Maps fields including photos
3. **Service Type Selection** — per-campaign service target with adjusted scoring formula
4. **Pre-loaded Skills Library** — 8 builtin skills (Caveman, ECC, UI/UX, Social Media, Traffic, SEO, HUASHU, Superpowers)

---

## Architecture

### Approach: Full Page Redesign

Rebuild `/agents/[id]` as `AgentCapabilityStudio` component with 8 tabs. No separate `/studio` route. Existing shadcn/ui + Tailwind 4 patterns reused throughout.

### Anthropic Agent Pattern

```
Orchestrator Agent (persona: HUNTER / CLOSER / BUILDER / QA)
    |
    +-- SubAgent: PROSPECTOR     skills: [places_search, web_search]
    |                             MCPs:  [searxng]
    +-- SubAgent: SITE_INSPECTOR  skills: [web_search]
    |
    +-- SubAgent: DATA_ENRICHER   skills: [cnpj_lookup, cnpj_enricher]
                                  MCPs:  [brasilapi]
```

Each sub-agent is independently configurable (LLM, execution mode, parallel group, skills, MCPs). The Workflow Builder renders execution order as a DAG enforced at save time.

### Service Type + Scoring

`ServiceType` (`SITE_CREATION | TRAFFIC_MANAGEMENT | SOCIAL_MEDIA | FULL_DIGITAL`) lives in `shared-types` and drives:

1. `SCORING_WEIGHTS[serviceType]` — different dimensional emphasis per service
2. "Servico Sugerido" label on lead cards in the prospecting queue

### Skills Catalog Pattern

`skill_catalog` table holds builtin seeds (`is_builtin=true`). Adding a skill to an agent creates a copy (`is_builtin=false`) — editável, origem protegida. Skill type `prompt_template` appends `systemPromptAddition` to the sub-agent system prompt at runtime. No external API calls for this type.

---

## Data Flow

### Prospecting with Full Data

```
POST /prospecting/search-maps (serviceType in config)
  Hunter reads serviceType from ProspectingConfig
  GoogleMapsAdapter fetches extended FieldMask (photos, editorialSummary, etc.)
  Photos fetched via /v1/{name}/media endpoint, cached in Redis 7 days
  calculateScore(place, enrichment, serviceType) using SCORING_WEIGHTS[serviceType]
  leads.companyData JSONB stores full enriched payload
  GET /prospecting/queue returns photoUris[], editorialSummary, businessStatus, etc.
```

### Agent Workflow Execution

```
PUT /agents/:id/workflow (WorkflowDefinition)
  validateWorkflowDAG() -- DFS cycle detection
  Persisted to workflow_definitions table
  POST /agents/:id/workflow/test
    AgentExecutionService reads workflow
    Respects parallelGroup for concurrent execution
    Sandbox mode: results not persisted
```

### MCP Server Registration

```
POST /agents/:id/mcp-servers
  isAllowedMCPUrl() SSRF check (RFC1918 blocked unless in ALLOWED_MCP_HOSTS)
  TestMCPServerUseCase pings endpoint (5s timeout)
  If responds: save MCPServer, return allowedTools list
  allowedSubAgentIds restricts which sub-agents can invoke this MCP
```

---

## Database Changes

| Table                | Change                                      | Migration                         |
| -------------------- | ------------------------------------------- | --------------------------------- |
| prospecting_configs  | ADD service_type text DEFAULT SITE_CREATION | XXXX_service_type_prospecting.sql |
| skill_catalog        | CREATE TABLE                                | XXXX_skill_catalog.sql            |
| skill_catalog        | SEED 8 builtin skills                       | XXXX_seed_skill_catalog.sql       |
| workflow_definitions | CREATE TABLE                                | XXXX_workflow_definitions.sql     |
| mcp_servers          | ADD allowed_sub_agent_ids uuid[]            | in workflow migration             |

---

## Security Considerations

- **SSRF**: `isAllowedMCPUrl()` blocks RFC1918. Internal containers allowed via `ALLOWED_MCP_HOSTS` env.
- **Photos**: Only CDN URLs stored, never raw bytes. Business exteriors only, no PII.
- **Workflow DAG**: Cycle detection prevents infinite loops in execution engine.
- **Skill builtin protection**: DELETE returns 403 for `is_builtin=true` records.
- **Prompt injection**: `systemPromptAddition` is operator-defined only, never user-controlled.

---

## Frontend Component Tree

```
AgentCapabilityStudio.tsx
  tabs/OverviewTab.tsx         LLM config, stats, activate/pause
  tabs/SubAgentsTab.tsx        List + inline create/edit form
  tabs/SkillsTab.tsx           Active skills + SkillCatalogModal
  tabs/MCPsTab.tsx             List + add form with SSRF feedback
  tabs/RulesTab.tsx            CEL rules (existing, refactored)
  tabs/RAGTab.tsx              RAG documents (existing, refactored)
  tabs/WorkflowsTab.tsx        WorkflowBuilder canvas
  tabs/AnalyticsTab.tsx        Token/cost charts by sub-agent
SkillCatalogModal.tsx          Searchable, filter by serviceType/persona
WorkflowBuilder/
  WorkflowBuilder.tsx          Canvas + toolbar
  WorkflowNode.tsx             Sub-agent node with group badge
  WorkflowEdge.tsx             Directed edge with optional CEL condition
ProspectingConfigTab.tsx       ADD: serviceType select
LeadCard.tsx                   ADD: photo carousel, summary, businessStatus
```

---

## Implementation Order (BUILD_ORDER Fase 4)

```
4.1 -- shared-types ServiceType + DB migrations + seeds + calculateScore refactor
4.2 -- GoogleMapsAdapter extend + EnrichmentData extend + schema extend
4.3 -- MCPServer domain + WorkflowDefinition domain + use cases + routes
4.4 -- Frontend: AgentCapabilityStudio + SkillCatalogModal + WorkflowBuilder
```

TDD throughout: RED then GREEN then REFACTOR at each sub-step before proceeding.
