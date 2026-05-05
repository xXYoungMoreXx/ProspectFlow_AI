import { eq, and, desc, gt, sql } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import * as schema from '../schema.js';
import { Agent, type AgentProps, type LLMConfiguration, type AgentSkill, type AgentRule } from '../../../domain/agent/Agent.js';
import type {
  AgentRepository,
  AgentFilters,
  AgentListResult,
  CreateSkillData,
  UpdateSkillData,
  CreateRuleData,
  UpdateRuleData,
} from '../../../domain/agent/AgentRepository.js';
import type { AgentPersona, AgentStatus, LLMProvider } from '@agentepro/shared-types';

export class DrizzleAgentRepository implements AgentRepository {
  constructor(private readonly db: PostgresJsDatabase<typeof schema>) {}

  async findById(id: string, operatorId: string): Promise<Agent | null> {
    const [row] = await this.db
      .select()
      .from(schema.agents)
      .where(and(eq(schema.agents.id, id), eq(schema.agents.operatorId, operatorId)))
      .limit(1);

    if (!row) return null;

    const skills = await this.db
      .select()
      .from(schema.agentSkills)
      .where(eq(schema.agentSkills.agentId, id));

    const rules = await this.db
      .select()
      .from(schema.agentRules)
      .where(eq(schema.agentRules.agentId, id));

    return this.toDomain(row, skills, rules);
  }

  async findMany(filters: AgentFilters): Promise<AgentListResult> {
    const conditions = [eq(schema.agents.operatorId, filters.operatorId)];
    if (filters.status) conditions.push(eq(schema.agents.status, filters.status));
    if (filters.persona) conditions.push(eq(schema.agents.persona, filters.persona));
    if (filters.cursor) conditions.push(gt(schema.agents.id, filters.cursor));

    const limit = filters.limit ?? 20;

    const [countResult] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.agents)
      .where(and(...conditions));

    const rows = await this.db
      .select()
      .from(schema.agents)
      .where(and(...conditions))
      .orderBy(desc(schema.agents.createdAt))
      .limit(limit + 1);

    const hasMore = rows.length > limit;
    const agents = rows.slice(0, limit);

    const domainAgents = await Promise.all(
      agents.map(async (row) => {
        const skills = await this.db.select().from(schema.agentSkills).where(eq(schema.agentSkills.agentId, row.id));
        const rules = await this.db.select().from(schema.agentRules).where(eq(schema.agentRules.agentId, row.id));
        return this.toDomain(row, skills, rules);
      }),
    );

    return {
      agents: domainAgents,
      total: countResult?.count ?? 0,
      nextCursor: hasMore ? agents[agents.length - 1]!.id : null,
    };
  }

  async save(agent: Agent): Promise<void> {
    const json = agent.toJSON();

    await this.db
      .insert(schema.agents)
      .values({
        id: json.id,
        operatorId: json.operatorId,
        name: json.name,
        persona: json.persona,
        status: json.status,
        llmProvider: json.llmConfig.provider,
        llmModel: json.llmConfig.model,
        llmBaseUrl: json.llmConfig.baseUrl ?? null,
        llmApiKeyRef: json.llmConfig.apiKeyRef ?? null,
        llmTemperature: String(json.llmConfig.temperature),
        llmMaxTokens: json.llmConfig.maxTokens,
        llmSystemPrompt: json.llmConfig.systemPrompt ?? null,
        tokenBudgetTotal: json.tokenBudgetTotal,
        tokenBudgetRemaining: json.tokenBudgetRemaining,
        ragEnabled: json.ragEnabled,
        ragCollection: json.ragCollection ?? null,
        ragTopK: json.ragTopK,
        ragThreshold: String(json.ragThreshold),
        hitlTimeoutMinutes: json.hitlTimeoutMinutes,
        hitlNotifyChannel: json.hitlNotifyChannel,
        createdAt: json.createdAt,
        updatedAt: json.updatedAt,
      })
      .onConflictDoUpdate({
        target: schema.agents.id,
        set: {
          name: json.name,
          status: json.status,
          llmProvider: json.llmConfig.provider,
          llmModel: json.llmConfig.model,
          llmBaseUrl: json.llmConfig.baseUrl ?? null,
          llmApiKeyRef: json.llmConfig.apiKeyRef ?? null,
          llmTemperature: String(json.llmConfig.temperature),
          llmMaxTokens: json.llmConfig.maxTokens,
          llmSystemPrompt: json.llmConfig.systemPrompt ?? null,
          tokenBudgetTotal: json.tokenBudgetTotal,
          tokenBudgetRemaining: json.tokenBudgetRemaining,
          ragEnabled: json.ragEnabled,
          ragCollection: json.ragCollection ?? null,
          ragTopK: json.ragTopK,
          ragThreshold: String(json.ragThreshold),
          hitlTimeoutMinutes: json.hitlTimeoutMinutes,
          hitlNotifyChannel: json.hitlNotifyChannel,
          updatedAt: json.updatedAt,
        },
      });
  }

  async delete(id: string, operatorId: string): Promise<boolean> {
    const result = await this.db
      .delete(schema.agents)
      .where(and(eq(schema.agents.id, id), eq(schema.agents.operatorId, operatorId)));
    return (result as unknown as { rowCount: number }).rowCount > 0;
  }

  // ── Skill CRUD ────────────────────────────────────────────────────────────

  async addSkill(data: CreateSkillData): Promise<AgentSkill> {
    const [row] = await this.db
      .insert(schema.agentSkills)
      .values({
        agentId: data.agentId,
        name: data.name,
        skillType: data.skillType,
        config: data.config,
        isEnabled: data.isEnabled,
      })
      .returning();

    return {
      id: row!.id,
      name: row!.name,
      skillType: row!.skillType,
      config: (row!.config ?? {}) as Record<string, unknown>,
      isEnabled: row!.isEnabled,
    };
  }

  async updateSkill(skillId: string, agentId: string, data: UpdateSkillData): Promise<AgentSkill | null> {
    const updates: Record<string, unknown> = {};
    if (data.name !== undefined) updates['name'] = data.name;
    if (data.skillType !== undefined) updates['skillType'] = data.skillType;
    if (data.config !== undefined) updates['config'] = data.config;
    if (data.isEnabled !== undefined) updates['isEnabled'] = data.isEnabled;

    if (Object.keys(updates).length === 0) {
      const [existing] = await this.db
        .select()
        .from(schema.agentSkills)
        .where(and(eq(schema.agentSkills.id, skillId), eq(schema.agentSkills.agentId, agentId)))
        .limit(1);
      if (!existing) return null;
      return {
        id: existing.id,
        name: existing.name,
        skillType: existing.skillType,
        config: (existing.config ?? {}) as Record<string, unknown>,
        isEnabled: existing.isEnabled,
      };
    }

    const rows = await this.db
      .update(schema.agentSkills)
      .set(updates)
      .where(and(eq(schema.agentSkills.id, skillId), eq(schema.agentSkills.agentId, agentId)))
      .returning();

    if (rows.length === 0) return null;
    const row = rows[0]!;
    return {
      id: row.id,
      name: row.name,
      skillType: row.skillType,
      config: (row.config ?? {}) as Record<string, unknown>,
      isEnabled: row.isEnabled,
    };
  }

  async removeSkill(skillId: string, agentId: string): Promise<boolean> {
    const result = await this.db
      .delete(schema.agentSkills)
      .where(and(eq(schema.agentSkills.id, skillId), eq(schema.agentSkills.agentId, agentId)));
    return (result as unknown as { rowCount: number }).rowCount > 0;
  }

  async listSkills(agentId: string): Promise<AgentSkill[]> {
    const rows = await this.db
      .select()
      .from(schema.agentSkills)
      .where(eq(schema.agentSkills.agentId, agentId));

    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      skillType: r.skillType,
      config: (r.config ?? {}) as Record<string, unknown>,
      isEnabled: r.isEnabled,
    }));
  }

  // ── Rule CRUD ─────────────────────────────────────────────────────────────

  async addRule(data: CreateRuleData): Promise<AgentRule> {
    const [row] = await this.db
      .insert(schema.agentRules)
      .values({
        agentId: data.agentId,
        name: data.name,
        condition: data.condition,
        action: data.action,
        priority: data.priority,
        isEnabled: data.isEnabled,
      })
      .returning();

    return {
      id: row!.id,
      name: row!.name,
      condition: row!.condition,
      action: row!.action,
      priority: row!.priority,
      isEnabled: row!.isEnabled,
    };
  }

  async updateRule(ruleId: string, agentId: string, data: UpdateRuleData): Promise<AgentRule | null> {
    const updates: Record<string, unknown> = {};
    if (data.name !== undefined) updates['name'] = data.name;
    if (data.condition !== undefined) updates['condition'] = data.condition;
    if (data.action !== undefined) updates['action'] = data.action;
    if (data.priority !== undefined) updates['priority'] = data.priority;
    if (data.isEnabled !== undefined) updates['isEnabled'] = data.isEnabled;

    if (Object.keys(updates).length === 0) {
      const [existing] = await this.db
        .select()
        .from(schema.agentRules)
        .where(and(eq(schema.agentRules.id, ruleId), eq(schema.agentRules.agentId, agentId)))
        .limit(1);
      if (!existing) return null;
      return {
        id: existing.id,
        name: existing.name,
        condition: existing.condition,
        action: existing.action,
        priority: existing.priority,
        isEnabled: existing.isEnabled,
      };
    }

    const rows = await this.db
      .update(schema.agentRules)
      .set(updates)
      .where(and(eq(schema.agentRules.id, ruleId), eq(schema.agentRules.agentId, agentId)))
      .returning();

    if (rows.length === 0) return null;
    const row = rows[0]!;
    return {
      id: row.id,
      name: row.name,
      condition: row.condition,
      action: row.action,
      priority: row.priority,
      isEnabled: row.isEnabled,
    };
  }

  async removeRule(ruleId: string, agentId: string): Promise<boolean> {
    const result = await this.db
      .delete(schema.agentRules)
      .where(and(eq(schema.agentRules.id, ruleId), eq(schema.agentRules.agentId, agentId)));
    return (result as unknown as { rowCount: number }).rowCount > 0;
  }

  async listRules(agentId: string): Promise<AgentRule[]> {
    const rows = await this.db
      .select()
      .from(schema.agentRules)
      .where(eq(schema.agentRules.agentId, agentId))
      .orderBy(desc(schema.agentRules.priority));

    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      condition: r.condition,
      action: r.action,
      priority: r.priority,
      isEnabled: r.isEnabled,
    }));
  }

  // ── Private helpers ─────────────────────────────────────────────────────

  private toDomain(
    row: typeof schema.agents.$inferSelect,
    skills: (typeof schema.agentSkills.$inferSelect)[],
    rules: (typeof schema.agentRules.$inferSelect)[],
  ): Agent {
    const llmConfig: LLMConfiguration = {
      provider: row.llmProvider as LLMProvider,
      model: row.llmModel,
      baseUrl: row.llmBaseUrl ?? undefined,
      apiKeyRef: row.llmApiKeyRef ?? undefined,
      temperature: Number(row.llmTemperature),
      maxTokens: row.llmMaxTokens,
      systemPrompt: row.llmSystemPrompt ?? undefined,
    };

    const domainSkills: AgentSkill[] = skills.map((s) => ({
      id: s.id,
      name: s.name,
      skillType: s.skillType,
      config: (s.config ?? {}) as Record<string, unknown>,
      isEnabled: s.isEnabled,
    }));

    const domainRules: AgentRule[] = rules.map((r) => ({
      id: r.id,
      name: r.name,
      condition: r.condition,
      action: r.action,
      priority: r.priority,
      isEnabled: r.isEnabled,
    }));

    const props: AgentProps = {
      id: row.id,
      operatorId: row.operatorId,
      name: row.name,
      persona: row.persona as AgentPersona,
      status: row.status as AgentStatus,
      llmConfig,
      tokenBudgetTotal: row.tokenBudgetTotal,
      tokenBudgetRemaining: row.tokenBudgetRemaining,
      ragEnabled: row.ragEnabled,
      ragCollection: row.ragCollection ?? undefined,
      ragTopK: row.ragTopK ?? 5,
      ragThreshold: Number(row.ragThreshold ?? '0.7'),
      hitlTimeoutMinutes: row.hitlTimeoutMinutes,
      hitlNotifyChannel: row.hitlNotifyChannel,
      skills: domainSkills,
      rules: domainRules,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };

    return Agent.reconstitute(props);
  }
}
