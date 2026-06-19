import pino from "pino";
import type { Job } from "bullmq";
import type { Redis } from "ioredis";
import type { DomainEventBase } from "@hefesto/shared-types";
import type { DealRepository } from "../../domain/deal/DealRepository.js";
import type { BriefingRepository } from "../../domain/briefing/BriefingRepository.js";
import type { LeadRepository } from "../../domain/lead/LeadRepository.js";
import { StartBriefingUseCase } from "../../application/briefing/StartBriefingUseCase.js";
import type { BullMQAdapter } from "./BullMQAdapter.js";

const log = pino({ level: process.env["LOG_LEVEL"] ?? "info" });

const WHATSAPP_SESSION_TTL = 86400; // 24h

/**
 * Consumes the "domain-events" queue and fans out to typed handlers.
 * Single consumer avoids competing workers on the same queue.
 */
export class DomainEventRouter {
  constructor(
    private readonly dealRepo: DealRepository,
    private readonly briefingRepo: BriefingRepository,
    private readonly queue: BullMQAdapter,
    private readonly leadRepo?: LeadRepository,
    private readonly redis?: Redis,
  ) {}

  start(): void {
    this.queue.createWorker("domain-events", async (job: Job) => {
      const event = job.data as DomainEventBase & {
        payload: Record<string, unknown>;
      };
      const eventLog = log.child({
        eventType: event.eventType,
        correlationId: event.correlationId,
      });

      try {
        switch (event.eventType) {
          case "deal.closed":
            await this.handleDealClosed(event);
            break;
          default:
            eventLog.debug("domain_event_unhandled");
        }
      } catch (err) {
        eventLog.error({ err }, "domain_event_handler_failed");
        throw err; // rethrow so BullMQ retries
      }
    });
  }

  async handleDealClosed(
    event: DomainEventBase & { payload: Record<string, unknown> },
  ): Promise<void> {
    const dealId = event.payload["dealId"] as string | undefined;
    if (!dealId) return;

    const deal = await this.dealRepo.findByIdInternal(dealId);
    if (!deal) {
      log.warn({ dealId }, "deal_closed_event_deal_not_found");
      return;
    }

    const uc = new StartBriefingUseCase(this.briefingRepo);
    const result = await uc.execute({
      dealId: deal.id,
      operatorId: deal.operatorId,
      correlationId: event.correlationId,
    });

    if (result.isErr()) {
      const code =
        result.error instanceof Error
          ? (result.error as { code?: string }).code
          : "UNKNOWN";
      if (code === "CONFLICT") {
        log.info({ dealId }, "briefing_already_exists_skip");
        return;
      }
      log.error({ err: result.error, dealId }, "start_briefing_failed");
      throw result.error;
    }

    const briefingId = result.unwrap().id;
    log.info({ dealId, briefingId }, "briefing_started_on_deal_close");

    // Store WhatsApp session in Redis so webhook can auto-extract on finalization
    if (this.leadRepo && this.redis && deal.leadId) {
      try {
        const lead = await this.leadRepo.findById(
          deal.leadId,
          deal.operatorId,
          "org_mvp",
        );
        if (lead?.contact.phone) {
          await this.redis.set(
            `whatsapp:${lead.contact.phone}`,
            briefingId,
            "EX",
            WHATSAPP_SESSION_TTL,
          );
          log.info(
            { phone: `${lead.contact.phone.slice(0, 4)}***`, briefingId },
            "whatsapp_session_stored",
          );
        }
      } catch (err) {
        // Non-fatal: briefing was created, WhatsApp session is best-effort
        log.warn({ err, dealId }, "whatsapp_session_store_failed");
      }
    }
  }
}
