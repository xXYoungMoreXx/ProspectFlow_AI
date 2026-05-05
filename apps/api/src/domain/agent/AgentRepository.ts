import type { Agent, AgentSkill, AgentRule } from './Agent.js';
import type { AgentStatus, AgentPersona } from '@agentepro/shared-types';

export interface AgentFilters {
  operatorId: string;
  status?: AgentStatus;
  persona?: AgentPersona;
  cursor?: string;
  limit?: number;
}

export interface AgentListResult {
  agents: Agent[];
  total: number;
  nextCursor: string | null;
}

export interface CreateSkillData {
  agentId: string;
  name: string;
  skillType: string;
  config: Record<string, unknown>;
  isEnabled: boolean;
}

export interface UpdateSkillData {
  name?: string;
  skillType?: string;
  config?: Record<string, unknown>;
  isEnabled?: boolean;
}

export interface CreateRuleData {
  agentId: string;
  name: string;
  condition: string;
  action: string;
  priority: number;
  isEnabled: boolean;
}

export interface UpdateRuleData {
  name?: string;
  condition?: string;
  action?: string;
  priority?: number;
  isEnabled?: boolean;
}

/**
 * Port — Agent persistence contract.
 * Implemented by infrastructure layer (DrizzleAgentRepository).
 */
export interface AgentRepository {
  findById(id: string, operatorId: string): Promise<Agent | null>;
  findMany(filters: AgentFilters): Promise<AgentListResult>;
  save(agent: Agent): Promise<void>;
  delete(id: string, operatorId: string): Promise<boolean>;

  // ── Skill sub-resource methods ──────────────────────────────────────────
  addSkill(data: CreateSkillData): Promise<AgentSkill>;
  updateSkill(skillId: string, agentId: string, data: UpdateSkillData): Promise<AgentSkill | null>;
  removeSkill(skillId: string, agentId: string): Promise<boolean>;
  listSkills(agentId: string): Promise<AgentSkill[]>;

  // ── Rule sub-resource methods ───────────────────────────────────────────
  addRule(data: CreateRuleData): Promise<AgentRule>;
  updateRule(ruleId: string, agentId: string, data: UpdateRuleData): Promise<AgentRule | null>;
  removeRule(ruleId: string, agentId: string): Promise<boolean>;
  listRules(agentId: string): Promise<AgentRule[]>;
}
