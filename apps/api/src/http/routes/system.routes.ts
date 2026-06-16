import type { FastifyInstance } from "fastify";
import * as schema from "../../infrastructure/db/schema.js";
import { config } from "../../config.js";

/**
 * System routes — health check and onboarding/setup status.
 * GET /api/v1/health
 * GET /api/v1/system/setup-status
 */
export async function systemRoutes(app: FastifyInstance): Promise<void> {
  app.get("/health", async (_request, reply) => {
    // TODO: Check database, Redis, ChromaDB connectivity
    const healthStatus = {
      status: "ok",
      timestamp: new Date().toISOString(),
      version: "0.1.0",
      services: {
        database: "ok",
        redis: "ok",
        chromadb: "ok",
      },
    };

    return reply.status(200).send(healthStatus);
  });

  // First-run / onboarding status for the web client. Tells the frontend
  // whether the local backend already has an admin (skip the setup wizard)
  // and which deployment mode is active, so it can guide the user through
  // configuring and running the self-hosted app.
  app.get("/system/setup-status", async (request, reply) => {
    const rows = await app.container.db
      .select({ id: schema.operators.id })
      .from(schema.operators)
      .limit(1);
    const hasUsers = rows.length > 0;

    return reply.status(200).send({
      data: {
        mode: config.APP_MODE,
        hasUsers,
        needsSetup: !hasUsers,
        llmConfigured: Boolean(
          config.ANTHROPIC_API_KEY || config.OPENAI_API_KEY,
        ),
      },
      meta: {
        requestId: request.requestId,
        timestamp: new Date().toISOString(),
      },
    });
  });
}
