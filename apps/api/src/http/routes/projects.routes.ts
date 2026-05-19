import type { FastifyInstance } from "fastify";
import { authMiddleware } from "../middleware/auth.middleware.js";
import {
  GetProjectsHandler,
  GetProjectByIdHandler,
  RequestRevisionHandler,
} from "../../application/project/project.handlers.js";
import { z } from "zod";

const RevisionSchema = z.object({ notes: z.string().min(1).max(2000) });

export async function projectRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", authMiddleware);
  // Handlers dynamically instantiated inside routes for tests

  app.get("/", async (request, reply) => {
    const getList = new GetProjectsHandler(app.container.projectRepo);
    const result = await getList.execute({ operatorId: request.operatorId });
    return reply
      .status(200)
      .send({
        data: result.projects.map((p) => p.toJSON()),
        meta: {
          requestId: request.requestId,
          timestamp: new Date().toISOString(),
          total: result.total,
        },
      });
  });

  app.get<{ Params: { id: string } }>("/:id", async (request, reply) => {
    const getById = new GetProjectByIdHandler(app.container.projectRepo);
    const result = await getById.execute(request.params.id, request.operatorId);
    if (result.isErr())
      return reply
        .status(404)
        .send({
          errors: [
            {
              code: "NOT_FOUND",
              message: result.error.message,
              requestId: request.requestId,
            },
          ],
        });
    return reply
      .status(200)
      .send({
        data: result.value.toJSON(),
        meta: {
          requestId: request.requestId,
          timestamp: new Date().toISOString(),
        },
      });
  });

  app.post<{ Params: { id: string } }>(
    "/:id/request-revision",
    async (request, reply) => {
      const parsed = RevisionSchema.safeParse(request.body);
      if (!parsed.success)
        return reply
          .status(400)
          .send({
            errors: parsed.error.issues.map((i) => ({
              code: "VALIDATION_ERROR",
              message: i.message,
              requestId: request.requestId,
            })),
          });
      const requestRevision = new RequestRevisionHandler(
        app.container.projectRepo,
      );
      const result = await requestRevision.execute(
        request.params.id,
        request.operatorId,
        parsed.data.notes,
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
      return reply
        .status(200)
        .send({
          data: result.value.toJSON(),
          meta: {
            requestId: request.requestId,
            timestamp: new Date().toISOString(),
          },
        });
    },
  );
}
