import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { config } from "../../../config.js";

const WhatsAppMessageSchema = z.object({
  phone: z.string().regex(/^\d{12,15}$/, "telefone com DDI, apenas dígitos"),
  message: z.string().min(1).max(4096),
});

const EmailMessageSchema = z.object({
  to: z.string().email(),
  subject: z.string().min(1).max(255),
  htmlContent: z.string().min(1),
});

/**
 * Internal-only: o agent-runtime Python (skills whatsapp_sender/email_sender/
 * contract_notifier) chama estes endpoints para envio outbound real.
 * Autenticado por X-Internal-Token — NUNCA expor este prefixo publicamente.
 */
export async function internalMessagesRoutes(
  app: FastifyInstance,
): Promise<void> {
  app.addHook("preHandler", async (request, reply) => {
    const token = request.headers["x-internal-token"] as string | undefined;
    const expected = process.env["INTERNAL_API_TOKEN"];
    if (!expected || !token || token !== expected) {
      return reply.status(401).send({ error: "Unauthorized" });
    }
  });

  app.post("/messages/whatsapp", async (request, reply) => {
    const parsed = WhatsAppMessageSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }

    const { phone, message } = parsed.data;

    const isBlocked = await app.container.optOutRepo.isBlocked(phone);
    if (isBlocked) {
      request.log.warn(
        { module: "internalMessages" },
        "whatsapp_opt_out_block",
      );
      return reply.status(403).send({ error: "Lead opted out" });
    }

    try {
      const result = await app.container.whatsapp.sendText({
        instanceName: config.WPP_INSTANCE ?? "default",
        remoteJid: phone,
        text: message,
      });
      request.log.info(
        { module: "internalMessages", messageId: result.messageId },
        "whatsapp_outbound_sent",
      );
      return reply.status(200).send({ messageId: result.messageId });
    } catch (err) {
      request.log.error(
        { err, module: "internalMessages" },
        "whatsapp_outbound_failed",
      );
      return reply.status(502).send({ error: "WhatsApp delivery failed" });
    }
  });

  app.post("/messages/email", async (request, reply) => {
    const parsed = EmailMessageSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }

    const { to, subject, htmlContent } = parsed.data;
    await app.container.queue.enqueueEmail(to, subject, htmlContent);
    request.log.info({ module: "internalMessages" }, "email_outbound_queued");
    return reply.status(202).send({ queued: true });
  });
}
