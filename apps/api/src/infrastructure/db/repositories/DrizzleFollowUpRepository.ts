import { eq, and, asc } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import * as schema from "../schema.js";

export interface FollowUpRow {
  id: string;
  dealId: string;
  leadId: string;
  operatorId: string;
  attempt: number;
  scheduledDate: Date;
  sentAt: Date | null;
  channel: "WHATSAPP" | "EMAIL" | "INTERNAL" | "TELEGRAM";
  status: "SCHEDULED" | "SENT" | "FAILED" | "CANCELLED";
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export class DrizzleFollowUpRepository {
  constructor(private readonly db: PostgresJsDatabase<typeof schema>) {}

  async findById(id: string): Promise<FollowUpRow | null> {
    const [row] = await this.db
      .select()
      .from(schema.followUps)
      .where(eq(schema.followUps.id, id))
      .limit(1);
    return row ?? null;
  }

  async findByDealId(dealId: string): Promise<FollowUpRow[]> {
    return this.db
      .select()
      .from(schema.followUps)
      .where(eq(schema.followUps.dealId, dealId))
      .orderBy(asc(schema.followUps.attempt));
  }

  async findScheduledBefore(date: Date): Promise<FollowUpRow[]> {
    const { lte } = await import("drizzle-orm");
    return this.db
      .select()
      .from(schema.followUps)
      .where(
        and(
          eq(schema.followUps.status, "SCHEDULED"),
          lte(schema.followUps.scheduledDate, date),
        ),
      )
      .orderBy(asc(schema.followUps.scheduledDate));
  }

  async create(data: {
    id: string;
    dealId: string;
    leadId: string;
    operatorId: string;
    attempt: number;
    scheduledDate: Date;
    channel: "WHATSAPP" | "EMAIL" | "INTERNAL" | "TELEGRAM";
  }): Promise<FollowUpRow> {
    const [row] = await this.db
      .insert(schema.followUps)
      .values({
        ...data,
        status: "SCHEDULED",
      })
      .returning();
    return row!;
  }

  async update(
    id: string,
    data: Partial<Pick<FollowUpRow, "status" | "sentAt" | "notes">>,
  ): Promise<void> {
    await this.db
      .update(schema.followUps)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(schema.followUps.id, id));
  }
}
