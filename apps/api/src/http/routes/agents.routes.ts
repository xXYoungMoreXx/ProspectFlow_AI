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
import {
  ListSubAgentsHandler,
  CreateSubAgentHandler,
  GetSubAgentHandler,
  UpdateSubAgentHandler,
  DeleteSubAgentHandler,
  TestSubAgentHandler,
} from "../../application/agent/sub-agent.handlers.js";
import {
  ListRagDocumentsHandler,
  UploadRagDocumentHandler,
  DeleteRagDocumentHandler,
  QueryRagHandler,
} from "../../application/agent/rag.handlers.js";
import { eq, desc } from "drizzle-orm";
import * as schema from "../../infrastructure/db/schema.js";

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
      const activateHandler = new ActivateAgentHandler(
        app.container.agentRepo,
        app.container.llm,
      );
      const result = await activateHandler.execute(
        request.params.id,
        request.operatorId,
      );
      if (result.isErr()) {
        const errCode = (result.error as NodeJS.ErrnoException).code;
        const CONFLICT_CODES = new Set([
          "AGENT_NO_SKILLS",
          "BUDGET_EXHAUSTED",
          "LLM_CONNECTIVITY_ERROR",
        ]);
        const status = result.error.message.toLowerCase().includes("not found")
          ? 404
          : CONFLICT_CODES.has(errCode ?? "")
            ? 409
            : 400;
        return reply.status(status).send({
          errors: [
            {
              code:
                errCode ?? (status === 404 ? "NOT_FOUND" : "VALIDATION_ERROR"),
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

  // ═══════════════════════════════════════════════════════════════════════════
  // SUB-AGENT SUB-RESOURCES  (SPEC-02)
  // ═══════════════════════════════════════════════════════════════════════════

  // GET /api/v1/agents/:id/sub-agents
  app.get<{ Params: { id: string } }>(
    "/:id/sub-agents",
    async (request, reply) => {
      const handler = new ListSubAgentsHandler(app.container.agentRepo);
      const result = await handler.execute(
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
        data: result.value,
        meta: {
          requestId: request.requestId,
          timestamp: new Date().toISOString(),
        },
      });
    },
  );

  // POST /api/v1/agents/:id/sub-agents
  app.post<{ Params: { id: string } }>(
    "/:id/sub-agents",
    async (request, reply) => {
      const handler = new CreateSubAgentHandler(app.container.agentRepo);
      const body = request.body as Record<string, unknown>;
      const result = await handler.execute(
        request.params.id,
        request.operatorId,
        {
          role: body["role"] as string,
          llmProvider: body["llmProvider"] as string as never,
          llmModel: body["llmModel"] as string,
          llmTemperature: body["llmTemperature"] as number | undefined,
          llmMaxTokens: body["llmMaxTokens"] as number | undefined,
          executionMode:
            (body["executionMode"] as "sequential" | "parallel") ??
            "sequential",
          parallelGroup: body["parallelGroup"] as number | undefined,
          maxRetries: body["maxRetries"] as number | undefined,
          timeoutSeconds: body["timeoutSeconds"] as number | undefined,
        },
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

  // GET /api/v1/agents/:id/sub-agents/:subId
  app.get<{ Params: { id: string; subId: string } }>(
    "/:id/sub-agents/:subId",
    async (request, reply) => {
      const handler = new GetSubAgentHandler(app.container.agentRepo);
      const result = await handler.execute(
        request.params.id,
        request.params.subId,
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
        data: result.value,
        meta: {
          requestId: request.requestId,
          timestamp: new Date().toISOString(),
        },
      });
    },
  );

  // PATCH /api/v1/agents/:id/sub-agents/:subId
  app.patch<{ Params: { id: string; subId: string } }>(
    "/:id/sub-agents/:subId",
    async (request, reply) => {
      const handler = new UpdateSubAgentHandler(app.container.agentRepo);
      const result = await handler.execute(
        request.params.id,
        request.params.subId,
        request.operatorId,
        request.body as Record<string, unknown> as never,
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

  // DELETE /api/v1/agents/:id/sub-agents/:subId  (blocked if agent ACTIVE)
  app.delete<{ Params: { id: string; subId: string } }>(
    "/:id/sub-agents/:subId",
    async (request, reply) => {
      const handler = new DeleteSubAgentHandler(app.container.agentRepo);
      const result = await handler.execute(
        request.params.id,
        request.params.subId,
        request.operatorId,
      );
      if (result.isErr()) {
        const err = result.error as NodeJS.ErrnoException;
        const status =
          err.code === "AGENT_ACTIVE"
            ? 409
            : result.error.message.includes("not found")
              ? 404
              : 400;
        const code =
          err.code === "AGENT_ACTIVE"
            ? "AGENT_ACTIVE"
            : status === 404
              ? "NOT_FOUND"
              : "VALIDATION_ERROR";
        return reply.status(status).send({
          errors: [
            {
              code,
              message: result.error.message,
              requestId: request.requestId,
            },
          ],
        });
      }
      return reply.status(204).send();
    },
  );

  // POST /api/v1/agents/:id/sub-agents/:subId/test
  app.post<{ Params: { id: string; subId: string } }>(
    "/:id/sub-agents/:subId/test",
    async (request, reply) => {
      const handler = new TestSubAgentHandler(
        app.container.agentRepo,
        app.container.llm,
      );
      const result = await handler.execute(
        request.params.id,
        request.params.subId,
        request.operatorId,
      );
      if (result.isErr()) {
        const status = result.error.message.includes("not found") ? 404 : 502;
        return reply.status(status).send({
          errors: [
            {
              code: status === 404 ? "NOT_FOUND" : "LLM_ERROR",
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

  // ═══════════════════════════════════════════════════════════════════════════
  // RAG DOCUMENT MANAGEMENT  (SPEC-02 / S1-03)
  // ═══════════════════════════════════════════════════════════════════════════

  // GET /api/v1/agents/:id/rag/documents
  app.get<{ Params: { id: string } }>(
    "/:id/rag/documents",
    async (request, reply) => {
      const handler = new ListRagDocumentsHandler(
        app.container.agentRepo,
        app.container.rag,
      );
      const result = await handler.execute(
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
        data: result.value,
        meta: {
          requestId: request.requestId,
          timestamp: new Date().toISOString(),
        },
      });
    },
  );

  // POST /api/v1/agents/:id/rag/documents  (text/plain or application/json body)
  app.post<{ Params: { id: string } }>(
    "/:id/rag/documents",
    async (request, reply) => {
      const body = request.body as {
        filename?: string;
        content?: string;
        text?: string;
      };
      const filename = body.filename ?? "document.txt";
      const content = body.content ?? body.text ?? "";
      const MAX_CHARS = 10 * 1024 * 1024; // ~10MB text

      if (!content) {
        return reply.status(400).send({
          errors: [
            {
              code: "VALIDATION_ERROR",
              message: "content or text field required",
              requestId: request.requestId,
            },
          ],
        });
      }
      if (content.length > MAX_CHARS) {
        return reply.status(422).send({
          errors: [
            {
              code: "VALIDATION_ERROR",
              message: "Document exceeds 10MB limit",
              requestId: request.requestId,
            },
          ],
        });
      }

      const handler = new UploadRagDocumentHandler(
        app.container.agentRepo,
        app.container.queue,
      );
      const result = await handler.execute(
        request.params.id,
        request.operatorId,
        filename,
        content,
        request.requestId,
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
      return reply.status(202).send({
        data: result.value,
        meta: {
          requestId: request.requestId,
          timestamp: new Date().toISOString(),
        },
      });
    },
  );

  // DELETE /api/v1/agents/:id/rag/documents/:docId
  app.delete<{ Params: { id: string; docId: string } }>(
    "/:id/rag/documents/:docId",
    async (request, reply) => {
      const handler = new DeleteRagDocumentHandler(
        app.container.agentRepo,
        app.container.rag,
      );
      const result = await handler.execute(
        request.params.id,
        request.params.docId,
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

  // POST /api/v1/agents/:id/rag/query
  app.post<{ Params: { id: string } }>(
    "/:id/rag/query",
    async (request, reply) => {
      const body = request.body as { query?: string; topK?: number };
      if (!body.query) {
        return reply.status(400).send({
          errors: [
            {
              code: "VALIDATION_ERROR",
              message: "query field required",
              requestId: request.requestId,
            },
          ],
        });
      }
      const handler = new QueryRagHandler(
        app.container.agentRepo,
        app.container.rag,
      );
      const result = await handler.execute(
        request.params.id,
        request.operatorId,
        body.query,
        body.topK ?? 5,
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

  // ═══════════════════════════════════════════════════════════════════════════
  // AGENT LOGS + TOKEN-USAGE  (SPEC-02 / S1-04)
  // ═══════════════════════════════════════════════════════════════════════════

  // GET /api/v1/agents/:id/logs?cursor=&limit=
  app.get<{
    Params: { id: string };
    Querystring: { cursor?: string; limit?: string };
  }>("/:id/logs", async (request, reply) => {
    const agent = await app.container.agentRepo.findById(
      request.params.id,
      request.operatorId,
    );
    if (!agent) {
      return reply.status(404).send({
        errors: [
          {
            code: "NOT_FOUND",
            message: "Agent not found",
            requestId: request.requestId,
          },
        ],
      });
    }

    const limit = Math.min(parseInt(request.query.limit ?? "50", 10), 200);
    const conditions = [
      eq(schema.auditLog.resourceType, "Agent"),
      eq(schema.auditLog.resourceId, request.params.id),
    ];
    if (request.query.cursor) {
      const { lt } = await import("drizzle-orm");
      conditions.push(
        lt(schema.auditLog.timestamp, new Date(request.query.cursor)),
      );
    }

    const { and: andFn } = await import("drizzle-orm");
    const logs = await app.container.db
      .select()
      .from(schema.auditLog)
      .where(andFn(...conditions))
      .orderBy(desc(schema.auditLog.timestamp))
      .limit(limit + 1);

    const hasMore = logs.length > limit;
    const items = logs.slice(0, limit);

    return reply.status(200).send({
      data: items.map((l: typeof schema.auditLog.$inferSelect) => ({
        id: l.id,
        action: l.action,
        actor: l.actor,
        timestamp: l.timestamp,
        payload: l.payload,
        correlationId: l.correlationId,
      })),
      meta: {
        requestId: request.requestId,
        timestamp: new Date().toISOString(),
        cursor: {
          next: hasMore
            ? items[items.length - 1]!.timestamp.toISOString()
            : null,
          prev: null,
        },
      },
    });
  });

  // GET /api/v1/agents/:id/token-usage?period=day|week|month
  app.get<{ Params: { id: string }; Querystring: { period?: string } }>(
    "/:id/token-usage",
    async (request, reply) => {
      const agent = await app.container.agentRepo.findById(
        request.params.id,
        request.operatorId,
      );
      if (!agent) {
        return reply.status(404).send({
          errors: [
            {
              code: "NOT_FOUND",
              message: "Agent not found",
              requestId: request.requestId,
            },
          ],
        });
      }

      const agentJson = agent.toJSON();
      return reply.status(200).send({
        data: {
          agentId: agent.id,
          period: request.query.period ?? "all",
          tokenBudgetTotal: agentJson.tokenBudgetTotal,
          tokenBudgetRemaining: agentJson.tokenBudgetRemaining,
          tokenBudgetUsed:
            agentJson.tokenBudgetTotal - agentJson.tokenBudgetRemaining,
          utilizationPct:
            agentJson.tokenBudgetTotal > 0
              ? Math.round(
                  ((agentJson.tokenBudgetTotal -
                    agentJson.tokenBudgetRemaining) /
                    agentJson.tokenBudgetTotal) *
                    100,
                )
              : 0,
        },
        meta: {
          requestId: request.requestId,
          timestamp: new Date().toISOString(),
        },
      });
    },
  );
}
