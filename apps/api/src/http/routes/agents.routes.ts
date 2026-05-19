import type { FastifyInstance } from "fastify";
import { authMiddleware } from "../middleware/auth.middleware.js";
import {
  CreateAgentSchema,
  UpdateAgentSchema,
  ListAgentsQuery,
  CreateSkillSchema,
  UpdateSkillSchema,
  CreateRuleSchema,
  UpdateRuleSchema,
} from "../schemas/agents.schemas.js";
import {
  CreateAgentHandler,
  UpdateAgentHandler,
  ActivateAgentHandler,
  PauseAgentHandler,
  GetAgentsHandler,
  GetAgentByIdHandler,
} from "../../application/agent/agent.handlers.js";
import {
  AddSkillHandler,
  UpdateSkillHandler,
  RemoveSkillHandler,
  ListSkillsHandler,
} from "../../application/agent/skills.handlers.js";
import {
  AddRuleHandler,
  UpdateRuleHandler,
  RemoveRuleHandler,
  ListRulesHandler,
} from "../../application/agent/rules.handlers.js";

export async function agentRoutes(app: FastifyInstance): Promise<void> {
  // All agent routes require authentication
  app.addHook("preHandler", authMiddleware);

  // Handlers instantiated dynamically for easy test overriding

  // GET /api/v1/agents
  app.get("/", async (request, reply) => {
    const parsed = ListAgentsQuery.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send({
        errors: parsed.error.issues.map((i) => ({
          code: "VALIDATION_ERROR",
          message: i.message,
          field: i.path.join("."),
          requestId: request.requestId,
        })),
      });
    }

    const getListHandler = new GetAgentsHandler(app.container.agentRepo);
    const result = await getListHandler.execute({
      operatorId: request.operatorId,
      status: parsed.data.status as
        | "ACTIVE"
        | "INACTIVE"
        | "PAUSED"
        | undefined,
      persona: parsed.data.persona as
        | "HUNTER"
        | "CLOSER"
        | "BUILDER"
        | "QA"
        | undefined,
      cursor: parsed.data.cursor,
      limit: parsed.data.limit,
    });

    return reply.status(200).send({
      data: result.agents.map((a) => a.toJSON()),
      meta: {
        requestId: request.requestId,
        timestamp: new Date().toISOString(),
        cursor: { next: result.nextCursor, prev: null },
        total: result.total,
        limit: parsed.data.limit,
      },
    });
  });

  // POST /api/v1/agents
  app.post("/", async (request, reply) => {
    const parsed = CreateAgentSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        errors: parsed.error.issues.map((i) => ({
          code: "VALIDATION_ERROR",
          message: i.message,
          field: i.path.join("."),
          requestId: request.requestId,
        })),
      });
    }

    const createHandler = new CreateAgentHandler(app.container.agentRepo);
    const result = await createHandler.execute(
      request.operatorId,
      parsed.data as Parameters<typeof createHandler.execute>[1],
    );
    if (result.isErr()) {
      return reply.status(400).send({
        errors: [
          {
            code: "VALIDATION_ERROR",
            message: result.error.message,
            requestId: request.requestId,
          },
        ],
      });
    }

    return reply.status(201).send({
      data: result.value.toJSON(),
      meta: {
        requestId: request.requestId,
        timestamp: new Date().toISOString(),
      },
    });
  });

  // GET /api/v1/agents/:id
  app.get<{ Params: { id: string } }>("/:id", async (request, reply) => {
    const getByIdHandler = new GetAgentByIdHandler(app.container.agentRepo);
    const result = await getByIdHandler.execute(
      request.params.id,
      request.operatorId,
    );
    if (result.isErr()) {
      return reply.status(404).send({
        errors: [
          {
            code: "NOT_FOUND",
            message: result.error.message,
            requestId: request.requestId,
          },
        ],
      });
    }

    return reply.status(200).send({
      data: result.value.toJSON(),
      meta: {
        requestId: request.requestId,
        timestamp: new Date().toISOString(),
      },
    });
  });

  // PATCH /api/v1/agents/:id
  app.patch<{ Params: { id: string } }>("/:id", async (request, reply) => {
    const parsed = UpdateAgentSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        errors: parsed.error.issues.map((i) => ({
          code: "VALIDATION_ERROR",
          message: i.message,
          field: i.path.join("."),
          requestId: request.requestId,
        })),
      });
    }

    const updateHandler = new UpdateAgentHandler(app.container.agentRepo);
    const result = await updateHandler.execute(
      request.params.id,
      request.operatorId,
      parsed.data,
    );
    if (result.isErr()) {
      const status = result.error.message.includes("not found") ? 404 : 400;
      return reply.status(status).send({
        errors: [
          {
            code: status === 404 ? "NOT_FOUND" : "VALIDATION_ERROR",
            message: result.error.message,
            requestId: request.requestId,
          },
        ],
      });
    }

    return reply.status(200).send({
      data: result.value.toJSON(),
      meta: {
        requestId: request.requestId,
        timestamp: new Date().toISOString(),
      },
    });
  });

  // POST /api/v1/agents/:id/activate
  app.post<{ Params: { id: string } }>(
    "/:id/activate",
    async (request, reply) => {
      const activateHandler = new ActivateAgentHandler(app.container.agentRepo);
      const result = await activateHandler.execute(
        request.params.id,
        request.operatorId,
      );
      if (result.isErr()) {
        const status = result.error.message.includes("not found") ? 404 : 400;
        return reply.status(status).send({
          errors: [
            {
              code: status === 404 ? "NOT_FOUND" : "VALIDATION_ERROR",
              message: result.error.message,
              requestId: request.requestId,
            },
          ],
        });
      }
      return reply.status(200).send({
        data: { message: "Agent activated" },
        meta: {
          requestId: request.requestId,
          timestamp: new Date().toISOString(),
        },
      });
    },
  );

  // POST /api/v1/agents/:id/pause
  app.post<{ Params: { id: string } }>("/:id/pause", async (request, reply) => {
    const body = request.body as Record<string, unknown> | undefined;
    const pauseHandler = new PauseAgentHandler(app.container.agentRepo);
    const result = await pauseHandler.execute(
      request.params.id,
      request.operatorId,
      body?.["reason"] as string | undefined,
    );
    if (result.isErr()) {
      const status = result.error.message.includes("not found") ? 404 : 400;
      return reply.status(status).send({
        errors: [
          {
            code: status === 404 ? "NOT_FOUND" : "VALIDATION_ERROR",
            message: result.error.message,
            requestId: request.requestId,
          },
        ],
      });
    }
    return reply.status(200).send({
      data: { message: "Agent paused" },
      meta: {
        requestId: request.requestId,
        timestamp: new Date().toISOString(),
      },
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SKILL SUB-RESOURCES
  // ═══════════════════════════════════════════════════════════════════════════

  // GET /api/v1/agents/:id/skills
  app.get<{ Params: { id: string } }>("/:id/skills", async (request, reply) => {
    const handler = new ListSkillsHandler(app.container.agentRepo);
    const result = await handler.execute(request.params.id, request.operatorId);
    if (result.isErr()) {
      return reply.status(404).send({
        errors: [
          {
            code: "NOT_FOUND",
            message: result.error.message,
            requestId: request.requestId,
          },
        ],
      });
    }
    return reply.status(200).send({
      data: result.value,
      meta: {
        requestId: request.requestId,
        timestamp: new Date().toISOString(),
      },
    });
  });

  // POST /api/v1/agents/:id/skills
  app.post<{ Params: { id: string } }>(
    "/:id/skills",
    async (request, reply) => {
      const parsed = CreateSkillSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          errors: parsed.error.issues.map((i) => ({
            code: "VALIDATION_ERROR",
            message: i.message,
            field: i.path.join("."),
            requestId: request.requestId,
          })),
        });
      }

      const handler = new AddSkillHandler(app.container.agentRepo);
      const result = await handler.execute(
        request.params.id,
        request.operatorId,
        parsed.data,
      );
      if (result.isErr()) {
        const status = result.error.message.includes("not found") ? 404 : 400;
        return reply.status(status).send({
          errors: [
            {
              code: status === 404 ? "NOT_FOUND" : "VALIDATION_ERROR",
              message: result.error.message,
              requestId: request.requestId,
            },
          ],
        });
      }

      return reply.status(201).send({
        data: result.value,
        meta: {
          requestId: request.requestId,
          timestamp: new Date().toISOString(),
        },
      });
    },
  );

  // PATCH /api/v1/agents/:id/skills/:skillId
  app.patch<{ Params: { id: string; skillId: string } }>(
    "/:id/skills/:skillId",
    async (request, reply) => {
      const parsed = UpdateSkillSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          errors: parsed.error.issues.map((i) => ({
            code: "VALIDATION_ERROR",
            message: i.message,
            field: i.path.join("."),
            requestId: request.requestId,
          })),
        });
      }

      const handler = new UpdateSkillHandler(app.container.agentRepo);
      const result = await handler.execute(
        request.params.id,
        request.params.skillId,
        request.operatorId,
        parsed.data,
      );
      if (result.isErr()) {
        const status = result.error.message.includes("not found") ? 404 : 400;
        return reply.status(status).send({
          errors: [
            {
              code: status === 404 ? "NOT_FOUND" : "VALIDATION_ERROR",
              message: result.error.message,
              requestId: request.requestId,
            },
          ],
        });
      }

      return reply.status(200).send({
        data: result.value,
        meta: {
          requestId: request.requestId,
          timestamp: new Date().toISOString(),
        },
      });
    },
  );

  // DELETE /api/v1/agents/:id/skills/:skillId
  app.delete<{ Params: { id: string; skillId: string } }>(
    "/:id/skills/:skillId",
    async (request, reply) => {
      const handler = new RemoveSkillHandler(app.container.agentRepo);
      const result = await handler.execute(
        request.params.id,
        request.params.skillId,
        request.operatorId,
      );
      if (result.isErr()) {
        const status = result.error.message.includes("not found") ? 404 : 400;
        return reply.status(status).send({
          errors: [
            {
              code: status === 404 ? "NOT_FOUND" : "VALIDATION_ERROR",
              message: result.error.message,
              requestId: request.requestId,
            },
          ],
        });
      }

      return reply.status(204).send();
    },
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // RULE SUB-RESOURCES
  // ═══════════════════════════════════════════════════════════════════════════

  // GET /api/v1/agents/:id/rules
  app.get<{ Params: { id: string } }>("/:id/rules", async (request, reply) => {
    const handler = new ListRulesHandler(app.container.agentRepo);
    const result = await handler.execute(request.params.id, request.operatorId);
    if (result.isErr()) {
      return reply.status(404).send({
        errors: [
          {
            code: "NOT_FOUND",
            message: result.error.message,
            requestId: request.requestId,
          },
        ],
      });
    }
    return reply.status(200).send({
      data: result.value,
      meta: {
        requestId: request.requestId,
        timestamp: new Date().toISOString(),
      },
    });
  });

  // POST /api/v1/agents/:id/rules
  app.post<{ Params: { id: string } }>("/:id/rules", async (request, reply) => {
    const parsed = CreateRuleSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        errors: parsed.error.issues.map((i) => ({
          code: "VALIDATION_ERROR",
          message: i.message,
          field: i.path.join("."),
          requestId: request.requestId,
        })),
      });
    }

    const handler = new AddRuleHandler(app.container.agentRepo);
    const result = await handler.execute(
      request.params.id,
      request.operatorId,
      parsed.data,
    );
    if (result.isErr()) {
      const status = result.error.message.includes("not found") ? 404 : 400;
      return reply.status(status).send({
        errors: [
          {
            code: status === 404 ? "NOT_FOUND" : "VALIDATION_ERROR",
            message: result.error.message,
            requestId: request.requestId,
          },
        ],
      });
    }

    return reply.status(201).send({
      data: result.value,
      meta: {
        requestId: request.requestId,
        timestamp: new Date().toISOString(),
      },
    });
  });

  // PATCH /api/v1/agents/:id/rules/:ruleId
  app.patch<{ Params: { id: string; ruleId: string } }>(
    "/:id/rules/:ruleId",
    async (request, reply) => {
      const parsed = UpdateRuleSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          errors: parsed.error.issues.map((i) => ({
            code: "VALIDATION_ERROR",
            message: i.message,
            field: i.path.join("."),
            requestId: request.requestId,
          })),
        });
      }

      const handler = new UpdateRuleHandler(app.container.agentRepo);
      const result = await handler.execute(
        request.params.id,
        request.params.ruleId,
        request.operatorId,
        parsed.data,
      );
      if (result.isErr()) {
        const status = result.error.message.includes("not found") ? 404 : 400;
        return reply.status(status).send({
          errors: [
            {
              code: status === 404 ? "NOT_FOUND" : "VALIDATION_ERROR",
              message: result.error.message,
              requestId: request.requestId,
            },
          ],
        });
      }

      return reply.status(200).send({
        data: result.value,
        meta: {
          requestId: request.requestId,
          timestamp: new Date().toISOString(),
        },
      });
    },
  );

  // DELETE /api/v1/agents/:id/rules/:ruleId
  app.delete<{ Params: { id: string; ruleId: string } }>(
    "/:id/rules/:ruleId",
    async (request, reply) => {
      const handler = new RemoveRuleHandler(app.container.agentRepo);
      const result = await handler.execute(
        request.params.id,
        request.params.ruleId,
        request.operatorId,
      );
      if (result.isErr()) {
        const status = result.error.message.includes("not found") ? 404 : 400;
        return reply.status(status).send({
          errors: [
            {
              code: status === 404 ? "NOT_FOUND" : "VALIDATION_ERROR",
              message: result.error.message,
              requestId: request.requestId,
            },
          ],
        });
      }

      return reply.status(204).send();
    },
  );
}
