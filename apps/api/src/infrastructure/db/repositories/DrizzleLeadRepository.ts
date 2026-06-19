import { eq, and, desc, lt, ilike, sql } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import * as schema from "../schema.js";
import {
  Lead,
  type LeadProps,
  type ContactInfo,
} from "../../../domain/lead/Lead.js";
import type {
  LeadRepository,
  LeadFilters,
  LeadListResult,
} from "../../../domain/lead/LeadRepository.js";
import type { LeadStatus, LeadSource } from "@hefesto/shared-types";

export class DrizzleLeadRepository implements LeadRepository {
  constructor(private readonly db: PostgresJsDatabase<typeof schema>) {}

  async findById(
    id: string,
    operatorId: string,
    organizationId: string,
  ): Promise<Lead | null> {
    const [row] = await this.db
      .select()
      .from(schema.leads)
      .where(
        and(
          eq(schema.leads.id, id),
          eq(schema.leads.operatorId, operatorId),
          eq(schema.leads.organizationId, organizationId),
        ),
      )
      .limit(1);

    if (!row) return null;
    return this.toDomain(row);
  }

  async findMany(filters: LeadFilters): Promise<LeadListResult> {
    const conditions = [
      eq(schema.leads.operatorId, filters.operatorId),
      eq(schema.leads.organizationId, filters.organizationId),
    ];
    if (filters.status)
      conditions.push(eq(schema.leads.status, filters.status));
    if (filters.assignedAgentId)
      conditions.push(
        eq(schema.leads.assignedAgentId, filters.assignedAgentId),
      );
    if (filters.search)
      conditions.push(ilike(schema.leads.contactName, `%${filters.search}%`));
    if (filters.cursor)
      conditions.push(lt(schema.leads.createdAt, new Date(filters.cursor)));

    const limit = filters.limit ?? 20;

    const [countResult] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.leads)
      .where(and(...conditions));

    const rows = await this.db
      .select()
      .from(schema.leads)
      .where(and(...conditions))
      .orderBy(desc(schema.leads.createdAt))
      .limit(limit + 1);

    const hasMore = rows.length > limit;
    const items = rows.slice(0, limit);

    return {
      leads: items.map((r) => this.toDomain(r)),
      total: countResult?.count ?? 0,
      nextCursor: hasMore
        ? items[items.length - 1]!.createdAt.toISOString()
        : null,
    };
  }

  async save(lead: Lead): Promise<void> {
    const json = lead.toJSON();

    await this.db
      .insert(schema.leads)
      .values({
        id: json.id,
        operatorId: json.operatorId,
        assignedAgentId: json.assignedAgentId ?? null,
        contactName: json.contact.name,
        contactEmail: json.contact.email ?? null,
        contactPhone: json.contact.phone ?? null,
        contactCompany: json.contact.company ?? null,
        contactWebsite: json.contact.website ?? null,
        source: json.source,
        qualificationScore: json.qualificationScore ?? null,
        status: json.status,
        notes: json.notes ?? null,
        createdAt: json.createdAt,
        updatedAt: json.updatedAt,
      })
      .onConflictDoUpdate({
        target: schema.leads.id,
        set: {
          assignedAgentId: json.assignedAgentId ?? null,
          contactName: json.contact.name,
          contactEmail: json.contact.email ?? null,
          contactPhone: json.contact.phone ?? null,
          contactCompany: json.contact.company ?? null,
          contactWebsite: json.contact.website ?? null,
          qualificationScore: json.qualificationScore ?? null,
          status: json.status,
          notes: json.notes ?? null,
          updatedAt: json.updatedAt,
        },
      });
  }

  private toDomain(row: typeof schema.leads.$inferSelect): Lead {
    const contact: ContactInfo = {
      name: row.contactName,
      email: row.contactEmail ?? undefined,
      phone: row.contactPhone ?? undefined,
      company: row.contactCompany ?? undefined,
      website: row.contactWebsite ?? undefined,
    };

    const props: LeadProps = {
      id: row.id,
      operatorId: row.operatorId,
      assignedAgentId: row.assignedAgentId ?? undefined,
      contact,
      source: row.source as LeadSource,
      qualificationScore: row.qualificationScore ?? undefined,
      status: row.status as LeadStatus,
      notes: row.notes ?? undefined,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };

    return Lead.reconstitute(props);
  }
}
