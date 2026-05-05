import type { FastifyInstance } from 'fastify';
import { authMiddleware } from '../middleware/auth.middleware.js';
import { CreateLeadSchema, UpdateLeadStatusSchema, ListLeadsQuery } from '../schemas/leads.schemas.js';
import { CreateLeadHandler, UpdateLeadStatusHandler, GetLeadsHandler, GetLeadByIdHandler } from '../../application/lead/lead.handlers.js';
import type { LeadStatus } from '@agentepro/shared-types';

export async function leadRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', authMiddleware);

  // Handlers dynamically instantiated inside routes for tests

  app.get('/', async (request, reply) => {
    const parsed = ListLeadsQuery.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send({
        errors: parsed.error.issues.map((i) => ({ code: 'VALIDATION_ERROR', message: i.message, field: i.path.join('.'), requestId: request.requestId })),
      });
    }
    const getListHandler = new GetLeadsHandler(app.container.leadRepo);
    const result = await getListHandler.execute({
      operatorId: request.operatorId,
      ...parsed.data,
      status: parsed.data.status as LeadStatus | undefined,
    });
    return reply.status(200).send({
      data: result.leads.map((l) => l.toJSON()),
      meta: { requestId: request.requestId, timestamp: new Date().toISOString(), cursor: { next: result.nextCursor, prev: null }, total: result.total, limit: parsed.data.limit },
    });
  });

  app.get<{ Params: { id: string } }>('/:id', async (request, reply) => {
    const getByIdHandler = new GetLeadByIdHandler(app.container.leadRepo);
    const result = await getByIdHandler.execute(request.params.id, request.operatorId);
    if (result.isErr()) {
      return reply.status(404).send({ errors: [{ code: 'NOT_FOUND', message: result.error.message, requestId: request.requestId }] });
    }
    return reply.status(200).send({
      data: result.value.toJSON(),
      meta: { requestId: request.requestId, timestamp: new Date().toISOString() },
    });
  });

  app.post('/', async (request, reply) => {
    const parsed = CreateLeadSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        errors: parsed.error.issues.map((i) => ({ code: 'VALIDATION_ERROR', message: i.message, field: i.path.join('.'), requestId: request.requestId })),
      });
    }
    const createHandler = new CreateLeadHandler(app.container.leadRepo);
    const result = await createHandler.execute(request.operatorId, parsed.data as Parameters<typeof createHandler.execute>[1]);
    if (result.isErr()) {
      return reply.status(400).send({ errors: [{ code: 'VALIDATION_ERROR', message: result.error.message, requestId: request.requestId }] });
    }
    return reply.status(201).send({
      data: result.value.toJSON(),
      meta: { requestId: request.requestId, timestamp: new Date().toISOString() },
    });
  });

  app.patch<{ Params: { id: string } }>('/:id/status', async (request, reply) => {
    const parsed = UpdateLeadStatusSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        errors: parsed.error.issues.map((i) => ({ code: 'VALIDATION_ERROR', message: i.message, field: i.path.join('.'), requestId: request.requestId })),
      });
    }
    const updateStatusHandler = new UpdateLeadStatusHandler(app.container.leadRepo);
    const result = await updateStatusHandler.execute(
      request.params.id, request.operatorId,
      parsed.data.status as LeadStatus,
      parsed.data.reason,
    );
    if (result.isErr()) {
      const status = result.error.message.includes('not found') ? 404 : 400;
      return reply.status(status).send({ errors: [{ code: status === 404 ? 'NOT_FOUND' : 'VALIDATION_ERROR', message: result.error.message, requestId: request.requestId }] });
    }
    return reply.status(200).send({
      data: result.value.toJSON(),
      meta: { requestId: request.requestId, timestamp: new Date().toISOString() },
    });
  });
}
