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

// Exported for unit tests
export function isFinalizationMessage(text: string): boolean {
  const normalized = text.trim().toLowerCase();
  if (normalized.length === 0 || normalized.length > 10) return false;
  return ["ok", "pronto", "pode", "isso", "sim", "feito", "certo"].includes(
    normalized,
  );
}

const TRANSCRIPT_TTL = 86400; // 24h
const RUNTIME_URL = (): string =>
  process.env["PYTHON_RUNTIME_URL"] ?? "http://localhost:8001";

/**
 * SPEC-11: Evolution API WhatsApp webhook.
 * Validates token header, ignores fromMe=true.
 * If an active briefing session exists for the sender (Redis key whatsapp:{phone}):
 *   - Accumulates transcript in Redis list whatsapp:transcript:{briefingId}
 *   - On finalization keyword → dispatches briefing.extract to Python runtime
 * Otherwise: enqueues for Closer agent.
 */
export async function whatsappWebhookRoutes(
  app: FastifyInstance,
): Promise<void> {
  app.post<{ Body: EvolutionWebhookPayload }>(
    "/whatsapp",
    {},
    async (request, reply) => {
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

      if (fromMe) {
        return reply.status(200).send({ ok: true });
      }

      // Normalize phone: strip @s.whatsapp.net suffix
      const phone = remoteJid.replace(/@.+$/, "");
      const text =
        payload.data.message?.conversation ??
        payload.data.message?.extendedTextMessage?.text ??
        "";

      // Check for active briefing session
      const briefingId = await app.container.redis.get(`whatsapp:${phone}`);

      if (briefingId) {
        // Accumulate transcript entry
        const entry = JSON.stringify({
          from: phone,
          body: text,
          timestamp: new Date().toISOString(),
        });
        await app.container.redis.rpush(
          `whatsapp:transcript:${briefingId}`,
          entry,
        );
        await app.container.redis.expire(
          `whatsapp:transcript:${briefingId}`,
          TRANSCRIPT_TTL,
        );

        // Dispatch extraction on finalization keyword
        if (isFinalizationMessage(text)) {
          const rawTranscript = await app.container.redis.lrange(
            `whatsapp:transcript:${briefingId}`,
            0,
            -1,
          );
          const transcript = rawTranscript
            .map((rawEntry: string) => {
              try {
                const parsed = JSON.parse(rawEntry) as {
                  from: string;
                  body: string;
                  timestamp: string;
                };
                return `[${parsed.timestamp}] ${parsed.from}: ${parsed.body}`;
              } catch {
                return rawEntry;
              }
            })
            .join("\n");

          const runtimeUrl = RUNTIME_URL();
          await fetch(`${runtimeUrl}/tasks`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              task_type: "briefing.extract",
              agent_id: "system",
              correlation_id: request.id,
              payload: { briefingId, transcript },
            }),
            signal: AbortSignal.timeout(10_000),
          }).catch((err: unknown) => {
            request.log.warn(
              { err, briefingId },
              "briefing_extract_dispatch_failed",
            );
          });

          await app.container.redis.del(`whatsapp:${phone}`);
          request.log.info(
            { briefingId },
            "briefing_extract_triggered_via_whatsapp",
          );
        }

        return reply.status(200).send({ ok: true });
      }

      // No briefing session — enqueue for Closer agent
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
