import { eq, and, desc, gt, sql } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import * as schema from "../schema.js";
import {
  Project,
  type ProjectProps,
  type LighthouseScores,
} from "../../../domain/project/Project.js";
import type {
  ProjectRepository,
  ProjectFilters,
  ProjectListResult,
} from "../../../domain/project/ProjectRepository.js";
import type { ProjectStatus } from "@agentepro/shared-types";

export class DrizzleProjectRepository implements ProjectRepository {
  constructor(private readonly db: PostgresJsDatabase<typeof schema>) {}

  async findById(id: string, operatorId: string): Promise<Project | null> {
    const [row] = await this.db
      .select()
      .from(schema.projects)
      .where(
        and(
          eq(schema.projects.id, id),
          eq(schema.projects.operatorId, operatorId),
        ),
      )
      .limit(1);

    if (!row) return null;
    return this.toDomain(row);
  }

  async findMany(filters: ProjectFilters): Promise<ProjectListResult> {
    const conditions = [eq(schema.projects.operatorId, filters.operatorId)];
    if (filters.status)
      conditions.push(eq(schema.projects.status, filters.status));
    if (filters.cursor) conditions.push(gt(schema.projects.id, filters.cursor));

    const limit = filters.limit ?? 20;

    const [countResult] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.projects)
      .where(and(...conditions));

    const rows = await this.db
      .select()
      .from(schema.projects)
      .where(and(...conditions))
      .orderBy(desc(schema.projects.createdAt))
      .limit(limit + 1);

    const hasMore = rows.length > limit;
    const items = rows.slice(0, limit);

    return {
      projects: items.map((r) => this.toDomain(r)),
      total: countResult?.count ?? 0,
      nextCursor: hasMore ? items[items.length - 1]!.id : null,
    };
  }

  async save(project: Project): Promise<void> {
    const json = project.toJSON();

    await this.db
      .insert(schema.projects)
      .values({
        id: json.id,
        dealId: json.dealId,
        operatorId: json.operatorId,
        assignedAgentId: json.assignedAgentId ?? null,
        status: json.status,
        templateId: json.templateId ?? null,
        briefing: json.briefing,
        deliverableUrl: json.deliverableUrl ?? null,
        deliverableMeta: json.deliverableMeta,
        lighthousePerf: json.lighthouse.performance ?? null,
        lighthouseA11y: json.lighthouse.accessibility ?? null,
        lighthouseSeo: json.lighthouse.seo ?? null,
        lighthouseBp: json.lighthouse.bestPractices ?? null,
        revisionCount: json.revisionCount,
        revisionNotes: json.revisionNotes ?? null,
        deliveredAt: json.deliveredAt ?? null,
        createdAt: json.createdAt,
        updatedAt: json.updatedAt,
      })
      .onConflictDoUpdate({
        target: schema.projects.id,
        set: {
          assignedAgentId: json.assignedAgentId ?? null,
          status: json.status,
          templateId: json.templateId ?? null,
          briefing: json.briefing,
          deliverableUrl: json.deliverableUrl ?? null,
          deliverableMeta: json.deliverableMeta,
          lighthousePerf: json.lighthouse.performance ?? null,
          lighthouseA11y: json.lighthouse.accessibility ?? null,
          lighthouseSeo: json.lighthouse.seo ?? null,
          lighthouseBp: json.lighthouse.bestPractices ?? null,
          revisionCount: json.revisionCount,
          revisionNotes: json.revisionNotes ?? null,
          deliveredAt: json.deliveredAt ?? null,
          updatedAt: json.updatedAt,
        },
      });
  }

  private toDomain(row: typeof schema.projects.$inferSelect): Project {
    const lighthouse: LighthouseScores = {
      performance: row.lighthousePerf ?? undefined,
      accessibility: row.lighthouseA11y ?? undefined,
      seo: row.lighthouseSeo ?? undefined,
      bestPractices: row.lighthouseBp ?? undefined,
    };

    const props: ProjectProps = {
      id: row.id,
      dealId: row.dealId,
      operatorId: row.operatorId,
      assignedAgentId: row.assignedAgentId ?? undefined,
      status: row.status as ProjectStatus,
      templateId: row.templateId ?? undefined,
      briefing: (row.briefing ?? {}) as Record<string, unknown>,
      deliverableUrl: row.deliverableUrl ?? undefined,
      deliverableMeta: (row.deliverableMeta ?? {}) as Record<string, unknown>,
      lighthouse,
      revisionCount: row.revisionCount,
      revisionNotes: row.revisionNotes ?? undefined,
      deliveredAt: row.deliveredAt ?? undefined,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };

    return Project.reconstitute(props);
  }
}
