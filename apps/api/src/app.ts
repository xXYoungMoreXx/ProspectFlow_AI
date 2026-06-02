import Fastify, { type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import metricsPlugin from "fastify-metrics";
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
import { prospectingRoutes } from "./http/routes/prospecting.routes.js";
import { briefingRoutes } from "./http/routes/briefings.routes.js";
import { mediaRoutes } from "./http/routes/media.routes.js";
import { whatsappWebhookRoutes } from "./http/routes/whatsapp.webhook.routes.js";
import { telegramSalesRoutes } from "./http/routes/telegram.sales.routes.js";
import { costsRoutes } from "./http/routes/costs.routes.js";
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

  if (config.NODE_ENV !== "test") {
    // @ts-expect-error plugin typing mismatch
    await app.register(metricsPlugin, { endpoint: "/api/v1/metrics" });
  }

  // ── API Documentation (dev + staging only) ─────────────────────────────
  if (config.NODE_ENV !== "production") {
    await app.register(swagger, {
      openapi: {
        info: {
          title: "AgentePro API",
          description:
            "REST API para plataforma de agentes de IA — prospecção e entrega de sites",
          version: "1.0.0",
        },
        servers: [{ url: `http://localhost:${config.PORT}` }],
        components: {
          securitySchemes: {
            bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
          },
        },
        security: [{ bearerAuth: [] }],
      },
    });

    await app.register(swaggerUi, {
      routePrefix: "/api/docs",
      uiConfig: { docExpansion: "list", deepLinking: true },
      staticCSP: true,
    });
  }

  app.addHook("onRequest", requestIdHook);
  app.addHook("preHandler", ssrfMiddleware);
  app.setErrorHandler(errorHandler);

  const container = createContainer();
  app.decorate("container", container);

  container.hitlWorker.start();
  container.emailWorker.start();
  container.followUpWorker.start();
  container.agentExecutionService.start();
  container.domainEventRouter.start();

  app.addHook("onClose", async () => {
    await container.queue.close();
  });

  await app.register(systemRoutes, { prefix: "/api/v1" });
  await app.register(authRoutes, { prefix: "/api/v1/auth" });
  await app.register(agentRoutes, { prefix: "/api/v1/agents" });
  await app.register(leadRoutes, { prefix: "/api/v1/leads" });
  await app.register(publicDealRoutes, { prefix: "/api/v1/deals" });
  await app.register(dealRoutes, { prefix: "/api/v1/deals" });
  await app.register(projectRoutes, { prefix: "/api/v1/projects" });
  await app.register(hitlRoutes, { prefix: "/api/v1/hitl" });
  await app.register(uploadRoutes, { prefix: "/api/v1/upload" });
  await app.register(settingsRoutes, { prefix: "/api/v1/settings" });
  await app.register(prospectingRoutes, { prefix: "/api/v1/prospecting" });
  await app.register(briefingRoutes, { prefix: "/api/v1/briefings" });
  await app.register(mediaRoutes, { prefix: "/api/v1/media" });
  await app.register(whatsappWebhookRoutes, { prefix: "/webhooks" });
  await app.register(telegramSalesRoutes, { prefix: "/webhooks" });
  await app.register(costsRoutes, { prefix: "/api/v1/costs" });
  await app.register(telegramWebhookRoutes, { prefix: "/api/v1/telegram" });

  return app;
}
