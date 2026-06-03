import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { authMiddleware } from "../middleware/auth.middleware.js";
import { MediaGenerationError } from "../../infrastructure/media/MediaGenerationRouter.js";

const GenerateImageSchema = z.object({
  prompt: z.string().min(10).max(2000),
  width: z.number().int().min(256).max(2048).optional(),
  height: z.number().int().min(256).max(2048).optional(),
});

export async function mediaRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", authMiddleware);

  // POST /api/v1/media/generate — generate image via NanaBanana→DALL-E→Ollama fallback chain
  app.post("/generate", async (request, reply) => {
    const parsed = GenerateImageSchema.safeParse(request.body);
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
      const result = await app.container.mediaRouter.generate({
        prompt: parsed.data.prompt,
        width: parsed.data.width,
        height: parsed.data.height,
      });

      return reply.status(200).send({
        data: {
          imageBase64: result.buffer.toString("base64"),
          format: result.format,
          provider: result.provider,
          sizeBytes: result.buffer.byteLength,
        },
        meta: {
          requestId: request.requestId,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (e) {
      if (e instanceof MediaGenerationError) {
        const status = e.code === "ALL_PROVIDERS_FAILED" ? 502 : 422;
        return reply.status(status).send({
          errors: [
            { code: e.code, message: e.message, requestId: request.requestId },
          ],
        });
      }
      throw e;
    }
  });
}
