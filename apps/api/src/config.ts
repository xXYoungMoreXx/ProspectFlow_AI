import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  // Server
  PORT: z.coerce.number().default(3001),
  HOST: z.string().default("0.0.0.0"),
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  // Deployment mode. `local` = self-hosted single-machine install (default):
  // enables the offline first-run admin/local-login path (no SMTP needed).
  // `cloud` = managed deployment: disables local-login, full email verification.
  APP_MODE: z.enum(["local", "cloud"]).default("local"),
  CORS_ORIGINS: z.string().default("http://localhost:3000"),
  FRONTEND_URL: z.string().default("http://localhost:3000"),

  // Database
  DATABASE_URL: z.string().min(1),

  // Redis
  REDIS_URL: z.string().default("redis://localhost:6379"),

  // JWT
  JWT_PRIVATE_KEY: z.string().min(1),
  JWT_PUBLIC_KEY: z.string().min(1),
  JWT_ISSUER: z.string().default("agentepro.local"),
  JWT_AUDIENCE: z.string().default("agentepro-api"),
  JWT_ACCESS_EXPIRY: z.string().default("1h"),
  JWT_REFRESH_EXPIRY: z.string().default("7d"),

  // HITL
  HITL_DEFAULT_TIMEOUT_MINUTES: z.coerce.number().default(60),

  // ChromaDB
  CHROMADB_URL: z.string().default("http://localhost:8000"),

  // Agent Runtime
  AGENT_RUNTIME_URL: z.string().default("http://localhost:8001"),

  // Webhook
  WEBHOOK_URL: z.string().optional(),
  WEBHOOK_SECRET: z.string().optional(),

  // LLM Providers
  ANTHROPIC_API_KEY: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),

  // Messaging - WhatsApp (Evolution API)
  EVOLUTION_API_URL: z.string().optional(),
  EVOLUTION_API_KEY: z.string().optional(),
  WPP_INSTANCE: z.string().optional(),

  // Messaging - Email (Brevo)
  BREVO_API_KEY: z.string().optional(),
  EMAIL_FROM_ADDRESS: z.string().default("noreply@agentepro.com"),
  EMAIL_FROM_NAME: z.string().default("AgentePro"),

  // Messaging - Telegram
  TELEGRAM_BOT_TOKEN: z.string().optional(),
  TELEGRAM_CHAT_ID: z.string().optional(),
  TELEGRAM_WEBHOOK_SECRET: z.string().optional(),
  // Telegram Sales bot (separate from HITL bot — SPEC-11)
  TELEGRAM_SALES_BOT_TOKEN: z.string().optional(),
  TELEGRAM_SALES_WEBHOOK_SECRET: z.string().optional(),

  // Messaging - WhatsApp (Evolution API)
  WHATSAPP_WEBHOOK_SECRET: z.string().optional(),

  // Max body size in bytes (1MB default — Zero Trust)
  MAX_BODY_SIZE: z.coerce.number().default(1_048_576),

  // Observability
  OTEL_EXPORTER_OTLP_ENDPOINT: z.string().optional(),

  // Settings Encryption (AES-256-GCM for DB-stored secrets)
  // Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
  SETTINGS_ENCRYPTION_KEY: z.string().optional(),
});

export type AppConfig = z.infer<typeof envSchema>;

function loadConfig(): AppConfig {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    console.error("❌ Invalid environment configuration:");
    console.error(result.error.flatten().fieldErrors);
    process.exit(1);
  }
  return result.data;
}

export const config = loadConfig();
