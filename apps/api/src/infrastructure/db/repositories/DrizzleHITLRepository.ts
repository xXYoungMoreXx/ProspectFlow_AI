import { eq, and, desc, gt, lte, sql } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import * as schema from "../schema.js";
import {
  HITLApproval,
  type HITLApprovalProps,
} from "../../../domain/hitl/HITLApproval.js";
import { HITLLevel } from "../../../domain/hitl/HITLLevel.js";
import type {
  HITLApprovalRepository,
  HITLFilters,
  HITLListResult,
} from "../../../domain/hitl/HITLApprovalRepository.js";
import type { HITLStatus } from "@agentepro/shared-types";

export class DrizzleHITLRepository implements HITLApprovalRepository {
  constructor(private readonly db: PostgresJsDatabase<typeof schema>) {}

  async findById(
    id: string,
    operatorId: string,
    organizationId: string,
  ): Promise<HITLApproval | null> {
    const [row] = await this.db
      .select()
      .from(schema.hitlApprovals)
      .where(
        and(
          eq(schema.hitlApprovals.id, id),
          eq(schema.hitlApprovals.operatorId, operatorId),
          eq(schema.hitlApprovals.organizationId, organizationId),
        ),
      )
      .limit(1);

    if (!row) return null;
    return this.toDomain(row);
  }

  async findPending(
    operatorId: string,
    organizationId: string,
  ): Promise<HITLApproval[]> {
    const rows = await this.db
      .select()
      .from(schema.hitlApprovals)
      .where(
        and(
          eq(schema.hitlApprovals.operatorId, operatorId),
          eq(schema.hitlApprovals.organizationId, organizationId),
          eq(schema.hitlApprovals.status, "PENDING"),
        ),
      )
      .orderBy(desc(schema.hitlApprovals.createdAt));

    return rows.map((r) => this.toDomain(r));
  }

  async findExpired(): Promise<HITLApproval[]> {
    const rows = await this.db
      .select()
      .from(schema.hitlApprovals)
      .where(
        and(
          eq(schema.hitlApprovals.status, "PENDING"),
          lte(schema.hitlApprovals.expiresAt, new Date()),
        ),
      );

    return rows.map((r) => this.toDomain(r));
  }

  async findMany(filters: HITLFilters): Promise<HITLListResult> {
    const conditions = [
      eq(schema.hitlApprovals.operatorId, filters.operatorId),
      eq(schema.hitlApprovals.organizationId, filters.organizationId),
    ];
    if (filters.status)
      conditions.push(eq(schema.hitlApprovals.status, filters.status));
    if (filters.agentId)
      conditions.push(eq(schema.hitlApprovals.agentId, filters.agentId));
    if (filters.cursor)
      conditions.push(gt(schema.hitlApprovals.id, filters.cursor));

    const limit = filters.limit ?? 20;

    const [countResult] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.hitlApprovals)
      .where(and(...conditions));

    const rows = await this.db
      .select()
      .from(schema.hitlApprovals)
      .where(and(...conditions))
      .orderBy(desc(schema.hitlApprovals.createdAt))
      .limit(limit + 1);

    const hasMore = rows.length > limit;
    const items = rows.slice(0, limit);

    return {
      approvals: items.map((r) => this.toDomain(r)),
      total: countResult?.count ?? 0,
      nextCursor: hasMore ? items[items.length - 1]!.id : null,
    };
  }

  async save(approval: HITLApproval): Promise<void> {
    const json = approval.toJSON();

    await this.db
      .insert(schema.hitlApprovals)
      .values({
        id: json.id,
        operatorId: json.operatorId,
        agentId: json.agentId,
        hitlLevel: json.hitlLevel,
        actionType: json.actionType,
        contextType: json.contextType,
        contextId: json.contextId,
        payloadPreview: json.payloadPreview,
        payloadFullRef: json.payloadFullRef ?? null,
        status: json.status,
        operatorNote: json.operatorNote ?? null,
        expiresAt: json.expiresAt,
        decidedAt: json.decidedAt ?? null,
        createdAt: json.createdAt,
      })
      .onConflictDoUpdate({
        target: schema.hitlApprovals.id,
        set: {
          payloadPreview: json.payloadPreview,
          status: json.status,
          operatorNote: json.operatorNote ?? null,
          decidedAt: json.decidedAt ?? null,
        },
      });
  }

  private toDomain(
    row: typeof schema.hitlApprovals.$inferSelect,
  ): HITLApproval {
    const props: HITLApprovalProps = {
      id: row.id,
      operatorId: row.operatorId,
      agentId: row.agentId,
      hitlLevel: row.hitlLevel as HITLLevel,
      actionType: row.actionType,
      contextType: row.contextType,
      contextId: row.contextId,
      payloadPreview: (row.payloadPreview ?? {}) as Record<string, unknown>,
      payloadFullRef: row.payloadFullRef ?? undefined,
      status: row.status as HITLStatus,
      operatorNote: row.operatorNote ?? undefined,
      expiresAt: row.expiresAt,
      decidedAt: row.decidedAt ?? undefined,
      createdAt: row.createdAt,
    };

    return HITLApproval.reconstitute(props);
  }
}
