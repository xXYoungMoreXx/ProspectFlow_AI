import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { authMiddleware } from "../middleware/auth.middleware.js";
import { CalComAdapter } from "../../infrastructure/integrations/CalComAdapter.js";
import { ValidationError } from "../../domain/shared/Result.js";

const BookingSchema = z.object({
  eventTypeId: z.number().int().positive(),
  startTime: z.string().datetime({ message: "startTime must be ISO 8601" }),
  name: z.string().min(1).max(200),
  email: z.string().email(),
  phone: z.string().optional(),
  notes: z.string().max(2000).optional(),
  timeZone: z.string().optional(),
});

export async function schedulingRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", authMiddleware);

  // Fastify 5 schema validation requires JSON Schema (not Zod) — manual safeParse used instead
  app.post("/booking", {}, async (request, reply) => {
    const body = BookingSchema.safeParse(request.body);
    if (!body.success) {
      throw new ValidationError(
        body.error.errors[0]?.message ?? "invalid body",
      );
    }

    const adapter = new CalComAdapter(app.container.secrets);
    const result = await adapter.scheduleBooking(body.data);

    return reply.status(201).send({ data: result });
  });
}
