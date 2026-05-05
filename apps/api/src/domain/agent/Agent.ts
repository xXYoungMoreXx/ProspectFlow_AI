import { AggregateRoot } from '../shared/AggregateRoot.js';
import { createDomainEvent } from '../shared/DomainEvent.js';
import { ValidationError, InsufficientBudgetError, ok, err, type Result } from '../shared/Result.js';
import type { AgentPersona, AgentStatus, LLMProvider } from '@agentepro/shared-types';

export interface LLMConfiguration {
  readonly provider: LLMProvider;
  readonly model: string;
  readonly baseUrl?: string;
  readonly apiKeyRef?: string;
  readonly temperature: number;
  readonly maxTokens: number;
  readonly systemPrompt?: string;
}

export interface AgentSkill {
  readonly id: string;
  readonly name: string;
  readonly skillType: string;
  readonly config: Record<string, unknown>;
  readonly isEnabled: boolean;
}

export interface AgentRule {
  readonly id: string;
  readonly name: string;
  readonly condition: string;
  readonly action: string;
  readonly priority: number;
  readonly isEnabled: boolean;
}

export interface AgentProps {
  id: string;
  operatorId: string;
  name: string;
  persona: AgentPersona;
  status: AgentStatus;
  llmConfig: LLMConfiguration;
  tokenBudgetTotal: number;
  tokenBudgetRemaining: number;
  ragEnabled: boolean;
  ragCollection?: string;
  ragTopK: number;
  ragThreshold: number;
  hitlTimeoutMinutes: number;
  hitlNotifyChannel: string;
  skills: AgentSkill[];
  rules: AgentRule[];
  createdAt: Date;
  updatedAt: Date;
}

export class Agent extends AggregateRoot {
  private constructor(private props: AgentProps) {
    super();
  }

  // ── Factory ──────────────────────────────────────────────────────────────

  static create(input: {
    id: string;
    operatorId: string;
    name: string;
    persona: AgentPersona;
    llmConfig: LLMConfiguration;
  }): Result<Agent, ValidationError> {
    if (input.name.length < 2 || input.name.length > 100) {
      return err(new ValidationError('Agent name must be between 2 and 100 characters', 'name'));
    }
    if (input.llmConfig.temperature < 0 || input.llmConfig.temperature > 2) {
      return err(new ValidationError('Temperature must be between 0 and 2', 'llm_temperature'));
    }
    if (input.llmConfig.maxTokens < 1 || input.llmConfig.maxTokens > 128_000) {
      return err(new ValidationError('Max tokens must be between 1 and 128000', 'llm_max_tokens'));
    }

    const now = new Date();
    const agent = new Agent({
      id: input.id,
      operatorId: input.operatorId,
      name: input.name,
      persona: input.persona,
      status: 'INACTIVE',
      llmConfig: input.llmConfig,
      tokenBudgetTotal: 1_000_000,
      tokenBudgetRemaining: 1_000_000,
      ragEnabled: false,
      ragTopK: 5,
      ragThreshold: 0.70,
      hitlTimeoutMinutes: 60,
      hitlNotifyChannel: 'email',
      skills: [],
      rules: [],
      createdAt: now,
      updatedAt: now,
    });

    return ok(agent);
  }

  static reconstitute(props: AgentProps): Agent {
    return new Agent(props);
  }

  // ── Getters ──────────────────────────────────────────────────────────────

  get id(): string { return this.props.id; }
  get operatorId(): string { return this.props.operatorId; }
  get name(): string { return this.props.name; }
  get persona(): AgentPersona { return this.props.persona; }
  get status(): AgentStatus { return this.props.status; }
  get llmConfig(): LLMConfiguration { return this.props.llmConfig; }
  get tokenBudgetTotal(): number { return this.props.tokenBudgetTotal; }
  get tokenBudgetRemaining(): number { return this.props.tokenBudgetRemaining; }
  get ragEnabled(): boolean { return this.props.ragEnabled; }
  get ragCollection(): string | undefined { return this.props.ragCollection; }
  get ragTopK(): number { return this.props.ragTopK; }
  get ragThreshold(): number { return this.props.ragThreshold; }
  get hitlTimeoutMinutes(): number { return this.props.hitlTimeoutMinutes; }
  get hitlNotifyChannel(): string { return this.props.hitlNotifyChannel; }
  get skills(): ReadonlyArray<AgentSkill> { return this.props.skills; }
  get rules(): ReadonlyArray<AgentRule> { return this.props.rules; }
  get createdAt(): Date { return this.props.createdAt; }
  get updatedAt(): Date { return this.props.updatedAt; }

  // ── Commands ─────────────────────────────────────────────────────────────

  activate(): Result<void, ValidationError> {
    if (this.props.status === 'ACTIVE') {
      return err(new ValidationError('Agent is already active'));
    }
    this.props.status = 'ACTIVE';
    this.props.updatedAt = new Date();
    this.addDomainEvent(
      createDomainEvent('agent.activated', 'Agent', this.props.id, {
        agentId: this.props.id,
        persona: this.props.persona,
      }),
    );
    return ok(undefined);
  }

  pause(reason?: string): Result<void, ValidationError> {
    if (this.props.status === 'PAUSED') {
      return err(new ValidationError('Agent is already paused'));
    }
    this.props.status = 'PAUSED';
    this.props.updatedAt = new Date();
    this.addDomainEvent(
      createDomainEvent('agent.paused', 'Agent', this.props.id, {
        agentId: this.props.id,
        reason,
      }),
    );
    return ok(undefined);
  }

  updateConfig(updates: Partial<Pick<AgentProps, 'name' | 'llmConfig' | 'ragEnabled' | 'ragCollection' | 'ragTopK' | 'ragThreshold' | 'hitlTimeoutMinutes' | 'hitlNotifyChannel'>>): void {
    if (updates.name !== undefined) this.props.name = updates.name;
    if (updates.llmConfig !== undefined) this.props.llmConfig = updates.llmConfig;
    if (updates.ragEnabled !== undefined) this.props.ragEnabled = updates.ragEnabled;
    if (updates.ragCollection !== undefined) this.props.ragCollection = updates.ragCollection;
    if (updates.ragTopK !== undefined) this.props.ragTopK = updates.ragTopK;
    if (updates.ragThreshold !== undefined) this.props.ragThreshold = updates.ragThreshold;
    if (updates.hitlTimeoutMinutes !== undefined) this.props.hitlTimeoutMinutes = updates.hitlTimeoutMinutes;
    if (updates.hitlNotifyChannel !== undefined) this.props.hitlNotifyChannel = updates.hitlNotifyChannel;
    this.props.updatedAt = new Date();
  }

  consumeTokens(count: number): Result<void, InsufficientBudgetError> {
    if (count > this.props.tokenBudgetRemaining) {
      return err(new InsufficientBudgetError(
        `Need ${count} tokens but only ${this.props.tokenBudgetRemaining} remaining`,
      ));
    }
    this.props.tokenBudgetRemaining -= count;
    this.props.updatedAt = new Date();
    return ok(undefined);
  }

  recordTaskCompleted(taskType: string, durationMs: number, tokensUsed: number): void {
    this.addDomainEvent(
      createDomainEvent('agent.task_completed', 'Agent', this.props.id, {
        agentId: this.props.id,
        taskType,
        durationMs,
        tokensUsed,
      }),
    );
  }

  toJSON(): AgentProps {
    return { ...this.props };
  }
}
