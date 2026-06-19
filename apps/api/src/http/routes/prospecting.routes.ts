import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { authMiddleware } from "../middleware/auth.middleware.js";
import { eq, and, desc } from "drizzle-orm";
import * as schema from "../../infrastructure/db/schema.js";
import type { ServiceType } from "@hefesto/shared-types";

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
  serviceType: z
    .enum([
      "SITE_CREATION",
      "TRAFFIC_MANAGEMENT",
      "SOCIAL_MEDIA",
      "FULL_DIGITAL",
    ])
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
  service_type: "prospecting.service_type",
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

    // Read persisted serviceType so the Python runtime scores correctly
    const serviceTypeRaw = await getConfigValue(
      app.container.db,
      request.operatorId,
      CONFIG_KEYS.service_type,
    );
    const serviceType = (serviceTypeRaw ?? "FULL_DIGITAL") as ServiceType;

    const jobId = await app.container.queue.enqueueAgentTask(
      "hunter.search",
      {
        operatorId: request.operatorId,
        categories: parsed.data.categories,
        region: parsed.data.region,
        minScore: parsed.data.minScore,
        limit: parsed.data.limit,
        serviceType,
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

  // GET /api/v1/prospecting/search-maps-preview
  // Synchronous Google Places search — returns raw place data for preview before queuing
  app.get("/search-maps-preview", async (request, reply) => {
    const {
      categories: categoriesRaw,
      city,
      state,
      radiusKm: radiusKmRaw,
    } = request.query as Record<string, string>;

    if (!categoriesRaw || !city || !state) {
      return reply.status(400).send({
        errors: [
          {
            code: "VALIDATION_ERROR",
            message: "categories, city e state são obrigatórios",
            requestId: request.requestId,
          },
        ],
      });
    }

    const categories = categoriesRaw
      .split(",")
      .map((c: string) => c.trim())
      .filter(Boolean);
    const radiusKm = Math.min(
      100,
      Math.max(1, parseInt(radiusKmRaw ?? "20", 10)),
    );

    const apiKey = await getConfigValue(
      app.container.db,
      request.operatorId,
      "integrations.google.maps_api_key",
    );

    if (!apiKey) {
      return reply.status(400).send({
        errors: [
          {
            code: "MISSING_CONFIG",
            message:
              "Google Maps API Key não configurada. Configure em Configurações → Integrações → Google Maps.",
            requestId: request.requestId,
          },
        ],
      });
    }

    // Geocode city/state to lat/lng
    const geocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(`${city}, ${state}, Brazil`)}&key=${apiKey}`;
    const geocodeRes = await fetch(geocodeUrl, {
      signal: AbortSignal.timeout(8_000),
    });
    if (!geocodeRes.ok) {
      return reply.status(502).send({
        errors: [
          {
            code: "EXTERNAL_SERVICE_ERROR",
            message: "Falha ao geocodificar a cidade via Google Geocoding API.",
            requestId: request.requestId,
          },
        ],
      });
    }
    const geocodeData = (await geocodeRes.json()) as {
      status: string;
      results: Array<{
        geometry: { location: { lat: number; lng: number } };
      }>;
    };
    if (geocodeData.status !== "OK" || !geocodeData.results[0]) {
      return reply.status(404).send({
        errors: [
          {
            code: "NOT_FOUND",
            message: `Cidade "${city}, ${state}" não encontrada no Google Maps.`,
            requestId: request.requestId,
          },
        ],
      });
    }
    const { lat, lng } = geocodeData.results[0].geometry.location;

    const FIELD_MASK = [
      "places.id",
      "places.displayName",
      "places.formattedAddress",
      "places.nationalPhoneNumber",
      "places.websiteUri",
      "places.rating",
      "places.userRatingCount",
      "places.types",
      "places.googleMapsUri",
    ].join(",");

    const allPlaces: Array<{
      placeId: string;
      name: string;
      address: string;
      phone: string | null;
      website: string | null;
      rating: number | null;
      reviewsCount: number | null;
      types: string[];
      mapsUrl: string;
    }> = [];

    const seen = new Set<string>();

    for (const category of categories.slice(0, 5)) {
      const searchRes = await fetch(
        "https://places.googleapis.com/v1/places:searchNearby",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Goog-Api-Key": apiKey,
            "X-Goog-FieldMask": FIELD_MASK,
            "Accept-Language": "pt-BR",
          },
          body: JSON.stringify({
            includedTypes: [category.toLowerCase().replace(/\s+/g, "_")],
            locationRestriction: {
              circle: {
                center: { latitude: lat, longitude: lng },
                radius: radiusKm * 1000,
              },
            },
            maxResultCount: 20,
            languageCode: "pt-BR",
          }),
          signal: AbortSignal.timeout(10_000),
        },
      );

      if (!searchRes.ok) continue;

      const searchData = (await searchRes.json()) as {
        places?: Array<{
          id: string;
          displayName?: { text?: string };
          formattedAddress?: string;
          nationalPhoneNumber?: string;
          websiteUri?: string;
          rating?: number;
          userRatingCount?: number;
          types?: string[];
          googleMapsUri?: string;
        }>;
      };

      for (const p of searchData.places ?? []) {
        if (!p.id || seen.has(p.id)) continue;
        seen.add(p.id);
        allPlaces.push({
          placeId: p.id,
          name: p.displayName?.text ?? "",
          address: p.formattedAddress ?? "",
          phone: p.nationalPhoneNumber ?? null,
          website: p.websiteUri ?? null,
          rating: p.rating ?? null,
          reviewsCount: p.userRatingCount ?? null,
          types: p.types ?? [],
          mapsUrl:
            p.googleMapsUri ??
            `https://maps.google.com/?q=${encodeURIComponent(p.displayName?.text ?? "")}`,
        });
      }
    }

    return reply.status(200).send({
      data: { places: allPlaces },
      meta: {
        total: allPlaces.length,
        city,
        state,
        radiusKm,
        requestId: request.requestId,
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

    const leads = (rows as LeadRow[]).map((row) => {
      const cd = (row.companyData ?? {}) as Record<string, unknown>;
      return {
        id: row.id,
        contactName: row.contactName
          ? `${row.contactName.slice(0, 3)}***`
          : "***",
        contactPhone: maskPhone(row.contactPhone),
        contactEmail: maskEmail(row.contactEmail),
        businessName: row.contactCompany ?? "—",
        qualificationScore: row.qualificationScore,
        source: row.source,
        serviceType: (cd["serviceType"] as ServiceType | undefined) ?? null,
        companyData: row.companyData,
        // ── Extended Google Places enrichment (SPEC-03 v2.1) ─────────────────
        businessStatus: (cd["businessStatus"] as string | undefined) ?? null,
        priceLevel: (cd["priceLevel"] as string | undefined) ?? null,
        editorialSummary:
          (cd["editorialSummary"] as string | undefined) ?? null,
        categories: (cd["categories"] as string[] | undefined) ?? [],
        openingHoursText:
          (cd["openingHoursText"] as string[] | undefined) ?? [],
        photoUris: (cd["photoUris"] as string[] | undefined) ?? [],
        googleMapsUri: (cd["googleMapsUri"] as string | undefined) ?? null,
        pendingHitl: pendingHitlIds.has(row.id),
        createdAt: row.createdAt.toISOString(),
      };
    });

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
      serviceTypeRaw,
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
      getConfigValue(db, opId, CONFIG_KEYS.service_type),
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
        serviceType: (serviceTypeRaw ?? "SITE_CREATION") as ServiceType,
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
    if (parsed.data.serviceType !== undefined) {
      updates.push(
        upsertConfigValue(
          db,
          opId,
          CONFIG_KEYS.service_type,
          parsed.data.serviceType,
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
