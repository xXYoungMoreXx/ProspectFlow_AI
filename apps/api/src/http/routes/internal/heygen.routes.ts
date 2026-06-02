import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { HeyGenAdapter } from "../../../infrastructure/integrations/HeyGenAdapter.js";

const HeyGenGenerateSchema = z.object({
  projectId: z.string().min(1),
  siteUrl: z.string().url(),
  businessName: z.string().min(1).max(200),
});

/**
 * Internal-only endpoint: Python agent-runtime calls this to generate
 * HeyGen tutorial videos. Authenticated by X-Internal-Token header.
 * NEVER expose this prefix to the public internet.
 */
export async function internalHeyGenRoutes(
  app: FastifyInstance,
): Promise<void> {
  app.addHook("preHandler", async (request, reply) => {
    const token = request.headers["x-internal-token"] as string | undefined;
    const expected = process.env["INTERNAL_API_TOKEN"];
    if (!expected || token !== expected) {
      return reply.status(401).send({ error: "Unauthorized" });
    }
  });

  app.post("/heygen/generate", async (request, reply) => {
    const parseResult = HeyGenGenerateSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({ error: parseResult.error.flatten() });
    }

    const { projectId, siteUrl, businessName } = parseResult.data;
    const adapter = new HeyGenAdapter(app.container.secrets);

    const scriptText =
      `Olá! Seu site está pronto! ` +
      `Acesse ${siteUrl} para ver o resultado. ` +
      `Este tutorial vai te mostrar como gerenciar o site do ${businessName}. ` +
      `Qualquer dúvida, entre em contato com sua equipe de suporte.`;

    try {
      const result = await adapter.generateTutorial({ scriptText });
      request.log.info(
        { projectId, videoId: result.videoId },
        "heygen_tutorial_generated",
      );
      return reply.status(200).send({
        videoUrl: result.videoUrl,
        videoId: result.videoId,
        status: result.status,
      });
    } catch (err) {
      request.log.error({ err, projectId }, "heygen_generation_failed");
      return reply.status(502).send({ error: "HeyGen generation failed" });
    }
  });
}
