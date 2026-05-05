import type { FastifyInstance } from 'fastify';
import { LoginHandler, RefreshTokenHandler, LogoutHandler } from '../../application/auth/auth.handlers.js';
import { LoginSchema, RefreshSchema } from '../schemas/auth.schemas.js';
import { authMiddleware } from '../middleware/auth.middleware.js';

/**
 * Auth routes — PRD §12 AUTH endpoints
 * POST /api/v1/auth/login
 * POST /api/v1/auth/refresh
 * DELETE /api/v1/auth/logout
 */
export async function authRoutes(app: FastifyInstance): Promise<void> {
  // Handlers will be instantiated dynamically inside routes to allow DI overrides in tests

  // Rate limit: 5 attempts per 15 minutes for login (PRD §11.8)
  app.post('/login', {
    config: {
      rateLimit: {
        max: 5,
        timeWindow: '15 minutes',
      },
    },
  }, async (request, reply) => {
    const parsed = LoginSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        errors: parsed.error.issues.map((i) => ({
          code: 'VALIDATION_ERROR',
          message: i.message,
          field: i.path.join('.'),
          requestId: request.requestId,
        })),
      });
    }

    const loginHandler = new LoginHandler(app.container.db);
    const result = await loginHandler.execute(parsed.data.email, parsed.data.password);
    if (result.isErr()) {
      // Generic message — anti-enumeration (PRD §11.2)
      return reply.status(401).send({
        errors: [{ code: 'AUTHENTICATION_ERROR', message: 'Credenciais inválidas', requestId: request.requestId }],
      });
    }

    return reply.status(200).send({
      data: result.value,
      meta: { requestId: request.requestId, timestamp: new Date().toISOString() },
    });
  });

  app.post('/refresh', async (request, reply) => {
    const parsed = RefreshSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        errors: parsed.error.issues.map((i) => ({
          code: 'VALIDATION_ERROR',
          message: i.message,
          field: i.path.join('.'),
          requestId: request.requestId,
        })),
      });
    }

    const refreshHandler = new RefreshTokenHandler(app.container.db);
    const result = await refreshHandler.execute(parsed.data.refreshToken);
    if (result.isErr()) {
      return reply.status(401).send({
        errors: [{ code: 'AUTHENTICATION_ERROR', message: 'Credenciais inválidas', requestId: request.requestId }],
      });
    }

    return reply.status(200).send({
      data: result.value,
      meta: { requestId: request.requestId, timestamp: new Date().toISOString() },
    });
  });

  app.delete('/logout', { preHandler: authMiddleware }, async (request, reply) => {
    const logoutHandler = new LogoutHandler(app.container.db);
    await logoutHandler.execute(request.operatorId);
    return reply.status(204).send();
  });
}
