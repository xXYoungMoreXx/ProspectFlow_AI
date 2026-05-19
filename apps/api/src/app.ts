import Fastify, { type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import metricsPlugin from "fastify-metrics";
// @ts-expect-error - fastify-opentelemetry types are not updated for Fastify v5
// import openTelemetryPlugin from "fastify-opentelemetry";
import { config } from "./config.js";
import { authRoutes } from "./http/routes/auth.routes.js";
import { agentRoutes } from "./http/routes/agents.routes.js";
import { leadRoutes } from "./http/routes/leads.routes.js";
import { dealRoutes } from "./http/routes/deals.routes.js";
import { publicDealRoutes } from "./http/routes/deals.public.routes.js";
import { projectRoutes } from "./http/routes/projects.routes.js";
import { hitlRoutes } from "./http/routes/hitl.routes.js";
import { telegramWebhookRoutes } from "./http/routes/telegram.webhook.routes.js";
import { systemRoutes } from "./http/routes/system.routes.js";
import { uploadRoutes } from "./http/routes/upload.routes.js";
import { settingsRoutes } from "./http/routes/settings.routes.js";
import { errorHandler } from "./http/middleware/errorHandler.js";
import { requestIdHook } from "./http/middleware/requestId.middleware.js";
import { ssrfMiddleware } from "./http/middleware/ssrf.middleware.js";
import { createContainer } from "./container.js";

export async function buildApp(opts = {}): Promise<FastifyInstance> {
  const app = Fastify({
    logger: {
      level: config.NODE_ENV === "production" ? "info" : "debug",
      transport:
        config.NODE_ENV !== "production"
          ? { target: "pino-pretty", options: { colorize: true } }
          : undefined,
    },
    bodyLimit: config.MAX_BODY_SIZE,
    trustProxy: true,
    ...opts,
  });

  // ── Global Plugins ──────────────────────────────────────────────────────
  await app.register(cors, {
    origin: config.CORS_ORIGINS.split(","),
    credentials: true,
  });

  await app.register(helmet, {
    contentSecurityPolicy: config.NODE_ENV === "production",
  });

  await app.register(rateLimit, {
    max: 100,
    timeWindow: "1 minute",
  });

  // ── Observability ───────────────────────────────────────────────────────
  if (config.NODE_ENV !== "test") {
    // @ts-expect-error plugin typing mismatch
    await app.register(metricsPlugin, { endpoint: "/api/v1/metrics" });
  }
  // if (config.NODE_ENV !== "test") {
  //   await app.register(openTelemetryPlugin, { wrapRoutes: true });
  // }

  // ── Global Hooks ────────────────────────────────────────────────────────
  app.addHook("onRequest", requestIdHook);
  app.addHook("preHandler", ssrfMiddleware);
  app.setErrorHandler(errorHandler);

  // ── DI Container ─────────────────────────────────────────────────────────
  const container = createContainer();
  app.decorate("container", container);

  // Start background workers
  container.hitlWorker.start();
  container.emailWorker.start();
  container.agentExecutionService.start();

  app.addHook("onClose", async () => {
    await container.queue.close();
  });

  // ── Routes ──────────────────────────────────────────────────────────────
  await app.register(systemRoutes, { prefix: "/api/v1" });
  await app.register(authRoutes, { prefix: "/api/v1/auth" });
  await app.register(agentRoutes, { prefix: "/api/v1/agents" });
  await app.register(leadRoutes, { prefix: "/api/v1/leads" });
  await app.register(publicDealRoutes, { prefix: "/api/v1/deals" }); // Note: Register public before protected if paths conflict, but here they don't
  await app.register(dealRoutes, { prefix: "/api/v1/deals" });
  await app.register(projectRoutes, { prefix: "/api/v1/projects" });
  await app.register(hitlRoutes, { prefix: "/api/v1/hitl" });
  await app.register(uploadRoutes, { prefix: "/api/v1/upload" });
  await app.register(settingsRoutes, { prefix: "/api/v1/settings" });
  // Public webhook — secured via X-Telegram-Bot-Api-Secret-Token
  await app.register(telegramWebhookRoutes, { prefix: "/api/v1/telegram" });

  return app;
}
