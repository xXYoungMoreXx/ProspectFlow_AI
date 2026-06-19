import { eq } from "drizzle-orm";
import { skillCatalog, agentSkills } from "../../infrastructure/db/schema.js";
import { NotFoundError } from "../../domain/shared/Result.js";
import type { ServiceType } from "@hefesto/shared-types";

type Db = any;

interface CatalogQuery {
  serviceType?: ServiceType;
  persona?: string;
  limit?: number;
}

export class GetSkillCatalogHandler {
  constructor(private readonly database: Db) {}

  async execute(query: CatalogQuery) {
    const q = this.database.select().from(skillCatalog);

    if (query.serviceType) {
      // Filter by serviceTypes array containing the requested service type
      // Using SQL array contains operator via Drizzle
      const rows: unknown[] = await q.execute();
      const filtered = (rows as Array<Record<string, unknown>>).filter(
        (row) => {
          const serviceTypes = row["serviceTypes"];
          return (
            Array.isArray(serviceTypes) &&
            (serviceTypes as string[]).includes(query.serviceType!)
          );
        },
      );
      const limited = filtered.slice(0, query.limit ?? 50);
      return { data: limited, meta: { total: limited.length } };
    }

    if (query.persona) {
      // Filter by personaHints array containing the requested persona
      const rows: unknown[] = await q.execute();
      const filtered = (rows as Array<Record<string, unknown>>).filter(
        (row) => {
          const personaHints = row["personaHints"];
          return (
            Array.isArray(personaHints) &&
            (personaHints as string[]).includes(query.persona!)
          );
        },
      );
      const limited = filtered.slice(0, query.limit ?? 50);
      return { data: limited, meta: { total: limited.length } };
    }

    const rows: unknown[] = await q.limit(query.limit ?? 50).execute();
    return { data: rows, meta: { total: rows.length } };
  }
}

export class AddSkillFromCatalogHandler {
  constructor(private readonly database: Db) {}

  async execute(cmd: {
    agentId: string;
    catalogSkillId: string;
    operatorId: string;
    subAgentId?: string;
  }) {
    // Find the skill in catalog
    const [catalog] = (await this.database
      .select()
      .from(skillCatalog)
      .where(eq(skillCatalog.id, cmd.catalogSkillId))
      .limit(1)
      .execute()) as Array<Record<string, unknown>>;

    if (!catalog) throw new NotFoundError("SkillCatalog", cmd.catalogSkillId);

    // Insert into agentSkills with config merged from template
    const [newSkill] = (await this.database
      .insert(agentSkills)
      .values({
        agentId: cmd.agentId,
        name: catalog["name"] as string,
        skillType: catalog["skillType"] as string,
        config: {
          ...(catalog["configTemplate"] as Record<string, unknown>),
          catalogId: cmd.catalogSkillId,
        },
        isEnabled: true,
      })
      .returning()
      .execute()) as Array<Record<string, unknown>>;

    return { data: newSkill };
  }
}
