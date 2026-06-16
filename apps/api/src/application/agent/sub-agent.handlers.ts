import type {
  AgentRepository,
  SubAgentData,
  CreateSubAgentData,
  UpdateSubAgentData,
} from "../../domain/agent/AgentRepository.js";
import {
  NotFoundError,
  ok,
  err,
  type Result,
} from "../../domain/shared/Result.js";
import type { CompositeLLMRouter } from "../../infrastructure/llm/CompositeLLMRouter.js";

// ── List ──────────────────────────────────────────────────────────────────────

export class ListSubAgentsHandler {
  constructor(private readonly repo: AgentRepository) {}

  async execute(
    agentId: string,
    operatorId: string,
    organizationId: string = "org_mvp",
  ): Promise<Result<SubAgentData[], Error>> {
    const agent = await this.repo.findById(agentId, operatorId, organizationId);
    if (!agent) return err(new NotFoundError("Agent", agentId));
    const list = await this.repo.listSubAgents(agentId);
    return ok(list);
  }
}

// ── Create ────────────────────────────────────────────────────────────────────

export class CreateSubAgentHandler {
  constructor(private readonly repo: AgentRepository) {}

  async execute(
    agentId: string,
    operatorId: string,
    input: Omit<CreateSubAgentData, "agentId">,
    organizationId: string = "org_mvp",
  ): Promise<Result<SubAgentData, Error>> {
    const agent = await this.repo.findById(agentId, operatorId, organizationId);
    if (!agent) return err(new NotFoundError("Agent", agentId));

    if (
      input.executionMode === "parallel" &&
      input.parallelGroup === undefined
    ) {
      return err(
        new Error("parallelGroup is required when executionMode is parallel"),
      );
    }

    const sub = await this.repo.addSubAgent({ ...input, agentId });
    return ok(sub);
  }
}

// ── Get single ────────────────────────────────────────────────────────────────

export class GetSubAgentHandler {
  constructor(private readonly repo: AgentRepository) {}

  async execute(
    agentId: string,
    subAgentId: string,
    operatorId: string,
    organizationId: string = "org_mvp",
  ): Promise<Result<SubAgentData, Error>> {
    const agent = await this.repo.findById(agentId, operatorId, organizationId);
    if (!agent) return err(new NotFoundError("Agent", agentId));
    const sub = await this.repo.getSubAgent(subAgentId, agentId);
    if (!sub) return err(new NotFoundError("SubAgent", subAgentId));
    return ok(sub);
  }
}

// ── Update ────────────────────────────────────────────────────────────────────

export class UpdateSubAgentHandler {
  constructor(private readonly repo: AgentRepository) {}

  async execute(
    agentId: string,
    subAgentId: string,
    operatorId: string,
    data: UpdateSubAgentData,
    organizationId: string = "org_mvp",
  ): Promise<Result<SubAgentData, Error>> {
    const agent = await this.repo.findById(agentId, operatorId, organizationId);
    if (!agent) return err(new NotFoundError("Agent", agentId));

    if (data.executionMode === "parallel" && data.parallelGroup === undefined) {
      return err(
        new Error("parallelGroup is required when executionMode is parallel"),
      );
    }

    const updated = await this.repo.updateSubAgent(subAgentId, agentId, data);
    if (!updated) return err(new NotFoundError("SubAgent", subAgentId));
    return ok(updated);
  }
}

// ── Delete — blocked when agent is ACTIVE ────────────────────────────────────

export class DeleteSubAgentHandler {
  constructor(private readonly repo: AgentRepository) {}

  async execute(
    agentId: string,
    subAgentId: string,
    operatorId: string,
    organizationId: string = "org_mvp",
  ): Promise<Result<void, Error>> {
    const agent = await this.repo.findById(agentId, operatorId, organizationId);
    if (!agent) return err(new NotFoundError("Agent", agentId));

    if (agent.status === "ACTIVE") {
      const conflict = new Error(
        "Cannot delete sub-agent while agent is ACTIVE. Pause the agent first.",
      );
      (conflict as NodeJS.ErrnoException).code = "AGENT_ACTIVE";
      return err(conflict);
    }

    const sub = await this.repo.getSubAgent(subAgentId, agentId);
    if (!sub) return err(new NotFoundError("SubAgent", subAgentId));

    await this.repo.removeSubAgent(subAgentId, agentId);
    return ok(undefined);
  }
}

// ── Test — validates LLM config with a minimal ping ──────────────────────────

export interface SubAgentTestResult {
  output: string;
  durationMs: number;
  costUsd: number;
  tokensUsed: number;
}

export class TestSubAgentHandler {
  constructor(
    private readonly repo: AgentRepository,
    private readonly llm: CompositeLLMRouter,
  ) {}

  async execute(
    agentId: string,
    subAgentId: string,
    operatorId: string,
    organizationId: string = "org_mvp",
  ): Promise<Result<SubAgentTestResult, Error>> {
    const agent = await this.repo.findById(agentId, operatorId, organizationId);
    if (!agent) return err(new NotFoundError("Agent", agentId));

    const sub = await this.repo.getSubAgent(subAgentId, agentId);
    if (!sub) return err(new NotFoundError("SubAgent", subAgentId));

    const t0 = performance.now();

    try {
      const response = await this.llm.complete({
        provider: sub.llmProvider,
        model: sub.llmModel,
        apiKeyRef: agent.llmConfig.apiKeyRef,
        messages: [{ role: "user", content: "Respond with: OK" }],
        temperature: sub.llmTemperature,
        maxTokens: 10,
      });

      const durationMs = Math.round(performance.now() - t0);
      // Rough cost estimate: $0.01 per 1k tokens (conservative)
      const costUsd = Number(((response.tokensUsed / 1000) * 0.01).toFixed(6));

      return ok({
        output: response.content,
        durationMs,
        costUsd,
        tokensUsed: response.tokensUsed,
      });
    } catch (e) {
      return err(e instanceof Error ? e : new Error(String(e)));
    }
  }
}
