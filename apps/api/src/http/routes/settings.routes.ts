import type { FastifyInstance } from "fastify";
import { authMiddleware } from "../middleware/auth.middleware.js";
import {
  updateSettingsBodySchema,
  testConnectionBodySchema,
  categoryParamsSchema,
  keyParamsSchema,
  ollamaDeleteParamsSchema,
} from "../schemas/settings.schemas.js";

/**
 * Settings routes — UI-configurable system settings.
 * All routes require JWT authentication.
 *
 * GET    /api/v1/settings               — List all settings (secrets masked)
 * GET    /api/v1/settings/schema        — Get settings schema for UI form rendering
 * GET    /api/v1/settings/:category     — List by category
 * PUT    /api/v1/settings               — Upsert batch
 * DELETE /api/v1/settings/:key          — Delete a setting
 * POST   /api/v1/settings/test          — Test service connection
 * GET    /api/v1/settings/ollama/status  — Ollama health + GPU info
 * GET    /api/v1/settings/ollama/models  — List installed models
 * GET    /api/v1/settings/ollama/catalog — List available models to pull
 * POST   /api/v1/settings/ollama/pull   — Pull a model (streaming SSE)
 * DELETE /api/v1/settings/ollama/:name  — Delete a model
 */
export async function settingsRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", authMiddleware);

  // ── Settings Schema (for UI form generation) ──────────────────────────────

  app.get("/schema", async (request, reply) => {
    const schema = app.container.settingsService.getSettingsSchema();
    return reply.status(200).send({
      data: schema,
      meta: {
        requestId: request.requestId,
        timestamp: new Date().toISOString(),
      },
    });
  });

  // ── List All Settings ─────────────────────────────────────────────────────

  app.get("/", async (request, reply) => {
    const settings = await app.container.settingsService.listAll(
      request.operatorId,
    );
    return reply.status(200).send({
      data: settings,
      meta: {
        requestId: request.requestId,
        timestamp: new Date().toISOString(),
      },
    });
  });

  // ── List by Category ──────────────────────────────────────────────────────

  app.get<{ Params: { category: string } }>(
    "/category/:category",
    async (request, reply) => {
      const parsed = categoryParamsSchema.safeParse(request.params);
      if (!parsed.success) {
        return reply.status(400).send({
          errors: parsed.error.issues.map((i) => ({
            code: "VALIDATION_ERROR",
            message: i.message,
            requestId: request.requestId,
          })),
        });
      }
      const settings = await app.container.settingsService.listByCategory(
        request.operatorId,
        parsed.data.category,
      );
      return reply.status(200).send({
        data: settings,
        meta: {
          requestId: request.requestId,
          timestamp: new Date().toISOString(),
        },
      });
    },
  );

  // ── Upsert Batch ──────────────────────────────────────────────────────────

  app.put("/", async (request, reply) => {
    const parsed = updateSettingsBodySchema.safeParse(request.body);
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

    try {
      const results = await app.container.settingsService.updateSettings(
        request.operatorId,
        parsed.data.settings,
      );
      return reply.status(200).send({
        data: results,
        meta: {
          requestId: request.requestId,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Update failed";
      return reply.status(400).send({
        errors: [
          { code: "VALIDATION_ERROR", message, requestId: request.requestId },
        ],
      });
    }
  });

  // ── Delete Setting ────────────────────────────────────────────────────────

  app.delete<{ Params: { key: string } }>("/:key", async (request, reply) => {
    const parsed = keyParamsSchema.safeParse(request.params);
    if (!parsed.success) {
      return reply.status(400).send({
        errors: parsed.error.issues.map((i) => ({
          code: "VALIDATION_ERROR",
          message: i.message,
          requestId: request.requestId,
        })),
      });
    }

    const deleted = await app.container.settingsService.deleteSetting(
      request.operatorId,
      parsed.data.key,
    );

    if (!deleted) {
      return reply.status(404).send({
        errors: [
          {
            code: "NOT_FOUND",
            message: `Setting '${parsed.data.key}' not found`,
            requestId: request.requestId,
          },
        ],
      });
    }

    return reply.status(200).send({
      data: { deleted: true, key: parsed.data.key },
      meta: {
        requestId: request.requestId,
        timestamp: new Date().toISOString(),
      },
    });
  });

  // ── Test Connection (/test and /test-connection alias for api.ts client) ───

  const handleTestConnection = async (request: any, reply: any) => {
    const parsed = testConnectionBodySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        errors: parsed.error.issues.map((i: any) => ({
          code: "VALIDATION_ERROR",
          message: i.message,
          requestId: request.requestId,
        })),
      });
    }

    const result = await app.container.settingsService.testConnection(
      request.operatorId,
      parsed.data.service,
    );

    return reply.status(200).send({
      data: result,
      meta: {
        requestId: request.requestId,
        timestamp: new Date().toISOString(),
      },
    });
  };

  app.post("/test", handleTestConnection);
  app.post("/test-connection", handleTestConnection);

  // ═══════════════════════════════════════════════════════════════════════════
  // OLLAMA MANAGEMENT
  // ═══════════════════════════════════════════════════════════════════════════

  app.get("/ollama/status", async (request, reply) => {
    const status = await app.container.ollamaProxy.getStatus();
    return reply.status(200).send({
      data: status,
      meta: {
        requestId: request.requestId,
        timestamp: new Date().toISOString(),
      },
    });
  });

  app.get("/ollama/models", async (request, reply) => {
    try {
      const models = await app.container.ollamaProxy.listModels();
      return reply.status(200).send({
        data: models,
        meta: {
          requestId: request.requestId,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Ollama unavailable";
      return reply.status(503).send({
        errors: [
          {
            code: "SERVICE_UNAVAILABLE",
            message,
            requestId: request.requestId,
          },
        ],
      });
    }
  });

  app.get("/ollama/catalog", async (request, reply) => {
    const catalog = app.container.ollamaProxy.getAvailableModels();
    return reply.status(200).send({
      data: catalog,
      meta: {
        requestId: request.requestId,
        timestamp: new Date().toISOString(),
      },
    });
  });

  // ── Pull Model (SSE Streaming via GET — EventSource requires GET) ───────────
  // Auth: reads ?token= query param since EventSource cannot set headers.

  app.get<{ Querystring: { model: string; token?: string } }>(
    "/ollama/pull",
    { preHandler: [] }, // skip preHandler authMiddleware — uses token query param below
    async (request, reply) => {
      const { model, token: queryToken } = request.query as {
        model?: string;
        token?: string;
      };

      // SSE cannot send Authorization headers, so a short-lived token is passed as ?token=
      // We require either the preHandler to have set operatorId (Bearer header) or a valid token param.
      if (!request.operatorId) {
        if (!queryToken) {
          reply.raw.writeHead(401);
          reply.raw.end();
          return;
        }
        try {
          const jwt = app.container.jwtService;
          const payload = await jwt.verifyAccessToken(queryToken);
          if (!payload.sub) throw new Error("missing sub");
          (request as any).operatorId = payload.sub;
        } catch {
          reply.raw.writeHead(401);
          reply.raw.end();
          return;
        }
      }

      if (!model) {
        return reply.status(400).send({
          errors: [
            {
              code: "VALIDATION_ERROR",
              message: "model is required",
              requestId: request.requestId,
            },
          ],
        });
      }

      reply.raw.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "Access-Control-Allow-Origin": "*",
      });

      try {
        for await (const progress of app.container.ollamaProxy.pullModel(
          model,
        )) {
          reply.raw.write(`data: ${JSON.stringify(progress)}\n\n`);
        }
        reply.raw.write(
          `data: ${JSON.stringify({ status: "success", completed: true })}\n\n`,
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : "Pull failed";
        reply.raw.write(
          `data: ${JSON.stringify({ status: "error", error: message })}\n\n`,
        );
      } finally {
        reply.raw.end();
      }
    },
  );

  // ── Delete Model ──────────────────────────────────────────────────────────

  app.delete<{ Params: { name: string } }>(
    "/ollama/:name",
    async (request, reply) => {
      const parsed = ollamaDeleteParamsSchema.safeParse(request.params);
      if (!parsed.success) {
        return reply.status(400).send({
          errors: parsed.error.issues.map((i) => ({
            code: "VALIDATION_ERROR",
            message: i.message,
            requestId: request.requestId,
          })),
        });
      }

      try {
        await app.container.ollamaProxy.deleteModel(parsed.data.name);
        return reply.status(200).send({
          data: { deleted: true, model: parsed.data.name },
          meta: {
            requestId: request.requestId,
            timestamp: new Date().toISOString(),
          },
        });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Delete failed";
        return reply.status(400).send({
          errors: [
            { code: "DELETE_FAILED", message, requestId: request.requestId },
          ],
        });
      }
    },
  );
}
