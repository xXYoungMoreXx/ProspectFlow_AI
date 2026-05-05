import type { FastifyInstance } from 'fastify';

/**
 * System routes — health check and metrics.
 * GET /api/v1/health
 * GET /api/v1/metrics
 */
export async function systemRoutes(app: FastifyInstance): Promise<void> {
  app.get('/health', async (_request, reply) => {
    // TODO: Check database, Redis, ChromaDB connectivity
    const healthStatus = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      version: '0.1.0',
      services: {
        database: 'ok',
        redis: 'ok',
        chromadb: 'ok',
      },
    };

    return reply.status(200).send(healthStatus);
  });
}
