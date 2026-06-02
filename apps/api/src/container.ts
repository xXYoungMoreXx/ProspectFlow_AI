import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { Redis } from "ioredis";
import { randomBytes } from "node:crypto";
import { config } from "./config.js";
import * as schema from "./infrastructure/db/schema.js";

// Repositories
import { DrizzleAgentRepository } from "./infrastructure/db/repositories/DrizzleAgentRepository.js";
import { DrizzleLeadRepository } from "./infrastructure/db/repositories/DrizzleLeadRepository.js";
import { DrizzleDealRepository } from "./infrastructure/db/repositories/DrizzleDealRepository.js";
import { DrizzleProjectRepository } from "./infrastructure/db/repositories/DrizzleProjectRepository.js";
import { DrizzleHITLRepository } from "./infrastructure/db/repositories/DrizzleHITLRepository.js";
import { DrizzleAuditLogRepository } from "./infrastructure/db/repositories/DrizzleAuditLogRepository.js";
import { DrizzleContractAcceptanceRepository } from "./infrastructure/db/repositories/DrizzleContractAcceptanceRepository.js";
import { DrizzleOptOutRepository } from "./infrastructure/db/repositories/DrizzleOptOutRepository.js";
import { DrizzleSettingsRepository } from "./infrastructure/db/repositories/DrizzleSettingsRepository.js";
import { DrizzleBriefingRepository } from "./infrastructure/db/repositories/DrizzleBriefingRepository.js";

// Infrastructure Adapters
import { SettingsCrypto } from "./infrastructure/secrets/SettingsCrypto.js";
import { CompositeSecretsProvider } from "./infrastructure/secrets/CompositeSecretsProvider.js";
import { CompositeLLMRouter } from "./infrastructure/llm/CompositeLLMRouter.js";
import { BullMQAdapter } from "./infrastructure/queue/BullMQAdapter.js";
import { WhatsAppAdapter } from "./infrastructure/messaging/WhatsAppAdapter.js";
import { EmailAdapter } from "./infrastructure/messaging/EmailAdapter.js";
import { TelegramAdapter } from "./infrastructure/messaging/TelegramAdapter.js";
import { ChromaDBAdapter } from "./infrastructure/rag/ChromaDBAdapter.js";
import { HITLExpirationWorker } from "./infrastructure/queue/HITLExpirationWorker.js";
import { EmailWorker } from "./infrastructure/queue/EmailWorker.js";
import { FollowUpWorker } from "./infrastructure/queue/FollowUpWorker.js";
import { AgentExecutionService } from "./application/agent/AgentExecutionService.js";
import { DomainEventRouter } from "./infrastructure/queue/DomainEventRouter.js";
import { MediaGenerationRouter } from "./infrastructure/media/MediaGenerationRouter.js";
import { AuthEmailService } from "./application/auth/auth-email.service.js";

// Application Services
import { SettingsService } from "./application/settings/SettingsService.js";
import { OllamaProxyService } from "./application/settings/OllamaProxyService.js";

// ── Database ──────────────────────────────────────────────────────────────────

const queryClient = postgres(config.DATABASE_URL, {
  max: 10,
  idle_timeout: 20,
  connect_timeout: 10,
});

export const db: PostgresJsDatabase<typeof schema> = drizzle(queryClient, {
  schema,
});

// ── Redis ─────────────────────────────────────────────────────────────────────

export const redis = new Redis(config.REDIS_URL, {
  maxRetriesPerRequest: null,
  lazyConnect: true,
});

// ── Encryption Key Resolution ─────────────────────────────────────────────────

function resolveEncryptionKey(): string {
  if (config.SETTINGS_ENCRYPTION_KEY) {
    return config.SETTINGS_ENCRYPTION_KEY;
  }
  // Generate a deterministic dev key from DATABASE_URL (not secure, but stable per setup)
  if (config.NODE_ENV === "development" || config.NODE_ENV === "test") {
    const devKey = randomBytes(32).toString("base64");
    console.warn(
      "⚠️  SETTINGS_ENCRYPTION_KEY not set — generated ephemeral key for dev mode.",
    );
    console.warn(
      "⚠️  DB-stored secrets will NOT survive restarts. Set SETTINGS_ENCRYPTION_KEY in .env.",
    );
    console.warn(
      `   Generate one with: node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`,
    );
    return devKey;
  }
  throw new Error(
    "SETTINGS_ENCRYPTION_KEY is required in production. " +
      `Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`,
  );
}

// ── Dependency Injection Container ────────────────────────────────────────────

export interface Container {
  db: PostgresJsDatabase<typeof schema>;
  redis: Redis;

  // Repositories
  agentRepo: DrizzleAgentRepository;
  leadRepo: DrizzleLeadRepository;
  dealRepo: DrizzleDealRepository;
  projectRepo: DrizzleProjectRepository;
  hitlRepo: DrizzleHITLRepository;
  briefingRepo: DrizzleBriefingRepository;
  auditRepo: DrizzleAuditLogRepository;
  contractAcceptanceRepo: DrizzleContractAcceptanceRepository;
  optOutRepo: DrizzleOptOutRepository;
  settingsRepo: DrizzleSettingsRepository;

  // Infrastructure Services
  secrets: CompositeSecretsProvider;
  settingsCrypto: SettingsCrypto;
  llm: CompositeLLMRouter;
  queue: BullMQAdapter;
  whatsapp: WhatsAppAdapter;
  email: EmailAdapter;
  telegram: TelegramAdapter;
  rag: ChromaDBAdapter;

  // Workers
  hitlWorker: HITLExpirationWorker;
  emailWorker: EmailWorker;
  followUpWorker: FollowUpWorker;
  agentExecutionService: AgentExecutionService;
  domainEventRouter: DomainEventRouter;
  mediaRouter: MediaGenerationRouter;

  // Application Services
  authEmailService: AuthEmailService;
  settingsService: SettingsService;
  ollamaProxy: OllamaProxyService;
}

export function createContainer(): Container {
  // Settings infrastructure (crypto → repo → composite secrets)
  const encryptionKey = resolveEncryptionKey();
  const settingsCrypto = new SettingsCrypto(encryptionKey);
  const settingsRepo = new DrizzleSettingsRepository(db, settingsCrypto);
  const secrets = new CompositeSecretsProvider(settingsRepo);

  // Application services
  const settingsService = new SettingsService(settingsRepo, secrets);
  const ollamaProxy = new OllamaProxyService(secrets);

  const llm = new CompositeLLMRouter(secrets);
  const queue = new BullMQAdapter({ connection: redis.options });
  const whatsapp = new WhatsAppAdapter();
  const email = new EmailAdapter();
  const telegram = new TelegramAdapter();
  const rag = new ChromaDBAdapter();

  const hitlWorker = new HITLExpirationWorker(queue, db, telegram);
  const emailWorker = new EmailWorker(queue, email);
  const followUpWorker = new FollowUpWorker(queue, db);

  const agentRepo = new DrizzleAgentRepository(db);
  const leadRepo = new DrizzleLeadRepository(db);
  const hitlRepo = new DrizzleHITLRepository(db);
  const agentExecutionService = new AgentExecutionService(
    agentRepo,
    queue,
    leadRepo,
    hitlRepo,
  );

  const dealRepo = new DrizzleDealRepository(db);
  const briefingRepo = new DrizzleBriefingRepository(db);
  const domainEventRouter = new DomainEventRouter(
    dealRepo,
    briefingRepo,
    queue,
    leadRepo,
    redis,
  );

  const mediaRouter = new MediaGenerationRouter({
    getNanaBananaKey: () =>
      secrets.getSecretGlobal("NANABANANA_API_KEY").then((v) => v ?? null),
    getDalleKey: () =>
      secrets.getSecretGlobal("OPENAI_API_KEY").then((v) => v ?? null),
  });

  return {
    db,
    redis,
    agentRepo,
    leadRepo,
    dealRepo,
    projectRepo: new DrizzleProjectRepository(db),
    hitlRepo,
    briefingRepo,
    auditRepo: new DrizzleAuditLogRepository(db),
    contractAcceptanceRepo: new DrizzleContractAcceptanceRepository(db),
    optOutRepo: new DrizzleOptOutRepository(db),
    settingsRepo,
    secrets,
    settingsCrypto,
    llm,
    queue,
    whatsapp,
    email,
    telegram,
    rag,
    hitlWorker,
    emailWorker,
    followUpWorker,
    agentExecutionService,
    domainEventRouter,
    mediaRouter,
    authEmailService: new AuthEmailService(queue),
    settingsService,
    ollamaProxy,
  };
}

// ── Graceful Shutdown ─────────────────────────────────────────────────────────

export async function destroyContainer(container?: Container): Promise<void> {
  if (container?.queue) {
    await container.queue.close();
  }
  await redis.quit();
  await queryClient.end();
}
