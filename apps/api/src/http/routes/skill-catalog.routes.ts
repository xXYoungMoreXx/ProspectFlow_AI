import type { FastifyInstance } from "fastify";
import { authMiddleware } from "../middleware/auth.middleware.js";
import { GetSkillCatalogHandler } from "../../application/agent/skill-catalog.handlers.js";
import type { ServiceType } from "@agentepro/shared-types";

export async function skillCatalogRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", authMiddleware);

  // GET /api/v1/skill-catalog?serviceType=WEBSITE&persona=HUNTER&limit=50
  app.get("/skill-catalog", async (request, reply) => {
    const { serviceType, persona, limit } = request.query as Record<
      string,
      string | undefined
    >;

    const handler = new GetSkillCatalogHandler((app as any).container.database);
    const result = await handler.execute({
      serviceType: serviceType as ServiceType | undefined,
      persona,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
    return reply.send(result);
  });

  // GET /api/v1/service-types
  app.get("/service-types", async (_request, reply) => {
    return reply.send({
      data: [
        { value: "WEBSITE", label: "Website" },
        { value: "TRAFFIC", label: "Traffic Management" },
        { value: "SOCIAL_MEDIA", label: "Social Media" },
        { value: "OTHER", label: "Other" },
      ],
    });
  });
}
