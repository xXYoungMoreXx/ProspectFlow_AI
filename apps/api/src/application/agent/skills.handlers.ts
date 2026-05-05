/**
 * CQRS Handlers for Agent Skill sub-resources.
 * Manages skills attached to agent aggregates.
 */
import type { AgentRepository, CreateSkillData, UpdateSkillData } from '../../domain/agent/AgentRepository.js';
import type { AgentSkill } from '../../domain/agent/Agent.js';
import { NotFoundError, ok, err, type Result } from '../../domain/shared/Result.js';

export class AddSkillHandler {
  constructor(private readonly repo: AgentRepository) {}

  async execute(agentId: string, operatorId: string, input: {
    name: string;
    skillType: string;
    config?: Record<string, unknown>;
    isEnabled?: boolean;
  }): Promise<Result<AgentSkill, Error>> {
    const agent = await this.repo.findById(agentId, operatorId);
    if (!agent) return err(new NotFoundError('Agent', agentId));

    const data: CreateSkillData = {
      agentId,
      name: input.name,
      skillType: input.skillType,
      config: input.config ?? {},
      isEnabled: input.isEnabled ?? true,
    };

    const skill = await this.repo.addSkill(data);
    return ok(skill);
  }
}

export class UpdateSkillHandler {
  constructor(private readonly repo: AgentRepository) {}

  async execute(agentId: string, skillId: string, operatorId: string, updates: UpdateSkillData): Promise<Result<AgentSkill, Error>> {
    const agent = await this.repo.findById(agentId, operatorId);
    if (!agent) return err(new NotFoundError('Agent', agentId));

    const skill = await this.repo.updateSkill(skillId, agentId, updates);
    if (!skill) return err(new NotFoundError('Skill', skillId));
    return ok(skill);
  }
}

export class RemoveSkillHandler {
  constructor(private readonly repo: AgentRepository) {}

  async execute(agentId: string, skillId: string, operatorId: string): Promise<Result<void, Error>> {
    const agent = await this.repo.findById(agentId, operatorId);
    if (!agent) return err(new NotFoundError('Agent', agentId));

    const removed = await this.repo.removeSkill(skillId, agentId);
    if (!removed) return err(new NotFoundError('Skill', skillId));
    return ok(undefined);
  }
}

export class ListSkillsHandler {
  constructor(private readonly repo: AgentRepository) {}

  async execute(agentId: string, operatorId: string): Promise<Result<AgentSkill[], Error>> {
    const agent = await this.repo.findById(agentId, operatorId);
    if (!agent) return err(new NotFoundError('Agent', agentId));

    const skills = await this.repo.listSkills(agentId);
    return ok(skills);
  }
}
