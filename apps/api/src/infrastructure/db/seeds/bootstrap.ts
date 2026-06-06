import { eq } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import type { FastifyBaseLogger } from "fastify";
import * as schema from "../schema.js";

export async function bootstrapOrganization(
  db: PostgresJsDatabase<typeof schema>,
  log: FastifyBaseLogger,
): Promise<void> {
  const orgId   = process.env["BOOTSTRAP_ORG_ID"]   ?? "org_mvp";
  const orgName = process.env["BOOTSTRAP_ORG_NAME"] ?? "AgentePro";
  const orgSlug = process.env["BOOTSTRAP_ORG_SLUG"] ?? "agentepro";

  const existing = await db
    .select({ id: schema.organizations.id })
    .from(schema.organizations)
    .where(eq(schema.organizations.id, orgId))
    .limit(1);

  if (existing.length > 0) return;

  await db.insert(schema.organizations).values({
    id:        orgId,
    name:      orgName,
    slug:      orgSlug,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  log.info({ orgId, orgName }, "bootstrap_org_created");
}
