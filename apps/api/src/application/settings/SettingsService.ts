import type {
  DrizzleSettingsRepository,
  SettingCategory,
  SettingEntry,
  UpsertSettingInput,
} from "../../infrastructure/db/repositories/DrizzleSettingsRepository.js";
import type { CompositeSecretsProvider } from "../../infrastructure/secrets/CompositeSecretsProvider.js";

/** Known setting keys organized by category for validation */
const VALID_KEYS: Record<SettingCategory, string[]> = {
  llm_providers: [
    "OPENAI_API_KEY",
    "ANTHROPIC_API_KEY",
    "GOOGLE_API_KEY",
    "GROQ_API_KEY",
    "OLLAMA_BASE_URL",
    "DEFAULT_LLM_PROVIDER",
    "DEFAULT_LLM_MODEL",
  ],
  messaging: [
    "EVOLUTION_API_URL",
    "EVOLUTION_API_KEY",
    "WPP_INSTANCE",
    "BREVO_API_KEY",
    "EMAIL_FROM_NAME",
    "EMAIL_FROM_ADDRESS",
    "TELEGRAM_BOT_TOKEN",
    "TELEGRAM_CHAT_ID",
  ],
  integrations: [
    "TRANSPARENCIA_API_KEY",
    "DATAJUD_API_KEY",
    "META_ACCESS_TOKEN",
    "CHROMADB_URL",
    "WEBHOOK_URL",
    "WEBHOOK_SECRET",
  ],
  system: [
    "HITL_DEFAULT_TIMEOUT_MINUTES",
    "MAX_BODY_SIZE",
    "OLLAMA_GPU_ENABLED",
  ],
};

/** Keys that should be treated as secrets */
const SECRET_KEYS = new Set([
  "OPENAI_API_KEY",
  "ANTHROPIC_API_KEY",
  "GOOGLE_API_KEY",
  "GROQ_API_KEY",
  "EVOLUTION_API_KEY",
  "BREVO_API_KEY",
  "TELEGRAM_BOT_TOKEN",
  "TRANSPARENCIA_API_KEY",
  "DATAJUD_API_KEY",
  "META_ACCESS_TOKEN",
  "WEBHOOK_SECRET",
]);

export interface TestConnectionResult {
  service: string;
  success: boolean;
  message: string;
  latencyMs?: number;
}

export class SettingsService {
  constructor(
    private readonly settingsRepo: DrizzleSettingsRepository,
    private readonly secretsProvider: CompositeSecretsProvider,
  ) {}

  async listAll(operatorId: string): Promise<SettingEntry[]> {
    return this.settingsRepo.listAll(operatorId);
  }

  async listByCategory(
    operatorId: string,
    category: SettingCategory,
  ): Promise<SettingEntry[]> {
    return this.settingsRepo.listByCategory(operatorId, category);
  }

  async updateSettings(
    operatorId: string,
    settings: UpsertSettingInput[],
  ): Promise<SettingEntry[]> {
    // Validate keys
    for (const s of settings) {
      const validKeys = VALID_KEYS[s.category];
      if (validKeys && !validKeys.includes(s.key)) {
        throw new Error(
          `Invalid setting key '${s.key}' for category '${s.category}'`,
        );
      }
      // Auto-detect secrets
      if (SECRET_KEYS.has(s.key)) {
        s.isSecret = true;
      }
    }

    const results = await this.settingsRepo.upsertBatch(operatorId, settings);

    // Invalidate secrets cache after update
    for (const s of settings) {
      this.secretsProvider.invalidate(s.key);
    }

    return results;
  }

  async deleteSetting(operatorId: string, key: string): Promise<boolean> {
    const deleted = await this.settingsRepo.deleteByKey(operatorId, key);
    if (deleted) {
      this.secretsProvider.invalidate(key);
    }
    return deleted;
  }

  async testConnection(
    _operatorId: string,
    service: string,
  ): Promise<TestConnectionResult> {
    const start = performance.now();

    try {
      switch (service) {
        case "openai": {
          const apiKey =
            await this.secretsProvider.getOptional("OPENAI_API_KEY");
          if (!apiKey)
            return {
              service,
              success: false,
              message: "API Key not configured",
            };
          const res = await fetch("https://api.openai.com/v1/models", {
            headers: { Authorization: `Bearer ${apiKey}` },
            signal: AbortSignal.timeout(5000),
          });
          const latencyMs = Math.round(performance.now() - start);
          return {
            service,
            success: res.ok,
            message: res.ok ? "Connected successfully" : `HTTP ${res.status}`,
            latencyMs,
          };
        }

        case "anthropic": {
          const apiKey =
            await this.secretsProvider.getOptional("ANTHROPIC_API_KEY");
          if (!apiKey)
            return {
              service,
              success: false,
              message: "API Key not configured",
            };
          const res = await fetch("https://api.anthropic.com/v1/messages", {
            method: "POST",
            headers: {
              "x-api-key": apiKey,
              "anthropic-version": "2023-06-01",
              "content-type": "application/json",
            },
            body: JSON.stringify({
              model: "claude-sonnet-4-20250514",
              max_tokens: 1,
              messages: [{ role: "user", content: "ping" }],
            }),
            signal: AbortSignal.timeout(10000),
          });
          const latencyMs = Math.round(performance.now() - start);
          // 200 or 400 (bad request) both indicate the key is valid
          return {
            service,
            success: res.status === 200 || res.status === 400,
            message: res.ok ? "Connected successfully" : `HTTP ${res.status}`,
            latencyMs,
          };
        }

        case "ollama": {
          const baseUrl =
            (await this.secretsProvider.getOptional("OLLAMA_BASE_URL")) ??
            "http://ollama:11434";
          const res = await fetch(`${baseUrl}/api/tags`, {
            signal: AbortSignal.timeout(3000),
          });
          const latencyMs = Math.round(performance.now() - start);
          return {
            service,
            success: res.ok,
            message: res.ok ? "Ollama is running" : `HTTP ${res.status}`,
            latencyMs,
          };
        }

        case "telegram": {
          const token =
            await this.secretsProvider.getOptional("TELEGRAM_BOT_TOKEN");
          if (!token)
            return {
              service,
              success: false,
              message: "Bot Token not configured",
            };
          const res = await fetch(
            `https://api.telegram.org/bot${token}/getMe`,
            {
              signal: AbortSignal.timeout(5000),
            },
          );
          const data = (await res.json()) as {
            ok: boolean;
            result?: { username: string };
          };
          const latencyMs = Math.round(performance.now() - start);
          return {
            service,
            success: data.ok,
            message: data.ok
              ? `Bot: @${data.result?.username}`
              : "Invalid token",
            latencyMs,
          };
        }

        case "whatsapp": {
          const url =
            await this.secretsProvider.getOptional("EVOLUTION_API_URL");
          const key =
            await this.secretsProvider.getOptional("EVOLUTION_API_KEY");
          if (!url || !key)
            return {
              service,
              success: false,
              message: "Evolution API not configured",
            };
          const res = await fetch(`${url}/instance/connectionState/hefesto`, {
            headers: { apikey: key },
            signal: AbortSignal.timeout(5000),
          });
          const latencyMs = Math.round(performance.now() - start);
          return {
            service,
            success: res.ok,
            message: res.ok ? "WhatsApp connected" : `HTTP ${res.status}`,
            latencyMs,
          };
        }

        case "email": {
          const apiKey =
            await this.secretsProvider.getOptional("BREVO_API_KEY");
          if (!apiKey)
            return {
              service,
              success: false,
              message: "Brevo API Key not configured",
            };
          const res = await fetch("https://api.brevo.com/v3/account", {
            headers: { "api-key": apiKey },
            signal: AbortSignal.timeout(5000),
          });
          const latencyMs = Math.round(performance.now() - start);
          return {
            service,
            success: res.ok,
            message: res.ok ? "Brevo connected" : `HTTP ${res.status}`,
            latencyMs,
          };
        }

        case "chromadb": {
          const url =
            (await this.secretsProvider.getOptional("CHROMADB_URL")) ??
            "http://localhost:8000";
          const res = await fetch(`${url}/api/v1/heartbeat`, {
            signal: AbortSignal.timeout(3000),
          });
          const latencyMs = Math.round(performance.now() - start);
          return {
            service,
            success: res.ok,
            message: res.ok ? "ChromaDB running" : `HTTP ${res.status}`,
            latencyMs,
          };
        }

        default:
          return {
            service,
            success: false,
            message: `Unknown service: ${service}`,
          };
      }
    } catch (error) {
      const latencyMs = Math.round(performance.now() - start);
      const message =
        error instanceof Error ? error.message : "Connection failed";
      return { service, success: false, message, latencyMs };
    }
  }

  /** Returns valid keys and which ones are secrets for the UI to render forms */
  getSettingsSchema(): Record<
    SettingCategory,
    Array<{ key: string; isSecret: boolean; label: string }>
  > {
    return {
      llm_providers: [
        { key: "OPENAI_API_KEY", isSecret: true, label: "OpenAI API Key" },
        {
          key: "ANTHROPIC_API_KEY",
          isSecret: true,
          label: "Anthropic API Key",
        },
        { key: "GOOGLE_API_KEY", isSecret: true, label: "Google AI API Key" },
        { key: "GROQ_API_KEY", isSecret: true, label: "Groq API Key" },
        { key: "OLLAMA_BASE_URL", isSecret: false, label: "Ollama Base URL" },
        {
          key: "DEFAULT_LLM_PROVIDER",
          isSecret: false,
          label: "Default LLM Provider",
        },
        {
          key: "DEFAULT_LLM_MODEL",
          isSecret: false,
          label: "Default LLM Model",
        },
      ],
      messaging: [
        {
          key: "EVOLUTION_API_URL",
          isSecret: false,
          label: "Evolution API URL",
        },
        {
          key: "EVOLUTION_API_KEY",
          isSecret: true,
          label: "Evolution API Key",
        },
        { key: "WPP_INSTANCE", isSecret: false, label: "WhatsApp Instance" },
        { key: "BREVO_API_KEY", isSecret: true, label: "Brevo API Key" },
        { key: "EMAIL_FROM_NAME", isSecret: false, label: "Email From Name" },
        {
          key: "EMAIL_FROM_ADDRESS",
          isSecret: false,
          label: "Email From Address",
        },
        {
          key: "TELEGRAM_BOT_TOKEN",
          isSecret: true,
          label: "Telegram Bot Token",
        },
        { key: "TELEGRAM_CHAT_ID", isSecret: false, label: "Telegram Chat ID" },
      ],
      integrations: [
        {
          key: "TRANSPARENCIA_API_KEY",
          isSecret: true,
          label: "Transparência API Key",
        },
        { key: "DATAJUD_API_KEY", isSecret: true, label: "DataJud API Key" },
        {
          key: "META_ACCESS_TOKEN",
          isSecret: true,
          label: "Meta Access Token",
        },
        { key: "CHROMADB_URL", isSecret: false, label: "ChromaDB URL" },
        { key: "WEBHOOK_URL", isSecret: false, label: "Webhook URL" },
        { key: "WEBHOOK_SECRET", isSecret: true, label: "Webhook Secret" },
      ],
      system: [
        {
          key: "HITL_DEFAULT_TIMEOUT_MINUTES",
          isSecret: false,
          label: "HITL Timeout (minutes)",
        },
        {
          key: "MAX_BODY_SIZE",
          isSecret: false,
          label: "Max Body Size (bytes)",
        },
        {
          key: "OLLAMA_GPU_ENABLED",
          isSecret: false,
          label: "Ollama GPU Enabled",
        },
      ],
    };
  }
}
