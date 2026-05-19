/**
 * CQRS Handlers for Agent Rule sub-resources.
 * Manages rules attached to agent aggregates.
 */
import type {
  AgentRepository,
  CreateRuleData,
  UpdateRuleData,
} from "../../domain/agent/AgentRepository.js";
import type { AgentRule } from "../../domain/agent/Agent.js";
import {
  NotFoundError,
  ok,
  err,
  type Result,
} from "../../domain/shared/Result.js";

export class AddRuleHandler {
  constructor(private readonly repo: AgentRepository) {}

  async execute(
    agentId: string,
    operatorId: string,
    input: {
      name: string;
      condition: string;
      action: string;
      priority?: number;
      isEnabled?: boolean;
    },
  ): Promise<Result<AgentRule, Error>> {
    const agent = await this.repo.findById(agentId, operatorId);
    if (!agent) return err(new NotFoundError("Agent", agentId));

    const data: CreateRuleData = {
      agentId,
      name: input.name,
      condition: input.condition,
      action: input.action,
      priority: input.priority ?? 100,
      isEnabled: input.isEnabled ?? true,
    };

    const rule = await this.repo.addRule(data);
    return ok(rule);
  }
}

export class UpdateRuleHandler {
  constructor(private readonly repo: AgentRepository) {}

  async execute(
    agentId: string,
    ruleId: string,
    operatorId: string,
    updates: UpdateRuleData,
  ): Promise<Result<AgentRule, Error>> {
    const agent = await this.repo.findById(agentId, operatorId);
    if (!agent) return err(new NotFoundError("Agent", agentId));

    const rule = await this.repo.updateRule(ruleId, agentId, updates);
    if (!rule) return err(new NotFoundError("Rule", ruleId));
    return ok(rule);
  }
}

export class RemoveRuleHandler {
  constructor(private readonly repo: AgentRepository) {}

  async execute(
    agentId: string,
    ruleId: string,
    operatorId: string,
  ): Promise<Result<void, Error>> {
    const agent = await this.repo.findById(agentId, operatorId);
    if (!agent) return err(new NotFoundError("Agent", agentId));

    const removed = await this.repo.removeRule(ruleId, agentId);
    if (!removed) return err(new NotFoundError("Rule", ruleId));
    return ok(undefined);
  }
}

export class ListRulesHandler {
  constructor(private readonly repo: AgentRepository) {}

  async execute(
    agentId: string,
    operatorId: string,
  ): Promise<Result<AgentRule[], Error>> {
    const agent = await this.repo.findById(agentId, operatorId);
    if (!agent) return err(new NotFoundError("Agent", agentId));

    const rules = await this.repo.listRules(agentId);
    return ok(rules);
  }
}
