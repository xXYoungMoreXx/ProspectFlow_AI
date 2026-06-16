import { ulid } from "ulid";
import type {
  AgentRepository,
  AgentFilters,
  AgentListResult,
} from "../../domain/agent/AgentRepository.js";
import { Agent, type LLMConfiguration } from "../../domain/agent/Agent.js";
import {
  NotFoundError,
  ok,
  err,
  type Result,
} from "../../domain/shared/Result.js";
import type { AgentPersona, LLMProvider } from "@agentepro/shared-types";
import type { CompositeLLMRouter } from "../../infrastructure/llm/CompositeLLMRouter.js";

// ── Commands ──────────────────────────────────────────────────────────────────

export class CreateAgentHandler {
  constructor(private readonly repo: AgentRepository) {}

  async execute(
    operatorId: string,
    input: {
      name: string;
      persona: AgentPersona;
      llmProvider: LLMProvider;
      llmModel: string;
      llmBaseUrl?: string;
      llmApiKeyRef?: string;
      llmTemperature?: number;
      llmMaxTokens?: number;
      llmSystemPrompt?: string;
    },
  ): Promise<Result<Agent, Error>> {
    const llmConfig: LLMConfiguration = {
      provider: input.llmProvider,
      model: input.llmModel,
      baseUrl: input.llmBaseUrl,
      apiKeyRef: input.llmApiKeyRef,
      temperature: input.llmTemperature ?? 0.7,
      maxTokens: input.llmMaxTokens ?? 4096,
      systemPrompt: input.llmSystemPrompt,
    };

    const agentResult = Agent.create({
      id: ulid(),
      operatorId,
      name: input.name,
      persona: input.persona,
      llmConfig,
    });

    if (agentResult.isErr()) return agentResult;

    const agent = agentResult.value;
    await this.repo.save(agent);
    return ok(agent);
  }
}

export class UpdateAgentHandler {
  constructor(private readonly repo: AgentRepository) {}

  async execute(
    agentId: string,
    operatorId: string,
    updates: Record<string, unknown>,
    organizationId: string = "org_mvp",
  ): Promise<Result<Agent, Error>> {
    const agent = await this.repo.findById(agentId, operatorId, organizationId);
    if (!agent) return err(new NotFoundError("Agent", agentId));

    // Map flat updates to domain model
    const configUpdates: Parameters<Agent["updateConfig"]>[0] = {};
    if (updates["name"] !== undefined)
      configUpdates.name = updates["name"] as string;
    if (updates["ragEnabled"] !== undefined)
      configUpdates.ragEnabled = updates["ragEnabled"] as boolean;
    if (updates["ragCollection"] !== undefined)
      configUpdates.ragCollection = updates["ragCollection"] as string;
    if (updates["ragTopK"] !== undefined)
      configUpdates.ragTopK = updates["ragTopK"] as number;
    if (updates["ragThreshold"] !== undefined)
      configUpdates.ragThreshold = updates["ragThreshold"] as number;
    if (updates["hitlTimeoutMinutes"] !== undefined)
      configUpdates.hitlTimeoutMinutes = updates[
        "hitlTimeoutMinutes"
      ] as number;
    if (updates["hitlNotifyChannel"] !== undefined)
      configUpdates.hitlNotifyChannel = updates["hitlNotifyChannel"] as string;

    // LLM config rebuild if any llm field present
    if (
      updates["llmProvider"] ||
      updates["llmModel"] ||
      updates["llmTemperature"] ||
      updates["llmMaxTokens"] ||
      updates["llmSystemPrompt"]
    ) {
      configUpdates.llmConfig = {
        provider: (updates["llmProvider"] ??
          agent.llmConfig.provider) as LLMProvider,
        model: (updates["llmModel"] ?? agent.llmConfig.model) as string,
        baseUrl: (updates["llmBaseUrl"] ?? agent.llmConfig.baseUrl) as
          | string
          | undefined,
        apiKeyRef: (updates["llmApiKeyRef"] ?? agent.llmConfig.apiKeyRef) as
          | string
          | undefined,
        temperature: (updates["llmTemperature"] ??
          agent.llmConfig.temperature) as number,
        maxTokens: (updates["llmMaxTokens"] ??
          agent.llmConfig.maxTokens) as number,
        systemPrompt: (updates["llmSystemPrompt"] ??
          agent.llmConfig.systemPrompt) as string | undefined,
      };
    }

    agent.updateConfig(configUpdates);
    await this.repo.save(agent);
    return ok(agent);
  }
}

export class ActivateAgentHandler {
  constructor(
    private readonly repo: AgentRepository,
    private readonly llm?: CompositeLLMRouter,
  ) {}

  async execute(
    agentId: string,
    operatorId: string,
    organizationId: string = "org_mvp",
  ): Promise<Result<void, Error>> {
    const agent = await this.repo.findById(agentId, operatorId, organizationId);
    if (!agent) return err(new NotFoundError("Agent", agentId));

    // SPEC-02 rule 3: verify LLM connectivity before activation
    if (this.llm) {
      const available = await this.llm
        .isAvailable(agent.llmConfig.provider)
        .catch(() => false);
      if (!available) {
        const e = new Error(
          `LLM provider '${agent.llmConfig.provider}' is not reachable`,
        );
        (e as NodeJS.ErrnoException).code = "LLM_CONNECTIVITY_ERROR";
        return err(e);
      }
    }

    const result = agent.activate();
    if (result.isErr()) return result;

    await this.repo.save(agent);
    return ok(undefined);
  }
}

export class PauseAgentHandler {
  constructor(private readonly repo: AgentRepository) {}

  async execute(
    agentId: string,
    operatorId: string,
    reason?: string,
    organizationId: string = "org_mvp",
  ): Promise<Result<void, Error>> {
    const agent = await this.repo.findById(agentId, operatorId, organizationId);
    if (!agent) return err(new NotFoundError("Agent", agentId));

    const result = agent.pause(reason);
    if (result.isErr()) return result;

    await this.repo.save(agent);
    return ok(undefined);
  }
}

// ── Queries ───────────────────────────────────────────────────────────────────

export class GetAgentsHandler {
  constructor(private readonly repo: AgentRepository) {}

  async execute(filters: AgentFilters): Promise<AgentListResult> {
    return this.repo.findMany(filters);
  }
}

export class GetAgentByIdHandler {
  constructor(private readonly repo: AgentRepository) {}

  async execute(
    agentId: string,
    operatorId: string,
    organizationId: string = "org_mvp",
  ): Promise<Result<Agent, NotFoundError>> {
    const agent = await this.repo.findById(agentId, operatorId, organizationId);
    if (!agent) return err(new NotFoundError("Agent", agentId));
    return ok(agent);
  }
}
