import { eq, and, desc } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import * as schema from "../schema.js";
import {
  Briefing,
  type BriefingProps,
} from "../../../domain/briefing/Briefing.js";
import type { BriefingRepository } from "../../../domain/briefing/BriefingRepository.js";

type BriefingRow = typeof schema.briefings.$inferSelect;

export class DrizzleBriefingRepository implements BriefingRepository {
  constructor(private readonly db: PostgresJsDatabase<typeof schema>) {}

  async findById(id: string, operatorId: string): Promise<Briefing | null> {
    const [row] = await this.db
      .select()
      .from(schema.briefings)
      .where(
        and(
          eq(schema.briefings.id, id),
          eq(schema.briefings.operatorId, operatorId),
        ),
      )
      .limit(1);
    if (!row) return null;
    return this.toDomain(row);
  }

  async findByDealId(
    dealId: string,
    operatorId: string,
  ): Promise<Briefing | null> {
    const [row] = await this.db
      .select()
      .from(schema.briefings)
      .where(
        and(
          eq(schema.briefings.dealId, dealId),
          eq(schema.briefings.operatorId, operatorId),
        ),
      )
      .limit(1);
    if (!row) return null;
    return this.toDomain(row);
  }

  async save(briefing: Briefing): Promise<void> {
    const json = briefing.toJSON();

    await this.db
      .insert(schema.briefings)
      .values({
        id: json.id,
        dealId: json.dealId,
        operatorId: json.operatorId,
        agentId: json.agentId ?? null,
        status: json.status,
        nicheTemplate: json.nicheTemplate ?? null,
        briefingData: json.briefingData,
        interviewTranscriptRef: json.interviewTranscriptRef ?? null,
        approvedAt: json.approvedAt ?? null,
        createdAt: json.createdAt,
        updatedAt: json.updatedAt,
      })
      .onConflictDoUpdate({
        target: schema.briefings.id,
        set: {
          status: json.status,
          nicheTemplate: json.nicheTemplate ?? null,
          briefingData: json.briefingData,
          interviewTranscriptRef: json.interviewTranscriptRef ?? null,
          approvedAt: json.approvedAt ?? null,
          updatedAt: json.updatedAt,
        },
      });
  }

  async listByOperator(
    operatorId: string,
    limit: number,
    offset = 0,
  ): Promise<Briefing[]> {
    const rows = await this.db
      .select()
      .from(schema.briefings)
      .where(eq(schema.briefings.operatorId, operatorId))
      .orderBy(desc(schema.briefings.createdAt))
      .limit(limit)
      .offset(offset);
    return rows.map((r) => this.toDomain(r));
  }

  private toDomain(row: BriefingRow): Briefing {
    return Briefing.reconstitute({
      id: row.id,
      dealId: row.dealId,
      operatorId: row.operatorId,
      agentId: row.agentId ?? undefined,
      status: row.status as BriefingProps["status"],
      nicheTemplate: row.nicheTemplate ?? undefined,
      briefingData: (row.briefingData as Record<string, unknown>) ?? {},
      interviewTranscriptRef: row.interviewTranscriptRef ?? undefined,
      approvedAt: row.approvedAt ?? undefined,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }
}
