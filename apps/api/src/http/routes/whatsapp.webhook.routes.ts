import type { FastifyInstance } from "fastify";
import { config } from "../../config.js";

interface EvolutionWebhookPayload {
  event: string;
  instance: string;
  data: {
    key: {
      remoteJid: string;
      fromMe: boolean;
      id: string;
    };
    message?: {
      conversation?: string;
      extendedTextMessage?: { text?: string };
    };
    pushName?: string;
  };
}

/**
 * SPEC-11: Evolution API WhatsApp webhook.
 * Validates HMAC or token header, ignores fromMe=true, enqueues fromMe=false for Closer.
 */
export async function whatsappWebhookRoutes(
  app: FastifyInstance,
): Promise<void> {
  app.post<{ Body: EvolutionWebhookPayload }>(
    "/whatsapp",
    {},
    async (request, reply) => {
      // Validate webhook secret if configured
      const secret = config.WHATSAPP_WEBHOOK_SECRET;
      if (secret) {
        const incomingToken = request.headers["x-evolution-secret-token"] as
          | string
          | undefined;
        if (incomingToken !== secret) {
          return reply.status(403).send({ error: "Forbidden" });
        }
      }

      const payload = request.body;
      if (!payload?.data) {
        return reply.status(200).send({ ok: true });
      }

      const { fromMe, remoteJid, id: messageId } = payload.data.key;

      // Silently ignore messages sent by the bot itself
      if (fromMe) {
        return reply.status(200).send({ ok: true });
      }

      const text =
        payload.data.message?.conversation ??
        payload.data.message?.extendedTextMessage?.text ??
        "";

      // Enqueue for Closer agent processing
      await app.container.queue.enqueueAgentTask(
        "closer.handle_inbound",
        {
          remoteJid,
          messageId,
          pushName: payload.data.pushName ?? "",
          text,
          instance: payload.instance,
        },
        messageId,
      );

      return reply.status(200).send({ ok: true });
    },
  );
}
