import type { FastifyInstance } from "fastify";
import { authMiddleware } from "../middleware/auth.middleware.js";
import { eq, and, gte, sum, count } from "drizzle-orm";
import * as schema from "../../infrastructure/db/schema.js";

function periodStart(period: string): Date {
  const now = new Date();
  switch (period) {
    case "day":
      return new Date(now.setHours(0, 0, 0, 0));
    case "week":
      return new Date(now.setDate(now.getDate() - 7));
    case "month":
      return new Date(now.setMonth(now.getMonth() - 1));
    default:
      return new Date(0); // all time
  }
}

/**
 * GET /api/v1/costs/dashboard?period=day|week|month
 * S2-09 — token usage + cost summary per agent.
 */
export async function costsRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", authMiddleware);

  app.get<{ Querystring: { period?: string } }>(
    "/dashboard",
    async (request, reply) => {
      const period = request.query.period ?? "month";
      const since = periodStart(period);

      const rows = await app.container.db
        .select({
          agentId: schema.tokenUsage.agentId,
          provider: schema.tokenUsage.provider,
          totalTokens: sum(schema.tokenUsage.totalTokens).mapWith(Number),
          costUsd: sum(schema.tokenUsage.costUsd).mapWith(Number),
          requests: count(schema.tokenUsage.id),
        })
        .from(schema.tokenUsage)
        .where(
          and(
            eq(schema.tokenUsage.operatorId, request.operatorId),
            gte(schema.tokenUsage.createdAt, since),
          ),
        )
        .groupBy(schema.tokenUsage.agentId, schema.tokenUsage.provider);

      type Row = (typeof rows)[number];
      const totalCost = rows.reduce(
        (acc: number, r: Row) => acc + (r.costUsd ?? 0),
        0,
      );
      const totalTokens = rows.reduce(
        (acc: number, r: Row) => acc + (r.totalTokens ?? 0),
        0,
      );

      return reply.status(200).send({
        data: {
          period,
          since: since.toISOString(),
          totalCostUsd: Number(totalCost.toFixed(6)),
          totalTokens,
          byAgent: rows,
        },
        meta: {
          requestId: request.requestId,
          timestamp: new Date().toISOString(),
        },
      });
    },
  );
}
