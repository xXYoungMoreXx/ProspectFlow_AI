# SPEC-02: Agent Management — Gestão de Agentes e Sub-agentes

> Versão: 2.1.0 | Fase: 1 | Dependências: SPEC-01 (IAM) | Ver também: SPEC-13 (Agent Capability Studio UI), SPEC-14 (Service Catalog + Skills Builtin)

---

## Escopo

- CRUD completo de Agentes Primários via UI e API
- CRUD completo de Sub-agentes por Agente
- Gestão de Skills, Rules e MCP Servers por Agente/Sub-agente
- Ativação/Pausa de Agentes com validação de pré-condições
- Token budget tracking por agente
- Teste de LLM inline (validar configuração antes de ativar)

---

## Regras de Negócio

```
1. Um Agente só pode ser ativado se tiver ao menos 1 skill configurada.
2. Um Agente com tokenBudgetRemaining <= 0 é pausado automaticamente.
3. Ao ativar um Agente, verificar conectividade com o LLM configurado.
4. Deletar um Agente é proibido se há deals/projects ativos vinculados.
5. Sub-agentes herdam as skills do agente pai mas podem ser restritos.
6. system_prompt máximo: 32.000 chars (validado na camada de aplicação).
7. Apenas o operador dono do agente pode editá-lo.
8. Rules são avaliadas em ordem de prioridade (menor número = maior prioridade).
```

---

## Agent Aggregate — Interface Completa

```typescript
// domain/agent/Agent.ts

class Agent extends AggregateRoot {
  // Factory
  static create(props: CreateAgentProps): Agent {
    if (!props.name || props.name.trim().length < 3) {
      throw new ValidationError(
        "Nome do agente deve ter ao menos 3 caracteres",
        "name",
      );
    }

    const agent = new Agent({
      id: AgentId.create(),
      operatorId: props.operatorId,
      name: new AgentName(props.name.trim()),
      persona: props.persona,
      status: "INACTIVE",
      llmConfig: props.llmConfig,
      subAgents: [],
      skills: [],
      rules: [],
      mcpServers: [],
      tokenBudgetTotal: props.tokenBudgetTotal ?? 1_000_000,
      tokenBudgetRemaining: props.tokenBudgetTotal ?? 1_000_000,
      tokenBudgetCostUsd: 0,
      parallelExecutionEnabled: props.parallelExecutionEnabled ?? false,
      maxParallelSubAgents: props.maxParallelSubAgents ?? 1,
      hitlTimeoutMinutes: props.hitlTimeoutMinutes ?? 60,
      hitlNotifyChannel: props.hitlNotifyChannel ?? "telegram",
    });
    agent.addEvent(createAgentCreatedEvent(agent));
    return agent;
  }

  // Ativar
  activate(): void {
    if (this.status === "ACTIVE") return; // idempotente
    if (this.skills.length === 0) {
      throw new DomainError(
        "Agente precisa de ao menos 1 skill configurada para ser ativado",
        "AGENT_NO_SKILLS",
      );
    }
    if (this.tokenBudgetRemaining <= 0) {
      throw new DomainError("Token budget esgotado", "BUDGET_EXHAUSTED");
    }
    this.status = "ACTIVE";
    this.addEvent(createAgentActivatedEvent(this));
  }

  // Pausar
  pause(): void {
    if (this.status === "INACTIVE") {
      throw new DomainError(
        "Não é possível pausar agente INACTIVE",
        "INVALID_STATE",
      );
    }
    this.status = "PAUSED";
    this.addEvent(createAgentPausedEvent(this));
  }

  // Gestão de sub-agentes
  addSubAgent(sub: SubAgent): void {
    const exists = this.subAgents.some((s) => s.role === sub.role);
    if (exists) {
      throw new DomainError(
        `Sub-agente ${sub.role} já existe neste agente`,
        "DUPLICATE_SUB_AGENT",
      );
    }
    this.subAgents.push(sub);
  }

  removeSubAgent(subAgentId: SubAgentId): void {
    const idx = this.subAgents.findIndex((s) => s.id.equals(subAgentId));
    if (idx === -1) throw new NotFoundError("SubAgent", subAgentId.value);
    this.subAgents.splice(idx, 1);
  }

  // Gestão de skills
  addSkill(skill: AgentSkill): void {
    this.skills.push(skill);
  }

  removeSkill(skillId: SkillId): void {
    const idx = this.skills.findIndex((s) => s.id.equals(skillId));
    if (idx === -1) throw new NotFoundError("Skill", skillId.value);
    this.skills.splice(idx, 1);
  }

  // Consumo de tokens
  consumeTokens(tokens: number, costUsd: number): void {
    this.tokenBudgetRemaining -= tokens;
    this.tokenBudgetCostUsd += costUsd;

    if (this.tokenBudgetRemaining <= 0) {
      this.tokenBudgetRemaining = 0;
      this.pause();
      this.addEvent(createTokenBudgetExhaustedEvent(this));
    }
  }

  // Canary check
  canExecuteTask(taskType: string): boolean {
    return this.status === "ACTIVE" && this.tokenBudgetRemaining > 0;
  }
}
```

### SubAgent Value Object

```typescript
// domain/agent/SubAgent.ts

class SubAgent {
  constructor(
    readonly id: SubAgentId,
    readonly parentAgentId: AgentId,
    readonly role: SubAgentRole,
    // Roles válidos por persona:
    // HUNTER:   PROSPECTOR | SITE_INSPECTOR | DATA_ENRICHER
    // CLOSER:   OUTREACH_WRITER | CONV_HANDLER | PROPOSAL_WRITER | DEAL_TRACKER
    // BRIEFING: INTERVIEWER | BRIEF_EXTRACTOR
    // BUILDER:  COPYWRITER | DESIGNER | IMAGER | CODER | SEO_OPTIMIZER | DEPLOYER
    // QA:       SEC_AUDITOR | PERF_AUDITOR | CONTENT_CHECK
    // DELIVERY: TUTORIAL_GENERATOR | DOC_GENERATOR | NOTIFIER
    readonly llmProvider: LLMProvider,
    readonly llmModel: string,
    readonly llmTemperature: number,
    readonly llmMaxTokens: number,
    readonly executionMode: 'sequential' | 'parallel',
    readonly parallelGroup: number | undefined,
    readonly maxRetries: number,
    readonly timeoutSeconds: number,
    readonly isEnabled: boolean,
    readonly skillRefs: SkillId[],
  ) {}

  canRunParallelWith(other: SubAgent): boolean {
    return (
      this.executionMode === 'parallel' &&
      other.executionMode === 'parallel' &&
      this.parallelGroup !== undefined &&
      this.parallelGroup === other.parallelGroup
    );
  }

  static create(props: CreateSubAgentProps): SubAgent {
    if (props.executionMode === 'parallel' && props.parallelGroup === undefined) {
      throw new ValidationError(
        'Sub-agentes parallel devem ter parallelGroup definido', 'parallelGroup'
      );
    }
    if (props.llmTemperature < 0 || props.llmTemperature > 2) {
      throw new ValidationError('Temperature deve ser entre 0 e 2', 'llmTemperature');
    }
    return new SubAgent(SubAgentId.create(), props.parentAgentId, ...);
  }
}
```

### AgentSkill

```typescript
// domain/agent/AgentSkill.ts

type SkillType =
  | "web_search"
  | "scraping"
  | "email"
  | "whatsapp"
  | "telegram"
  | "file_gen"
  | "deploy"
  | "code_gen"
  | "rag_query"
  | "external_database"
  | "image_gen"
  | "design_gen"
  | "scheduling";

class AgentSkill {
  constructor(
    readonly id: SkillId,
    readonly agentId: AgentId,
    readonly subAgentId: SubAgentId | undefined, // null = skill do agente principal
    readonly name: string,
    readonly type: SkillType,
    readonly config: Record<string, unknown>,
    readonly isEnabled: boolean,
  ) {}

  // Config é validado por tipo de skill:
  static validateConfig(
    type: SkillType,
    config: Record<string, unknown>,
  ): void {
    const validators: Record<SkillType, (c: unknown) => void> = {
      whatsapp: (c) => assert(c, "evolution_api_url", "instance_name"),
      telegram: (c) => assert(c, "bot_token_ref", "parse_mode"),
      external_database: (c) => assert(c, "provider"),
      image_gen: (c) => assert(c, "providers", "fallback_chain"),
      design_gen: (c) => assert(c, "model", "api_key_ref"),
      scheduling: (c) => assert(c, "provider", "event_type_id"),
      deploy: (c) => assert(c, "platforms", "default_platform"),
      // ... demais tipos
    };
    validators[type]?.(config);
  }
}
```

---

## Use Cases

### CreateAgentUseCase

```typescript
interface CreateAgentCommand {
  operatorId: string;
  name: string;
  persona: AgentPersona;
  llmConfig: {
    provider: LLMProvider;
    modelName: string;
    baseUrl?: string;
    apiKeyRef?: string;
    temperature: number;
    maxTokens: number;
    systemPrompt?: string;
  };
  tokenBudgetTotal?: number;
  hitlTimeoutMinutes?: number;
  hitlNotifyChannel?: "telegram" | "email";
  parallelExecutionEnabled?: boolean;
  maxParallelSubAgents?: number;
}

class CreateAgentUseCase {
  async execute(cmd: CreateAgentCommand): Promise<{ agentId: string }> {
    // Validar system_prompt <= 32.000 chars na camada de aplicação
    if ((cmd.llmConfig.systemPrompt?.length ?? 0) > 32_000) {
      throw new ValidationError(
        "systemPrompt excede 32.000 caracteres",
        "systemPrompt",
      );
    }

    const agent = Agent.create({
      operatorId: new OperatorId(cmd.operatorId),
      ...cmd,
    });

    await this.agentRepo.save(agent);
    await this.eventBus.publishAll(agent.pullEvents());
    return { agentId: agent.id.value };
  }
}
```

### ActivateAgentUseCase

```typescript
class ActivateAgentUseCase {
  async execute(cmd: { agentId: string; operatorId: string }): Promise<void> {
    const agent = await this.agentRepo.findById(new AgentId(cmd.agentId));
    if (!agent) throw new NotFoundError("Agent", cmd.agentId);
    if (agent.operatorId.value !== cmd.operatorId)
      throw new AuthorizationError();

    // Verificar conectividade com o LLM antes de ativar
    await this.testLLMConnectivity(agent.llmConfig);

    agent.activate();
    await this.agentRepo.save(agent);
    await this.eventBus.publishAll(agent.pullEvents());
  }

  private async testLLMConnectivity(config: LLMConfiguration): Promise<void> {
    try {
      await this.llmRouter.ping(config);
    } catch {
      throw new DomainError(
        `Não foi possível conectar ao LLM ${config.provider}/${config.modelName}`,
        "LLM_CONNECTIVITY_ERROR",
      );
    }
  }
}
```

### TestLLMUseCase (validar config antes de ativar)

```typescript
class TestLLMUseCase {
  async execute(cmd: {
    agentId: string;
    testPrompt: string;
  }): Promise<{ response: string; latencyMs: number }> {
    const agent = await this.agentRepo.findById(new AgentId(cmd.agentId));
    if (!agent) throw new NotFoundError("Agent", cmd.agentId);

    const start = Date.now();
    const response = await this.llmRouter.complete(agent.llmConfig, [
      { role: "user", content: cmd.testPrompt },
    ]);

    return {
      response: response.content.slice(0, 500), // Truncar para preview
      latencyMs: Date.now() - start,
    };
  }
}
```

---

## API Endpoints

### Agents CRUD

```
GET    /api/v1/agents
  Query: persona?, status?, limit?, cursor?
  Response: { data: Agent[], meta: PaginationMeta }

POST   /api/v1/agents
  Body: CreateAgentRequest
  Response 201: { data: Agent }

GET    /api/v1/agents/:id
  Response 200: { data: Agent }
  Response 404: NotFound

PATCH  /api/v1/agents/:id
  Body: Partial<CreateAgentRequest>
  Restrição: não pode editar persona
  Response 200: { data: Agent }

POST   /api/v1/agents/:id/activate
  Body: {} (vazio)
  Response 200: { data: { id, status: 'ACTIVE' } }
  Erros: 409 (AGENT_NO_SKILLS), 409 (BUDGET_EXHAUSTED), 409 (LLM_CONNECTIVITY_ERROR)

POST   /api/v1/agents/:id/pause
  Response 200: { data: { id, status: 'PAUSED' } }

POST   /api/v1/agents/:id/test-llm
  Body: { testPrompt: string }
  Response 200: { data: { response: string, latencyMs: number } }

GET    /api/v1/agents/:id/logs
  Query: limit?, cursor?, status?
  Response 200: { data: AgentLog[] }

GET    /api/v1/agents/:id/token-usage
  Query: period? (today|week|month)
  Response 200: { data: { totalTokens, totalCostUsd, bySubAgent: [...] } }
```

### Sub-agents CRUD

```
GET    /api/v1/agents/:id/sub-agents
  Response 200: { data: SubAgent[] }

POST   /api/v1/agents/:id/sub-agents
  Body: CreateSubAgentRequest
  Response 201: { data: SubAgent }
  Erro: 409 se role já existe no agente

PATCH  /api/v1/agents/:id/sub-agents/:subId
  Body: Partial<CreateSubAgentRequest>
  Response 200: { data: SubAgent }

DELETE /api/v1/agents/:id/sub-agents/:subId
  Response 204
  Restrição: não permitir se agente está ACTIVE

POST   /api/v1/agents/:id/sub-agents/:subId/test
  Body: { testPayload: Record<string, unknown> }
  Response 200: { data: { output: unknown, durationMs: number, costUsd: number } }
```

### Skills CRUD

```
GET    /api/v1/agents/:id/skills
POST   /api/v1/agents/:id/skills
  Body: { name, type, config, subAgentId?, isEnabled }
PATCH  /api/v1/agents/:id/skills/:skillId
DELETE /api/v1/agents/:id/skills/:skillId
```

### Rules CRUD

```
GET    /api/v1/agents/:id/rules
POST   /api/v1/agents/:id/rules
  Body: { name, condition, action, priority }
  Validação: condition deve ser CEL válido (testar parse)
PATCH  /api/v1/agents/:id/rules/:ruleId
DELETE /api/v1/agents/:id/rules/:ruleId
```

### RAG

```
GET    /api/v1/agents/:id/rag/documents
POST   /api/v1/agents/:id/rag/documents
  Multipart: file (PDF | MD | TXT, max 10MB)
  Validação: magic bytes obrigatória
  Processamento: assíncrono (chunking + embedding via BullMQ)
DELETE /api/v1/agents/:id/rag/documents/:docId
POST   /api/v1/agents/:id/rag/query
  Body: { query: string, topK?: number }
  Response 200: { data: { results: RagResult[], durationMs: number } }
```

### MCP Servers CRUD

```
GET    /api/v1/agents/:id/mcp-servers
  Response 200: { data: MCPServer[] }

POST   /api/v1/agents/:id/mcp-servers
  Body: { name, url, authType, authSecretRef?, allowedTools, allowedSubAgentIds? }
  Validação: SSRF check (bloquear RFC1918 exceto ALLOWED_MCP_HOSTS env)
  Ação: tenta conectar e listar ferramentas disponíveis no MCP
  Response 201: { data: MCPServer }
  Erros: 422 MCP_CONNECTION_FAILED | 400 SSRF_BLOCKED

PATCH  /api/v1/agents/:id/mcp-servers/:mcpId
  Body: Partial<MCPServer>
  Response 200: { data: MCPServer }

DELETE /api/v1/agents/:id/mcp-servers/:mcpId
  Response 204

POST   /api/v1/agents/:id/mcp-servers/:mcpId/test
  Response 200: { data: { connected: boolean, tools: string[], latencyMs: number } }
```

### Workflow Management (ver SPEC-13 para definição completa)

```
GET    /api/v1/agents/:id/workflow
  Response 200: { data: WorkflowDefinition }

PUT    /api/v1/agents/:id/workflow
  Body: WorkflowDefinition
  Validação: DAG (sem ciclos), subAgentIds devem existir
  Response 200: { data: WorkflowDefinition }
  Erros: 422 WORKFLOW_HAS_CYCLE | 422 SUBAGENT_NOT_FOUND

POST   /api/v1/agents/:id/workflow/test
  Body: { testPayload: Record<string, unknown> }
  Response 202: { data: { jobId, estimatedSeconds } }
```

### Skill Catalog (ver SPEC-14 para lista completa de skills builtin)

```
GET    /api/v1/skill-catalog
  Query: serviceType?, persona?, search?, limit?, cursor?
  Response 200: { data: SkillCatalogEntry[], meta: PaginationMeta }

POST   /api/v1/agents/:id/skills/from-catalog
  Body: { catalogSkillId: string, subAgentId?: string }
  Response 201: { data: AgentSkill }
```

---

## Database Schema

```sql
-- Já definido no SPEC-00 e PRD, resumo aqui para referência:

-- agents: persona, status, llm_*, token_budget_*, parallel_*, hitl_*
-- sub_agents: agent_id, role, llm_*, execution_mode, parallel_group
-- agent_skills: agent_id, sub_agent_id?, name, skill_type, config JSONB
-- agent_rules: agent_id, name, condition, action, priority
-- mcp_servers: agent_id, name, url, auth_ref, allowed_tools JSONB

-- Index crítico para performance
CREATE INDEX idx_agents_operator_status ON agents(operator_id, status);
CREATE INDEX idx_sub_agents_role ON sub_agents(agent_id, role);
```

---

## Testes Obrigatórios

```typescript
describe('Agent') {
  it('activate() lança DomainError sem skills')
  it('activate() lança DomainError com budget esgotado')
  it('activate() emite AgentActivated quando válido')
  it('pause() lança DomainError quando INACTIVE')
  it('addSubAgent() lança DomainError para role duplicado')
  it('consumeTokens() pausa agente quando budget <= 0')
  it('consumeTokens() emite TokenBudgetExhausted quando esgota')
  it('canExecuteTask() retorna false quando PAUSED')
}

describe('SubAgent') {
  it('canRunParallelWith() true para mesmo parallelGroup')
  it('canRunParallelWith() false para grupos diferentes')
  it('create() lança ValidationError para parallel sem parallelGroup')
  it('create() lança ValidationError para temperature fora de [0,2]')
}

describe('CreateAgentUseCase') {
  it('cria agente com status INACTIVE')
  it('lança ValidationError para systemPrompt > 32.000 chars')
  it('emite AgentCreated event')
}

describe('ActivateAgentUseCase') {
  it('ativa agente com skill configurada e LLM acessível')
  it('lança 409 quando agente sem skills')
  it('lança 409 quando LLM não responde')
  it('lança AuthorizationError quando outro operador tenta ativar')
}

describe('POST /api/v1/agents/:id/activate') {
  it('200 para agente válido')
  it('404 para agente inexistente')
  it('409 AGENT_NO_SKILLS para agente sem skills')
  it('401 sem token')
  it('403 para agente de outro operador')
}
```

---

## Critérios de Aceite

- [ ] CRUD completo de agentes via API (create, read, update, activate, pause)
- [ ] CRUD completo de sub-agentes (create, update, delete, test)
- [ ] Ativação falha sem skills configuradas (409 claro)
- [ ] Ativação testa conectividade LLM antes de mudar status
- [ ] tokenBudgetRemaining decrementa corretamente ao consumir
- [ ] Agente pausado automaticamente quando budget = 0
- [ ] Upload de documento RAG: magic bytes validados, processamento assíncrono
- [ ] systemPrompt > 32k chars rejeitado com ValidationError claro
- [ ] Sub-agente parallel sem parallelGroup rejeitado
- [ ] Apenas o dono do agente pode editá-lo/ativá-lo
- [ ] MCP Server: SSRF check bloqueia RFC1918 não na whitelist (400 SSRF_BLOCKED)
- [ ] MCP Server: recusado se não responder em 5s (422 MCP_CONNECTION_FAILED)
- [ ] Workflow: grafo com ciclo rejeitado (422 WORKFLOW_HAS_CYCLE)
- [ ] Skill builtin não pode ser deletada (403)
- [ ] Skill clonada do catálogo é editável no agente (is_builtin=false)
- [ ] UI implementada como Agent Capability Studio com 8 abas (ver SPEC-13)
