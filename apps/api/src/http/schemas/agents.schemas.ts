import { z } from "zod";
import { AgentPersona, LLMProvider } from "@hefesto/shared-types";

const llmProviderValues = Object.values(LLMProvider) as [string, ...string[]];
const agentPersonaValues = Object.values(AgentPersona) as [string, ...string[]];

export const CreateAgentSchema = z.object({
  name: z.string().min(2).max(100),
  persona: z.enum(agentPersonaValues),
  llmProvider: z.enum(llmProviderValues),
  llmModel: z.string().min(1).max(100),
  llmBaseUrl: z.string().url().optional(),
  llmApiKeyRef: z.string().max(200).optional(),
  llmTemperature: z.number().min(0).max(2).default(0.7),
  llmMaxTokens: z.number().int().min(1).max(128_000).default(4096),
  llmSystemPrompt: z.string().max(32_000).optional(),
});
export type CreateAgentInput = z.infer<typeof CreateAgentSchema>;

export const UpdateAgentSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  llmProvider: z.enum(llmProviderValues).optional(),
  llmModel: z.string().min(1).max(100).optional(),
  llmBaseUrl: z.string().url().nullable().optional(),
  llmApiKeyRef: z.string().max(200).nullable().optional(),
  llmTemperature: z.number().min(0).max(2).optional(),
  llmMaxTokens: z.number().int().min(1).max(128_000).optional(),
  llmSystemPrompt: z.string().max(32_000).nullable().optional(),
  ragEnabled: z.boolean().optional(),
  ragCollection: z.string().max(100).nullable().optional(),
  ragTopK: z.number().int().min(1).max(20).optional(),
  ragThreshold: z.number().min(0).max(1).optional(),
  hitlTimeoutMinutes: z.number().int().min(1).max(1440).optional(),
  hitlNotifyChannel: z.enum(["email", "whatsapp", "both"]).optional(),
});
export type UpdateAgentInput = z.infer<typeof UpdateAgentSchema>;

export const CreateSkillSchema = z.object({
  name: z.string().min(1).max(100),
  skillType: z.string().min(1).max(50),
  config: z.record(z.unknown()).default({}),
  isEnabled: z.boolean().default(true),
});
export type CreateSkillInput = z.infer<typeof CreateSkillSchema>;

export const CreateRuleSchema = z.object({
  name: z.string().min(1).max(100),
  condition: z.string().min(1).max(1000),
  action: z.enum(["BLOCK", "WARN", "LOG", "ESCALATE_HITL"]),
  priority: z.number().int().min(1).max(1000).default(100),
  isEnabled: z.boolean().default(true),
});
export type CreateRuleInput = z.infer<typeof CreateRuleSchema>;

export const ListAgentsQuery = z.object({
  status: z.enum(["ACTIVE", "INACTIVE", "PAUSED"]).optional(),
  persona: z.enum(agentPersonaValues).optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
export type ListAgentsQueryInput = z.infer<typeof ListAgentsQuery>;

export const UpdateSkillSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  skillType: z.string().min(1).max(50).optional(),
  config: z.record(z.unknown()).optional(),
  isEnabled: z.boolean().optional(),
});
export type UpdateSkillInput = z.infer<typeof UpdateSkillSchema>;

export const UpdateRuleSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  condition: z.string().min(1).max(1000).optional(),
  action: z.enum(["BLOCK", "WARN", "LOG", "ESCALATE_HITL"]).optional(),
  priority: z.number().int().min(1).max(1000).optional(),
  isEnabled: z.boolean().optional(),
});
export type UpdateRuleInput = z.infer<typeof UpdateRuleSchema>;
