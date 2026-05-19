import type { Job } from "bullmq";
import type { BullMQAdapter } from "./BullMQAdapter.js";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { eq } from "drizzle-orm";
import * as schema from "../db/schema.js";
import { DrizzleHITLRepository } from "../db/repositories/DrizzleHITLRepository.js";
import type { TelegramAdapter } from "../messaging/TelegramAdapter.js";

export class HITLExpirationWorker {
  private readonly hitlRepository: DrizzleHITLRepository;

  constructor(
    private readonly queueAdapter: BullMQAdapter,
    private readonly db: PostgresJsDatabase<typeof schema>,
    private readonly telegram: TelegramAdapter,
  ) {
    this.hitlRepository = new DrizzleHITLRepository(db);
  }

  start() {
    this.queueAdapter.createWorker(
      "hitl-expiration",
      async (job: Job<{ approvalId: string }>) => {
        const { approvalId } = job.data;
        console.info(
          `[HITLExpirationWorker] Processing HITL expiration check for ${approvalId}`,
        );

        // We don't have operatorId from the job directly, but we can query by ID since ID is unique.
        // However, findById requires operatorId. Let's just use the DB to find the row, then map it.
        // A better way is to query the DB directly for the row just to get it, then use toDomain.
        // But we can just use the repository if we expose findByIdWithoutOperator or query DB directly:
        const [row] = await this.db
          .select()
          .from(schema.hitlApprovals)
          .where(eq(schema.hitlApprovals.id, approvalId))
          .limit(1);

        if (!row || row.status !== "PENDING") {
          console.debug(
            `[HITLExpirationWorker] Approval ${approvalId} not found or not pending. Skipping.`,
          );
          return;
        }

        // Reconstitute domain object. DrizzleHITLRepository.toDomain is private, so we can temporarily use hitlRepository methods
        // Actually, since we need operatorId, we have it from the row:
        const approval = await this.hitlRepository.findById(
          approvalId,
          row.operatorId,
        );

        if (!approval) return;

        if (approval.isFinancial) {
          console.info(
            `[HITLExpirationWorker] Approval ${approvalId} is HITL-FINANCEIRO. Never auto-expires. Dispatching Telegram alert.`,
          );
          
          try {
            await this.telegram.sendMessage({
              text: `🚨 <b>ALERTA DE APROVAÇÃO FINANCEIRA</b> 🚨\n\n📋 <b>ID:</b> <code>${approvalId}</code>\n🏷️ <b>Tipo:</b> HITL-FINANCEIRO\n👤 <b>Operador:</b> <code>${row.operatorId}</code>\n⚠️ <b>Contexto:</b> ${row.actionType || "Aprovação crítica pendente"}\n\nAprove ou rejeite diretamente abaixo:`,
              inlineKeyboard: [
                [
                  { text: "✅ Aprovar", callback_data: `hitl_approve:${approvalId}` },
                  { text: "❌ Rejeitar", callback_data: `hitl_reject:${approvalId}` },
                ],
              ],
            });
            console.info(`[HITLExpirationWorker] Telegram alert with inline buttons dispatched for ${approvalId}`);
          } catch (err) {
            console.error(`[HITLExpirationWorker] Failed to dispatch Telegram alert for ${approvalId}:`, err);
          }
          
          return;
        }

        if (approval.canAutoApprove) {
          const result = approval.autoApprove();
          if (result.isOk()) {
            await this.hitlRepository.save(approval);
            console.info(
              `[HITLExpirationWorker] HITL approval ${approvalId} (HITL-2) automatically APPROVED.`,
            );
          }
          return;
        }

        approval.expire();
        await this.hitlRepository.save(approval);
        console.info(
          `[HITLExpirationWorker] HITL approval ${approvalId} automatically EXPIRED.`,
        );

        // TODO: Dispatch domain events (auto_expired, auto_approved) using an EventDispatcher
      },
    );

    console.info(
      "[HITLExpirationWorker] Started listening to hitl-expiration queue",
    );
  }
}
