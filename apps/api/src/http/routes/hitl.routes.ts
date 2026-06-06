import type { FastifyInstance } from "fastify";
import { authMiddleware } from "../middleware/auth.middleware.js";
import {
  ApproveSchema,
  RejectSchema,
  EditApproveSchema,
} from "../schemas/hitl.schemas.js";
import {
  GetPendingApprovalsHandler,
  ApproveHITLHandler,
  RejectHITLHandler,
  EditAndApproveHITLHandler,
} from "../../application/hitl/hitl.handlers.js";

export async function hitlRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", authMiddleware);
  // Handlers dynamically instantiated inside routes for tests

  app.get("/pending", async (request, reply) => {
    const getPending = new GetPendingApprovalsHandler(app.container.hitlRepo);
    const approvals = await getPending.execute(
      request.operatorId,
      request.organizationId,
    );
    return reply.status(200).send({
      data: approvals.map((a) => a.toJSON()),
      meta: {
        requestId: request.requestId,
        timestamp: new Date().toISOString(),
      },
    });
  });

  app.post<{ Params: { id: string } }>(
    "/:id/approve",
    { config: { rateLimit: { max: 3, timeWindow: "5 seconds" } } },
    async (request, reply) => {
      const parsed = ApproveSchema.safeParse(request.body);
      if (!parsed.success)
        return reply.status(400).send({
          errors: parsed.error.issues.map((i) => ({
            code: "VALIDATION_ERROR",
            message: i.message,
            requestId: request.requestId,
          })),
        });
      const approve = new ApproveHITLHandler(
        app.container.hitlRepo,
        app.container.projectRepo,
        app.container.deploymentRouter,
        app.container.queue,
      );
      const result = await approve.execute(
        request.params.id,
        request.operatorId,
        parsed.data.note,
        request.organizationId,
      );
      if (result.isErr())
        return reply
          .status(result.error.message.includes("not found") ? 404 : 400)
          .send({
            errors: [
              {
                code: "ERROR",
                message: result.error.message,
                requestId: request.requestId,
              },
            ],
          });
      return reply.status(200).send({
        data: result.value.toJSON(),
        meta: {
          requestId: request.requestId,
          timestamp: new Date().toISOString(),
        },
      });
    },
  );

  app.post<{ Params: { id: string } }>(
    "/:id/reject",
    async (request, reply) => {
      const parsed = RejectSchema.safeParse(request.body);
      if (!parsed.success)
        return reply.status(400).send({
          errors: parsed.error.issues.map((i) => ({
            code: "VALIDATION_ERROR",
            message: i.message,
            requestId: request.requestId,
          })),
        });
      const reject = new RejectHITLHandler(app.container.hitlRepo);
      const result = await reject.execute(
        request.params.id,
        request.operatorId,
        parsed.data.note,
        request.organizationId,
      );
      if (result.isErr())
        return reply
          .status(result.error.message.includes("not found") ? 404 : 400)
          .send({
            errors: [
              {
                code: "ERROR",
                message: result.error.message,
                requestId: request.requestId,
              },
            ],
          });
      return reply.status(200).send({
        data: result.value.toJSON(),
        meta: {
          requestId: request.requestId,
          timestamp: new Date().toISOString(),
        },
      });
    },
  );

  app.patch<{ Params: { id: string } }>(
    "/:id/edit-and-approve",
    async (request, reply) => {
      const parsed = EditApproveSchema.safeParse(request.body);
      if (!parsed.success)
        return reply.status(400).send({
          errors: parsed.error.issues.map((i) => ({
            code: "VALIDATION_ERROR",
            message: i.message,
            requestId: request.requestId,
          })),
        });
      const editApprove = new EditAndApproveHITLHandler(app.container.hitlRepo);
      const result = await editApprove.execute(
        request.params.id,
        request.operatorId,
        parsed.data.editedPayload,
        parsed.data.note,
        request.organizationId,
      );
      if (result.isErr())
        return reply
          .status(result.error.message.includes("not found") ? 404 : 400)
          .send({
            errors: [
              {
                code: "ERROR",
                message: result.error.message,
                requestId: request.requestId,
              },
            ],
          });
      return reply.status(200).send({
        data: result.value.toJSON(),
        meta: {
          requestId: request.requestId,
          timestamp: new Date().toISOString(),
        },
      });
    },
  );
}
