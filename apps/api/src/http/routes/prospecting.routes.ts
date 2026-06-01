import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { authMiddleware } from "../middleware/auth.middleware.js";
import { eq, and, desc } from "drizzle-orm";
import * as schema from "../../infrastructure/db/schema.js";

type LeadRow = typeof schema.leads.$inferSelect;

// ─── Schemas ────────────────────────────────────────────────────────────────

const SearchMapsSchema = z.object({
  categories: z.array(z.string().min(1)).min(1).max(10),
  region: z.object({
    city: z.string().min(1),
    state: z.string().length(2),
    radiusKm: z.number().int().min(1).max(100),
  }),
  minScore: z.number().int().min(0).max(100).optional().default(40),
  limit: z.number().int().min(1).max(200).optional().default(50),
});

const UpdateConfigSchema = z.object({
  categories: z.array(z.string().min(1)).min(1).max(10).optional(),
  region: z
    .object({
      city: z.string().min(1).optional(),
      state: z.string().length(2).optional(),
      radiusKm: z.number().int().min(1).max(100).optional(),
    })
    .optional(),
  minScore: z.number().int().min(0).max(100).optional(),
  scheduleTime: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .optional(),
  scheduleDays: z
    .array(z.enum(["mon", "tue", "wed", "thu", "fri", "sat", "sun"]))
    .optional(),
});

// ─── Config key helpers ──────────────────────────────────────────────────────

const CONFIG_KEYS = {
  categories: "prospecting.categories",
  region_city: "prospecting.region.city",
  region_state: "prospecting.region.state",
  region_radius_km: "prospecting.region.radius_km",
  min_score: "prospecting.min_score",
  schedule_time: "prospecting.schedule_time",
  schedule_days: "prospecting.schedule_days",
  last_run_at: "prospecting.last_run_at",
  next_run_at: "prospecting.next_run_at",
  maps_quota_remaining: "prospecting.maps_quota_remaining",
  maps_quota_limit: "prospecting.maps_quota_limit",
} as const;

async function getConfigValue(
  db: FastifyInstance["container"]["db"],
  operatorId: string,
  key: string,
): Promise<string | null> {
  const [row] = await db
    .select({ value: schema.systemSettings.value })
    .from(schema.systemSettings)
    .where(
      and(
        eq(schema.systemSettings.operatorId, operatorId),
        eq(schema.systemSettings.key, key),
      ),
    )
    .limit(1);
  return row?.value ?? null;
}

async function upsertConfigValue(
  db: FastifyInstance["container"]["db"],
  operatorId: string,
  key: string,
  value: string,
): Promise<void> {
  await db
    .insert(schema.systemSettings)
    .values({
      operatorId,
      key,
      value,
      category: "integrations",
      isSecret: false,
    })
    .onConflictDoUpdate({
      target: [schema.systemSettings.operatorId, schema.systemSettings.key],
      set: { value, updatedAt: new Date() },
    });
}

// ─── PII masking ─────────────────────────────────────────────────────────────

function maskPhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  return phone.replace(/(\+?\d{2,3})(\d+)(\d{4})$/, "$1***$3");
}

function maskEmail(email: string | null | undefined): string | null {
  if (!email) return null;
  const [local, domain] = email.split("@");
  if (!local || !domain) return null;
  return `${local.slice(0, 3)}***@${domain}`;
}

// ─── Routes ──────────────────────────────────────────────────────────────────

export async function prospectingRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", authMiddleware);

  // POST /api/v1/prospecting/search-maps
  // Enqueues an async Hunter job and returns 202 with jobId
  app.post("/search-maps", async (request, reply) => {
    const parsed = SearchMapsSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        errors: parsed.error.issues.map((i) => ({
          code: "VALIDATION_ERROR",
          message: i.message,
          field: i.path.join("."),
          requestId: request.requestId,
        })),
      });
    }

    const correlationId = request.requestId;
    const jobId = await app.container.queue.enqueueAgentTask(
      "hunter.search",
      {
        operatorId: request.operatorId,
        categories: parsed.data.categories,
        region: parsed.data.region,
        minScore: parsed.data.minScore,
        limit: parsed.data.limit,
      },
      correlationId,
    );

    return reply.status(202).send({
      data: {
        jobId,
        estimatedDurationSeconds: 60,
        message:
          "Prospecção enfileirada. Leads aparecerão em /prospecting/queue.",
      },
    });
  });

  // GET /api/v1/prospecting/queue
  // Returns leads with PROSPECTED status, PII masked
  app.get("/queue", async (request, reply) => {
    const rows = await app.container.db
      .select()
      .from(schema.leads)
      .where(
        and(
          eq(schema.leads.operatorId, request.operatorId),
          eq(schema.leads.status, "PROSPECTED"),
        ),
      )
      .orderBy(desc(schema.leads.createdAt))
      .limit(100);

    const hitlRows = await app.container.db
      .select({ contextId: schema.hitlApprovals.contextId })
      .from(schema.hitlApprovals)
      .where(
        and(
          eq(schema.hitlApprovals.operatorId, request.operatorId),
          eq(schema.hitlApprovals.status, "PENDING"),
          eq(schema.hitlApprovals.contextType, "LEAD"),
        ),
      );
    const pendingHitlIds = new Set(
      hitlRows.map((r: { contextId: string }) => r.contextId),
    );

    const leads = (rows as LeadRow[]).map((row) => ({
      id: row.id,
      contactName: row.contactName
        ? `${row.contactName.slice(0, 3)}***`
        : "***",
      contactPhone: maskPhone(row.contactPhone),
      contactEmail: maskEmail(row.contactEmail),
      businessName: row.contactCompany ?? "—",
      qualificationScore: row.qualificationScore,
      source: row.source,
      companyData: row.companyData,
      pendingHitl: pendingHitlIds.has(row.id),
      createdAt: row.createdAt.toISOString(),
    }));

    return reply.status(200).send({
      data: { leads },
      meta: {
        total: leads.length,
        pendingHitl: leads.filter(
          (l: { pendingHitl: boolean }) => l.pendingHitl,
        ).length,
        requestId: request.requestId,
        timestamp: new Date().toISOString(),
      },
    });
  });

  // GET /api/v1/prospecting/config
  app.get("/config", async (request, reply) => {
    const db = app.container.db;
    const opId = request.operatorId;

    const [
      categoriesRaw,
      city,
      state,
      radiusKmRaw,
      minScoreRaw,
      scheduleTime,
      scheduleDaysRaw,
      lastRunAt,
      nextRunAt,
      mapsQuotaRemainingRaw,
      mapsQuotaLimitRaw,
    ] = await Promise.all([
      getConfigValue(db, opId, CONFIG_KEYS.categories),
      getConfigValue(db, opId, CONFIG_KEYS.region_city),
      getConfigValue(db, opId, CONFIG_KEYS.region_state),
      getConfigValue(db, opId, CONFIG_KEYS.region_radius_km),
      getConfigValue(db, opId, CONFIG_KEYS.min_score),
      getConfigValue(db, opId, CONFIG_KEYS.schedule_time),
      getConfigValue(db, opId, CONFIG_KEYS.schedule_days),
      getConfigValue(db, opId, CONFIG_KEYS.last_run_at),
      getConfigValue(db, opId, CONFIG_KEYS.next_run_at),
      getConfigValue(db, opId, CONFIG_KEYS.maps_quota_remaining),
      getConfigValue(db, opId, CONFIG_KEYS.maps_quota_limit),
    ]);

    return reply.status(200).send({
      data: {
        categories: categoriesRaw
          ? (JSON.parse(categoriesRaw) as string[])
          : [],
        region: {
          city: city ?? "",
          state: state ?? "",
          radiusKm: radiusKmRaw ? parseInt(radiusKmRaw, 10) : 10,
        },
        minScore: minScoreRaw ? parseInt(minScoreRaw, 10) : 40,
        scheduleTime: scheduleTime ?? "09:00",
        scheduleDays: scheduleDaysRaw
          ? (JSON.parse(scheduleDaysRaw) as string[])
          : ["mon", "tue", "wed", "thu", "fri"],
        mapsQuotaRemaining: mapsQuotaRemainingRaw
          ? parseInt(mapsQuotaRemainingRaw, 10)
          : null,
        mapsQuotaLimit: mapsQuotaLimitRaw
          ? parseInt(mapsQuotaLimitRaw, 10)
          : null,
        lastRunAt: lastRunAt ?? null,
        nextRunAt: nextRunAt ?? null,
      },
    });
  });

  // PATCH /api/v1/prospecting/config
  app.patch("/config", async (request, reply) => {
    const parsed = UpdateConfigSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        errors: parsed.error.issues.map((i) => ({
          code: "VALIDATION_ERROR",
          message: i.message,
          field: i.path.join("."),
          requestId: request.requestId,
        })),
      });
    }

    const db = app.container.db;
    const opId = request.operatorId;
    const updates: Promise<void>[] = [];

    if (parsed.data.categories) {
      updates.push(
        upsertConfigValue(
          db,
          opId,
          CONFIG_KEYS.categories,
          JSON.stringify(parsed.data.categories),
        ),
      );
    }
    if (parsed.data.region?.city) {
      updates.push(
        upsertConfigValue(
          db,
          opId,
          CONFIG_KEYS.region_city,
          parsed.data.region.city,
        ),
      );
    }
    if (parsed.data.region?.state) {
      updates.push(
        upsertConfigValue(
          db,
          opId,
          CONFIG_KEYS.region_state,
          parsed.data.region.state,
        ),
      );
    }
    if (parsed.data.region?.radiusKm !== undefined) {
      updates.push(
        upsertConfigValue(
          db,
          opId,
          CONFIG_KEYS.region_radius_km,
          String(parsed.data.region.radiusKm),
        ),
      );
    }
    if (parsed.data.minScore !== undefined) {
      updates.push(
        upsertConfigValue(
          db,
          opId,
          CONFIG_KEYS.min_score,
          String(parsed.data.minScore),
        ),
      );
    }
    if (parsed.data.scheduleTime) {
      updates.push(
        upsertConfigValue(
          db,
          opId,
          CONFIG_KEYS.schedule_time,
          parsed.data.scheduleTime,
        ),
      );
    }
    if (parsed.data.scheduleDays) {
      updates.push(
        upsertConfigValue(
          db,
          opId,
          CONFIG_KEYS.schedule_days,
          JSON.stringify(parsed.data.scheduleDays),
        ),
      );
    }

    await Promise.all(updates);

    return reply.status(200).send({
      data: { updated: true },
      meta: { requestId: request.requestId },
    });
  });
}
