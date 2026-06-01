import type { FastifyInstance } from "fastify";
import { eq } from "drizzle-orm";
import { config } from "../../config.js";
import * as schema from "../../infrastructure/db/schema.js";
import {
  ApproveHITLHandler,
  RejectHITLHandler,
} from "../../application/hitl/hitl.handlers.js";

interface TelegramUpdate {
  update_id: number;
  callback_query?: {
    id: string;
    from: { id: number; username?: string };
    data?: string;
    message?: {
      message_id: number;
      chat: { id: number };
      text?: string;
    };
  };
}

/**
 * Public Telegram Webhook routes for inline button callbacks.
 *
 * Security: validated via X-Telegram-Bot-Api-Secret-Token header,
 * which Telegram sends automatically when you register a webhook with `secret_token`.
 *
 * Register your webhook once (replace vars):
 *   curl -X POST "https://api.telegram.org/bot<TOKEN>/setWebhook" \
 *        -d "url=https://your-api.com/api/v1/telegram/webhook" \
 *        -d "secret_token=<TELEGRAM_WEBHOOK_SECRET>"
 */
export async function telegramWebhookRoutes(
  app: FastifyInstance,
): Promise<void> {
  app.post<{ Body: TelegramUpdate }>("/webhook", async (request, reply) => {
    // ── 1. Validate incoming request ────────────────────────────────────────
    const webhookSecret = config.TELEGRAM_WEBHOOK_SECRET;
    if (webhookSecret) {
      const incomingToken = request.headers["x-telegram-bot-api-secret-token"];
      if (incomingToken !== webhookSecret) {
        request.log.warn("[TelegramWebhook] Rejected: invalid secret token.");
        return reply.status(403).send({ error: "Forbidden" });
      }
    }

    const { callback_query: callbackQuery } = request.body ?? {};

    // ── 2. Ignore non-callback updates ───────────────────────────────────────
    if (!callbackQuery?.data) {
      return reply.status(200).send({ ok: true });
    }

    const [action, approvalId] = callbackQuery.data.split(":");

    if (
      !approvalId ||
      (action !== "hitl_approve" && action !== "hitl_reject")
    ) {
      await safeSendAnswer(app, callbackQuery.id, "⚠️ Ação desconhecida.");
      return reply.status(200).send({ ok: true });
    }

    // ── 3. Look up approval to get operatorId ───────────────────────────────
    // Telegram callbacks don't carry auth context — we resolve operatorId from DB.
    const [hitlRow] = await app.container.db
      .select({
        id: schema.hitlApprovals.id,
        operatorId: schema.hitlApprovals.operatorId,
        status: schema.hitlApprovals.status,
      })
      .from(schema.hitlApprovals)
      .where(eq(schema.hitlApprovals.id, approvalId))
      .limit(1);

    if (!hitlRow) {
      await safeSendAnswer(
        app,
        callbackQuery.id,
        "❌ Aprovação não encontrada.",
      );
      return reply.status(200).send({ ok: true });
    }

    if (hitlRow.status !== "PENDING") {
      await safeSendAnswer(
        app,
        callbackQuery.id,
        `ℹ️ Esta aprovação já foi ${hitlRow.status.toLowerCase()}.`,
      );
      return reply.status(200).send({ ok: true });
    }

    // ── 4. Execute approve or reject ─────────────────────────────────────────
    if (action === "hitl_approve") {
      const handler = new ApproveHITLHandler(app.container.hitlRepo);
      const result = await handler.execute(
        approvalId,
        hitlRow.operatorId,
        "Aprovado via Telegram",
      );

      if (result.isErr()) {
        request.log.error(
          { err: result.error },
          "[TelegramWebhook] Approve failed",
        );
        await safeSendAnswer(
          app,
          callbackQuery.id,
          `❌ Erro ao aprovar: ${result.error.message}`,
        );
      } else {
        request.log.info(
          { approvalId },
          "[TelegramWebhook] Approval approved via Telegram",
        );
        await safeSendAnswer(app, callbackQuery.id, "✅ Aprovação confirmada!");
        if (callbackQuery.message) {
          await safeEditMessage(
            app,
            callbackQuery.message.chat.id,
            callbackQuery.message.message_id,
            `${callbackQuery.message.text || "Alerta de HITL"}\n\n✅ <b>Aprovado por Telegram</b>`,
          );
        }
      }
    } else {
      const handler = new RejectHITLHandler(app.container.hitlRepo);
      const result = await handler.execute(
        approvalId,
        hitlRow.operatorId,
        "Rejeitado via Telegram",
      );

      if (result.isErr()) {
        request.log.error(
          { err: result.error },
          "[TelegramWebhook] Reject failed",
        );
        await safeSendAnswer(
          app,
          callbackQuery.id,
          `❌ Erro ao rejeitar: ${result.error.message}`,
        );
      } else {
        request.log.info(
          { approvalId },
          "[TelegramWebhook] Approval rejected via Telegram",
        );
        await safeSendAnswer(app, callbackQuery.id, "✅ Rejeição registrada!");
        if (callbackQuery.message) {
          await safeEditMessage(
            app,
            callbackQuery.message.chat.id,
            callbackQuery.message.message_id,
            `${callbackQuery.message.text || "Alerta de HITL"}\n\n❌ <b>Rejeitado por Telegram</b>`,
          );
        }
      }
    }

    return reply.status(200).send({ ok: true });
  });
}

/** Silently catch errors on answerCallbackQuery to avoid crashing the handler. */
async function safeSendAnswer(
  app: FastifyInstance,
  callbackQueryId: string,
  text: string,
): Promise<void> {
  try {
    await app.container.telegram.answerCallbackQuery(callbackQueryId, text);
  } catch (err) {
    app.log.warn({ err }, "[TelegramWebhook] Failed to answer callback query");
  }
}

/** Silently catch errors on editMessageText to avoid crashing the handler. */
async function safeEditMessage(
  app: FastifyInstance,
  chatId: number,
  messageId: number,
  text: string,
): Promise<void> {
  try {
    await app.container.telegram.editMessageText({
      chatId,
      messageId,
      text,
      parseMode: "HTML",
    });
  } catch (err) {
    app.log.warn({ err }, "[TelegramWebhook] Failed to edit message text");
  }
}
