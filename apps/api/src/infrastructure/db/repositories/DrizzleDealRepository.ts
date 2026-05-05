import { eq, and, desc, gt, sql } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import * as schema from '../schema.js';
import { Deal, type DealProps, type Addon } from '../../../domain/deal/Deal.js';
import type { DealRepository, DealFilters, DealListResult } from '../../../domain/deal/DealRepository.js';
import type { DealStatus, ServiceType } from '@agentepro/shared-types';

export class DrizzleDealRepository implements DealRepository {
  constructor(private readonly db: PostgresJsDatabase<typeof schema>) {}

  async findById(id: string, operatorId: string): Promise<Deal | null> {
    const [row] = await this.db
      .select()
      .from(schema.deals)
      .where(and(eq(schema.deals.id, id), eq(schema.deals.operatorId, operatorId)))
      .limit(1);

    if (!row) return null;
    return this.toDomain(row);
  }

  async findMany(filters: DealFilters): Promise<DealListResult> {
    const conditions = [eq(schema.deals.operatorId, filters.operatorId)];
    if (filters.status) conditions.push(eq(schema.deals.status, filters.status));
    if (filters.leadId) conditions.push(eq(schema.deals.leadId, filters.leadId));
    if (filters.cursor) conditions.push(gt(schema.deals.id, filters.cursor));

    const limit = filters.limit ?? 20;

    const [countResult] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.deals)
      .where(and(...conditions));

    const rows = await this.db
      .select()
      .from(schema.deals)
      .where(and(...conditions))
      .orderBy(desc(schema.deals.createdAt))
      .limit(limit + 1);

    const hasMore = rows.length > limit;
    const items = rows.slice(0, limit);

    return {
      deals: items.map((r) => this.toDomain(r)),
      total: countResult?.count ?? 0,
      nextCursor: hasMore ? items[items.length - 1]!.id : null,
    };
  }

  async save(deal: Deal): Promise<void> {
    const json = deal.toJSON();

    await this.db
      .insert(schema.deals)
      .values({
        id: json.id,
        leadId: json.leadId,
        operatorId: json.operatorId,
        agentId: json.agentId ?? null,
        serviceType: json.serviceType,
        status: json.status,
        briefing: json.briefing,
        proposalText: json.proposalText ?? null,
        basePriceCents: json.basePriceCents,
        addons: json.addons as unknown as Record<string, unknown>[],
        discountPct: String(json.discountPct),
        currency: json.currency,
        proposalSentAt: json.proposalSentAt ?? null,
        closedAt: json.closedAt ?? null,
        closedReason: json.closedReason ?? null,
        createdAt: json.createdAt,
        updatedAt: json.updatedAt,
      })
      .onConflictDoUpdate({
        target: schema.deals.id,
        set: {
          status: json.status,
          proposalText: json.proposalText ?? null,
          basePriceCents: json.basePriceCents,
          addons: json.addons as unknown as Record<string, unknown>[],
          discountPct: String(json.discountPct),
          proposalSentAt: json.proposalSentAt ?? null,
          closedAt: json.closedAt ?? null,
          closedReason: json.closedReason ?? null,
          updatedAt: json.updatedAt,
        },
      });
  }

  private toDomain(row: typeof schema.deals.$inferSelect): Deal {
    const props: DealProps = {
      id: row.id,
      leadId: row.leadId,
      operatorId: row.operatorId,
      agentId: row.agentId ?? undefined,
      serviceType: row.serviceType as ServiceType,
      status: row.status as DealStatus,
      briefing: (row.briefing ?? {}) as Record<string, unknown>,
      proposalText: row.proposalText ?? undefined,
      basePriceCents: row.basePriceCents,
      addons: ((row.addons ?? []) as unknown as Addon[]),
      discountPct: Number(row.discountPct),
      currency: row.currency,
      proposalSentAt: row.proposalSentAt ?? undefined,
      closedAt: row.closedAt ?? undefined,
      closedReason: row.closedReason ?? undefined,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };

    return Deal.reconstitute(props);
  }
}
