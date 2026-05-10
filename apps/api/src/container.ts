import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { Redis } from 'ioredis';
import { config } from './config.js';
import * as schema from './infrastructure/db/schema.js';

// Repositories
import { DrizzleAgentRepository } from './infrastructure/db/repositories/DrizzleAgentRepository.js';
import { DrizzleLeadRepository } from './infrastructure/db/repositories/DrizzleLeadRepository.js';
import { DrizzleDealRepository } from './infrastructure/db/repositories/DrizzleDealRepository.js';
import { DrizzleProjectRepository } from './infrastructure/db/repositories/DrizzleProjectRepository.js';
import { DrizzleHITLRepository } from './infrastructure/db/repositories/DrizzleHITLRepository.js';
import { DrizzleAuditLogRepository } from './infrastructure/db/repositories/DrizzleAuditLogRepository.js';
import { DrizzleContractAcceptanceRepository } from './infrastructure/db/repositories/DrizzleContractAcceptanceRepository.js';
import { DrizzleOptOutRepository } from './infrastructure/db/repositories/DrizzleOptOutRepository.js';

// Infrastructure Adapters
import { EnvSecretsAdapter } from './infrastructure/secrets/SecretsProvider.js';
import { CompositeLLMRouter } from './infrastructure/llm/CompositeLLMRouter.js';
import { BullMQAdapter } from './infrastructure/queue/BullMQAdapter.js';
import { WhatsAppAdapter } from './infrastructure/messaging/WhatsAppAdapter.js';
import { EmailAdapter } from './infrastructure/messaging/EmailAdapter.js';
import { ChromaDBAdapter } from './infrastructure/rag/ChromaDBAdapter.js';
import { HITLExpirationWorker } from './infrastructure/queue/HITLExpirationWorker.js';
import { EmailWorker } from './infrastructure/queue/EmailWorker.js';
import { AgentExecutionService } from './application/agent/AgentExecutionService.js';

// ── Database ──────────────────────────────────────────────────────────────────

const queryClient = postgres(config.DATABASE_URL, {
  max: 10,
  idle_timeout: 20,
  connect_timeout: 10,
});

export const db: PostgresJsDatabase<typeof schema> = drizzle(queryClient, { schema });

// ── Redis ─────────────────────────────────────────────────────────────────────

export const redis = new Redis(config.REDIS_URL, {
  maxRetriesPerRequest: 3,
  lazyConnect: true,
});

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
  auditRepo: DrizzleAuditLogRepository;
  contractAcceptanceRepo: DrizzleContractAcceptanceRepository;
  optOutRepo: DrizzleOptOutRepository;

  // Infrastructure Services
  secrets: EnvSecretsAdapter;
  llm: CompositeLLMRouter;
  queue: BullMQAdapter;
  whatsapp: WhatsAppAdapter;
  email: EmailAdapter;
  rag: ChromaDBAdapter;

  // Workers
  hitlWorker: HITLExpirationWorker;
  emailWorker: EmailWorker;
  agentExecutionService: AgentExecutionService;
}

export function createContainer(): Container {
  const secrets = new EnvSecretsAdapter();
  const llm = new CompositeLLMRouter(secrets);
  const queue = new BullMQAdapter({ connection: redis.options });
  const whatsapp = new WhatsAppAdapter();
  const email = new EmailAdapter();
  const rag = new ChromaDBAdapter();

  const hitlWorker = new HITLExpirationWorker(queue, db);
  const emailWorker = new EmailWorker(queue, email);

  const agentRepo = new DrizzleAgentRepository(db);
  const agentExecutionService = new AgentExecutionService(agentRepo, queue);

  return {
    db,
    redis,
    agentRepo,
    leadRepo: new DrizzleLeadRepository(db),
    dealRepo: new DrizzleDealRepository(db),
    projectRepo: new DrizzleProjectRepository(db),
    hitlRepo: new DrizzleHITLRepository(db),
    auditRepo: new DrizzleAuditLogRepository(db),
    contractAcceptanceRepo: new DrizzleContractAcceptanceRepository(db),
    optOutRepo: new DrizzleOptOutRepository(db),
    secrets,
    llm,
    queue,
    whatsapp,
    email,
    rag,
    hitlWorker,
    emailWorker,
    agentExecutionService,
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
