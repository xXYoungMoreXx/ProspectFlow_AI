import type { FastifyInstance } from "fastify";
import { config } from "../../config.js";

interface TelegramSalesUpdate {
  update_id: number;
  message?: {
    message_id: number;
    from: { id: number; username?: string; first_name?: string };
    chat: { id: number; type: string };
    text?: string;
    date: number;
  };
}

/**
 * SPEC-11: Telegram Sales bot webhook — separate from HITL bot.
 * Routes inbound messages to the Closer agent for lead qualification and negotiation.
 */
export async function telegramSalesRoutes(app: FastifyInstance): Promise<void> {
  app.post<{ Body: TelegramSalesUpdate }>(
    "/telegram/sales",
    async (request, reply) => {
      const secret = config.TELEGRAM_SALES_WEBHOOK_SECRET;
      if (secret) {
        const token = request.headers["x-telegram-bot-api-secret-token"] as
          | string
          | undefined;
        if (token !== secret) {
          return reply.status(403).send({ error: "Forbidden" });
        }
      }

      const { message } = request.body ?? {};
      if (!message?.text || !message.from) {
        return reply.status(200).send({ ok: true });
      }

      // Enqueue for Closer agent — handles lead/negotiation flow via Telegram
      await app.container.queue.enqueueAgentTask(
        "closer.handle_telegram_inbound",
        {
          telegramChatId: String(message.chat.id),
          telegramUserId: String(message.from.id),
          username: message.from.username ?? message.from.first_name ?? "",
          text: message.text,
          messageId: String(message.message_id),
        },
        String(message.message_id),
      );

      return reply.status(200).send({ ok: true });
    },
  );
}
