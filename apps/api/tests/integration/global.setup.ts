/**
 * Integration test setup using Testcontainers.
 *
 * Spins up real PostgreSQL + Redis containers, runs Drizzle migrations,
 * and exposes a shared `db` instance to all integration tests via globalThis.
 *
 * Usage in vitest config:
 *   setupFiles: ["tests/integration/global.setup.ts"]
 */
import {
  PostgreSqlContainer,
  type StartedPostgreSqlContainer,
} from "@testcontainers/postgresql";
import { GenericContainer, type StartedTestContainer } from "testcontainers";
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import * as schema from "../../src/infrastructure/db/schema.js";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export interface IntegrationTestContext {
  db: PostgresJsDatabase<typeof schema>;
  connectionString: string;
  pgContainer: StartedPostgreSqlContainer;
  redisContainer: StartedTestContainer;
}

let _context: IntegrationTestContext | null = null;
let _client: ReturnType<typeof postgres> | null = null;

import { beforeAll, afterAll } from "vitest";

/**
 * Starts PostgreSQL + Redis containers with correct configurations for BullMQ.
 * Redis is configured with maxmemory-policy=noeviction as required by BullMQ.
 */
beforeAll(async () => {
  // ── PostgreSQL ─────────────────────────────────────────────────────────────
  const pgContainer = await new PostgreSqlContainer("postgres:16-alpine")
    .withDatabase("agentepro_test")
    .withUsername("test")
    .withPassword("test")
    .start();

  const connectionString = pgContainer.getConnectionUri();
  const client = postgres(connectionString, { max: 5 });
  const db = drizzle(client, { schema });

  // Run migrations — path must match drizzle.config.ts `out` field
  const migrationsFolder = path.resolve(
    __dirname,
    "../../src/infrastructure/db/migrations",
  );
  await migrate(db, { migrationsFolder });

  // ── Redis ──────────────────────────────────────────────────────────────────
  // BullMQ requires maxmemory-policy=noeviction (not allkeys-lru)
  const redisContainer = await new GenericContainer("redis:7-alpine")
    .withCommand(["redis-server", "--maxmemory-policy", "noeviction"])
    .withExposedPorts(6379)
    .start();

  const redisHost = redisContainer.getHost();
  const redisPort = redisContainer.getMappedPort(6379);
  const redisUrl = `redis://${redisHost}:${redisPort}`;

  // Override env vars so buildApp() connects to test containers
  process.env["DATABASE_URL"] = connectionString;
  process.env["REDIS_URL"] = redisUrl;

  _client = client;
  _context = { db, connectionString, pgContainer, redisContainer };

  // Expose via global for use in test files
  (globalThis as any).__INTEGRATION_CTX__ = _context;
}, 120_000);

/**
 * Tears down containers and closes DB connection.
 */
afterAll(async () => {
  if (_client) await _client.end();
  if (_context?.pgContainer) await _context.pgContainer.stop();
  if (_context?.redisContainer) await _context.redisContainer.stop();
  _context = null;
  _client = null;
});

/** Retrieves the shared integration test context. */
export function getIntegrationContext(): IntegrationTestContext {
  const ctx = (globalThis as any).__INTEGRATION_CTX__ as
    | IntegrationTestContext
    | undefined;
  if (!ctx)
    throw new Error(
      "Integration context not initialized. Is setupFiles configured?",
    );
  return ctx;
}
