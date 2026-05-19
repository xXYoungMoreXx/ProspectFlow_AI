import { z } from "zod";

const settingCategorySchema = z.enum([
  "llm_providers",
  "messaging",
  "integrations",
  "system",
]);

export const upsertSettingSchema = z.object({
  key: z.string().min(1).max(100),
  value: z.string().min(0).max(10_000),
  category: settingCategorySchema,
  isSecret: z.boolean().optional(),
  isActive: z.boolean().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const updateSettingsBodySchema = z.object({
  settings: z.array(upsertSettingSchema).min(1).max(50),
});

export const testConnectionBodySchema = z.object({
  service: z.enum([
    "openai",
    "anthropic",
    "ollama",
    "telegram",
    "whatsapp",
    "email",
    "chromadb",
  ]),
});

export const ollamaPullBodySchema = z.object({
  model: z.string().min(1).max(200),
});

export const ollamaDeleteParamsSchema = z.object({
  name: z.string().min(1).max(200),
});

export const categoryParamsSchema = z.object({
  category: settingCategorySchema,
});

export const keyParamsSchema = z.object({
  key: z.string().min(1).max(100),
});
