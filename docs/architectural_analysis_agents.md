# Surgical Analysis: Agentic Architectures for Hefesto / Hefesto

## 1. Executive Summary

This document provides a surgical analysis of leading open-source AI agent and MCP (Model Context Protocol) projects. The goal is to extract actionable architectural patterns, integration strategies, and skill definitions that can be legally and technically integrated into the **Hefesto/Hefesto** platform, maintaining strict adherence to our Domain-Driven Design (DDD), Hexagonal Architecture, and Security-First (HITL) principles.

The analyzed projects include: Goose Skills, Agency Agents, OpenSquad, Paperclip, Hermes Agent, Claude Code, and MCP Brasil.

---

## 2. Key Architectural Patterns Extracted

### 2.1. Skill & Tool Architecture (Inspired by `goose-skills` & `mcp-brasil`)

**Current Hefesto State:** Needs a scalable way to define, version, and load external tools for agents (Hunter, Closer, etc.).

**Extracted Patterns:**

- **Skill Metadata Contract (`goose-skills`)**: Separation of logic from definition. Each skill should reside in its own directory with a `skill.meta.json` (defining slug, category, tags, supported platforms, features) and a `SKILL.md` (documentation for the LLM).
- **Skill Categorization (`goose-skills`)**: Classifying tools into three layers:
  - _Capabilities_: Atomic, single-purpose tools (e.g., `scrape_cnpj`, `send_telegram_msg`).
  - _Composites_: Multi-skill chains (e.g., `research_company_and_find_decision_makers`).
  - _Playbooks_: End-to-end workflows.
- **Package by Feature & Auto-Registry (`mcp-brasil`)**: Structuring internal MCP tools by feature (e.g., `data/receita/`, `data/tse/`) where adding a folder automatically registers the tool without manual routing configuration.
- **Local Caching with Embedded DBs (`mcp-brasil`)**: For large datasets (e.g., Brazilian company databases), using an embedded SQL database (like DuckDB or SQLite) to cache data locally and exposing SQL capabilities via canned tools.

**Implementation for Hefesto:**

- Implement a **Skill Registry** in `apps/agent-runtime` that dynamically loads tools based on a standardized `skill.meta.json` schema.
- Adopt the Capability/Composite/Playbook hierarchy to organize Hefesto's internal sales and prospecting tools.

### 2.2. Agent Persona Definition (Inspired by `agency-agents`)

**Current Hefesto State:** Agents are defined by Persona, LLMConfig, Skills, Rules, etc. (PRD Section 7).

**Extracted Patterns:**

- **Markdown-Driven Personas**: Defining agents entirely via markdown files (`.md`). Each file acts as a comprehensive prompt and configuration containing:
  - **Identity & Memory**: Who the agent is and how it remembers.
  - **Core Mission**: The singular goal.
  - **Critical Rules**: Strict boundaries (e.g., formatting, tone).
  - **Technical Deliverables**: What the agent actually produces.
  - **Workflow Process**: Step-by-step execution logic.
  - **Success Metrics**: How the agent evaluates its own output.
- **Multi-Platform Compatibility Layer**: Creating scripts that can translate these markdown definitions into formats compatible with various IDEs and runtimes (Cursor `.mdc`, Gemini `SKILL.md`, etc.).

**Implementation for Hefesto:**

- Adopt this `.md` structure for Hefesto's core personas (Hunter, Closer, Builder, QA). Store these in a version-controlled `docs/agents/personas/` directory and build a parser to inject them into the LLM context.
- This approach treats "Prompts as Code" (as dictated in `GEMINI.md`), allowing easy versioning and community contributions.

### 2.3. Multi-Agent Orchestration & HITL (Inspired by `opensquad` & `paperclip`)

**Current Hefesto State:** Requires mandatory Human-in-the-Loop (HITL) for external actions (ADR-004) and supports agent pipelines.

**Extracted Patterns:**

- **Pipeline with Checkpoints (`opensquad`)**: Agents run in a sequential or DAG pipeline. Crucially, the pipeline contains native _checkpoints_ where execution pauses, yielding control back to the host environment (or UI) to request human approval.
- **Stateful Browser Sessions (`opensquad`)**: For tasks requiring authentication (e.g., navigating LinkedIn or specific CRMs), the framework handles headless browser sessions (Playwright), allows manual login once, and persists cookies securely.
- **Enterprise Governance (`paperclip`)**: Enforcing cost control, ticket systems for agent task allocation, and organizational charting (agents reporting to other agents).

**Implementation for Hefesto:**

- **Refining ADR-004 (HITL)**: Implement the `opensquad` checkpoint pattern in the `agent-runtime`. When an agent attempts an action flagged as `requires_approval`, the runtime suspends the agent's state, fires a Domain Event to the `api`, which notifies the user via Telegram/UI. Upon approval, the state is resumed.
- **Agent Org Chart**: For B2B sales, establish an "Org Chart" where Hunter agents report to a Strategist agent, allowing for hierarchical task delegation and monitoring.

### 2.4. Batch Processing & State Management (Inspired by `hermes-agent`)

**Current Hefesto State:** Relies on BullMQ for background task processing.

**Extracted Patterns:**

- **Batch Runners**: Architectures designed to handle long-running, parallel agent executions across large datasets without losing context.
- **Persistent State Trees**: Managing the "memory" and current execution step of an agent in a structured format that can be serialized to a database and resumed if the process dies.

**Implementation for Hefesto:**

- Integrate agent state serialization tightly with BullMQ. If an agent worker node goes down, another node should be able to pick up the serialized state (from Redis/Postgres) and resume the pipeline exactly where it left off.

### 2.5. Brazilian Context Integrations (Inspired by `mcp-brasil`)

**Current Hefesto State:** Needs localized data for effective prospecting in Brazil.

**Extracted Patterns:**

- **70+ Public APIs via MCP**: `mcp-brasil` provides direct, pre-configured access to Receita Federal, IBGE, Portal da Transparência, and DataJud.
- **Smart Discovery & Cross-Referencing**: Tools like `planejar_consulta` that allow the LLM to figure out which APIs to combine to answer a complex query (e.g., "Find companies in SP that won government contracts").

**Implementation for Hefesto:**

- Deploy `mcp-brasil` as a core infrastructural dependency for the Hefesto Agent Runtime.
- The **Hunter Agent** will heavily utilize these tools to enrich lead profiles (CNPJ validation, checking legal processes via DataJud, verifying government contracts).

---

## 3. Action Plan & Roadmap Integration

To implement these findings cleanly into the existing DDD/Hexagonal architecture, we will proceed in the following phases:

### Phase 1: Skill Registry & Metadata Contract (Immediate)

1.  Create a new module in `apps/agent-runtime/src/domain/skills/`.
2.  Define the `Skill` aggregate root and the `skill.meta.json` interface.
3.  Implement an Infrastructure adapter (`LocalFileSystemSkillRegistry`) to auto-discover and load skills on startup.

### Phase 2: Persona Standardization (Short-term)

1.  Refactor existing prompt templates into the comprehensive Markdown format seen in `agency-agents`.
2.  Ensure each persona explicitly lists its allowed "Capabilities" and "Composites".

### Phase 3: HITL Checkpoint Engine (Medium-term)

1.  Update the Agent execution loop to recognize `Checkpoint` yields.
2.  Integrate the suspension of state with the existing BullMQ/Telegram infrastructure, fulfilling the requirements of ADR-004.

### Phase 4: MCP Ecosystem Integration (Medium-term)

1.  Integrate the `mcp-brasil` server into the local `mcp_config.json`.
2.  Write integration tests ensuring the Hefesto runtime can successfully discover and execute tools from this external MCP server.

## 4. Legal & Compliance Considerations

- **Open Source Licenses**: The analyzed projects use MIT licenses, which permit commercial use, modification, and distribution. We must ensure attribution is maintained where code is directly copied.
- **Data Usage (`mcp-brasil`)**: While the code is MIT, the data sources accessed by `mcp-brasil` have their own terms. Hefesto must adhere to the LGPD (Lei Geral de Proteção de Dados). Specifically, when Hunter agents scrape or aggregate public data (e.g., from Receita Federal or Transparência), the data must only be used for legitimate B2B prospecting purposes and respect opt-out requests.

---

_Analysis completed during architectural audit session. Ready for implementation translation._
