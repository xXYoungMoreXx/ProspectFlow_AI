import { ulid } from "ulid";
import { eq, and, desc } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import * as schema from "../schema.js";
import type {
  AuditEntry,
  AuditLogRepository,
} from "../../../domain/shared/AuditLogRepository.js";

/**
 * Append-only audit log repository.
 * No update or delete operations — enforced at DB level too.
 */
export class DrizzleAuditLogRepository implements AuditLogRepository {
  constructor(private readonly db: PostgresJsDatabase<typeof schema>) {}

  async append(entry: AuditEntry): Promise<void> {
    await this.db.insert(schema.auditLog).values({
      id: entry.id || ulid(),
      actor: entry.actor,
      actorId: entry.actorId,
      action: entry.action,
      resourceType: entry.resourceType,
      resourceId: entry.resourceId,
      payload: entry.payload,
      ipAddress: entry.ipAddress ?? null,
      correlationId: entry.correlationId,
      causationId: entry.causationId ?? null,
    });
  }

  async findByResource(
    resourceType: string,
    resourceId: string,
  ): Promise<AuditEntry[]> {
    const rows = await this.db
      .select()
      .from(schema.auditLog)
      .where(
        and(
          eq(schema.auditLog.resourceType, resourceType),
          eq(schema.auditLog.resourceId, resourceId),
        ),
      )
      .orderBy(desc(schema.auditLog.timestamp))
      .limit(100);

    return rows.map(this.toAuditEntry);
  }

  async findByCorrelation(correlationId: string): Promise<AuditEntry[]> {
    const rows = await this.db
      .select()
      .from(schema.auditLog)
      .where(eq(schema.auditLog.correlationId, correlationId))
      .orderBy(desc(schema.auditLog.timestamp))
      .limit(100);

    return rows.map(this.toAuditEntry);
  }

  private toAuditEntry(row: typeof schema.auditLog.$inferSelect): AuditEntry {
    return {
      id: row.id,
      actor: row.actor as AuditEntry["actor"],
      actorId: row.actorId,
      action: row.action,
      resourceType: row.resourceType,
      resourceId: row.resourceId,
      payload: (row.payload ?? {}) as Record<string, unknown>,
      ipAddress: row.ipAddress ?? undefined,
      correlationId: row.correlationId,
      causationId: row.causationId ?? undefined,
    };
  }
}
