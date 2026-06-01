import { ulid } from "ulid";
import { eq, and, lte } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import * as schema from "../db/schema.js";
import type { BullMQAdapter } from "./BullMQAdapter.js";

const CADENCE_DAYS = [3, 7, 14] as const;

export class FollowUpWorker {
  constructor(
    private readonly queue: BullMQAdapter,
    private readonly db: PostgresJsDatabase<typeof schema>,
  ) {}

  start(): void {
    // Register daily cron job
    void this.queue.scheduleFollowUpCron();

    // Worker processes the cron triggers
    this.queue.createWorker("follow-up-cron", async (_job) => {
      await this.processOverdueFollowUps();
    });
  }

  // S2-06: Called after project is delivered — schedule +7d satisfaction + +30d NPS
  async schedulePostDelivery(
    dealId: string,
    leadId: string,
    operatorId: string,
    deliveredAt: Date,
    channel: "WHATSAPP" | "EMAIL" | "INTERNAL" | "TELEGRAM",
  ): Promise<void> {
    const CADENCE = [
      { days: 7, label: "satisfaction" },
      { days: 30, label: "nps" },
    ] as const;

    for (let i = 0; i < CADENCE.length; i++) {
      const { days } = CADENCE[i]!;
      const scheduledDate = new Date(deliveredAt.getTime() + days * 86_400_000);
      await this.db.insert(schema.followUps).values({
        id: ulid(),
        dealId,
        leadId,
        operatorId,
        attempt: i + 1,
        scheduledDate,
        channel,
        status: "SCHEDULED",
        notes: CADENCE[i]!.label,
      });
    }
  }

  // Called on deal closed to schedule the 3 follow-up attempts
  async scheduleForDeal(
    dealId: string,
    leadId: string,
    operatorId: string,
    closedAt: Date,
    channel: "WHATSAPP" | "EMAIL" | "INTERNAL" | "TELEGRAM",
  ): Promise<void> {
    for (let i = 0; i < CADENCE_DAYS.length; i++) {
      const days = CADENCE_DAYS[i]!;
      const scheduledDate = new Date(closedAt.getTime() + days * 86_400_000);
      await this.db.insert(schema.followUps).values({
        id: ulid(),
        dealId,
        leadId,
        operatorId,
        attempt: i + 1,
        scheduledDate,
        channel,
        status: "SCHEDULED",
      });
    }
  }

  // Daily sweep: expire overdue SCHEDULED items, mark deal LOST after attempt 3
  private async processOverdueFollowUps(): Promise<void> {
    const now = new Date();

    const overdue = await this.db
      .select()
      .from(schema.followUps)
      .where(
        and(
          eq(schema.followUps.status, "SCHEDULED"),
          lte(schema.followUps.scheduledDate, now),
        ),
      );

    for (const fu of overdue) {
      // Mark as FAILED — agent will send message separately via messaging adapter
      await this.db
        .update(schema.followUps)
        .set({ status: "FAILED", updatedAt: new Date() })
        .where(eq(schema.followUps.id, fu.id));

      // After attempt 3, mark deal as LOST
      if (fu.attempt >= 3) {
        await this.db
          .update(schema.deals)
          .set({
            status: "CANCELLED",
            closedReason: "No response after 3 follow-up attempts",
            updatedAt: new Date(),
          })
          .where(eq(schema.deals.id, fu.dealId));
      }
    }
  }
}
