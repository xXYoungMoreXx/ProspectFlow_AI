import type { FastifyInstance } from "fastify";
import { authMiddleware } from "../middleware/auth.middleware.js";
import { CancelDealSchema, ListDealsQuery } from "../schemas/deals.schemas.js";
import {
  GetDealsHandler,
  GetDealByIdHandler,
  CancelDealHandler,
} from "../../application/deal/deal.handlers.js";
import { GenerateQuoteHandler } from "../../application/deal/GenerateQuoteHandler.js";
import type { DealStatus } from "@agentepro/shared-types";
import { CalComAdapter } from "../../infrastructure/integrations/CalComAdapter.js";
import type { DomainError } from "../../domain/shared/Result.js";

export async function dealRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", authMiddleware);

  // Handlers dynamically instantiated inside routes for tests

  app.get("/", async (request, reply) => {
    const parsed = ListDealsQuery.safeParse(request.query);
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
    const getListHandler = new GetDealsHandler(app.container.dealRepo);
    const result = await getListHandler.execute({
      operatorId: request.operatorId,
      organizationId: request.organizationId,
      ...parsed.data,
      status: parsed.data.status as DealStatus | undefined,
    });
    return reply.status(200).send({
      data: result.deals.map((d) => d.toJSON()),
      meta: {
        requestId: request.requestId,
        timestamp: new Date().toISOString(),
        cursor: { next: result.nextCursor, prev: null },
        total: result.total,
        limit: parsed.data.limit,
      },
    });
  });

  app.get<{ Params: { id: string } }>("/:id", async (request, reply) => {
    const getByIdHandler = new GetDealByIdHandler(app.container.dealRepo);
    const result = await getByIdHandler.execute(
      request.params.id,
      request.operatorId,
      request.organizationId,
    );
    if (result.isErr()) {
      return reply.status(404).send({
        errors: [
          {
            code: "NOT_FOUND",
            message: result.error.message,
            requestId: request.requestId,
          },
        ],
      });
    }
    return reply.status(200).send({
      data: result.value.toJSON(),
      meta: {
        requestId: request.requestId,
        timestamp: new Date().toISOString(),
      },
    });
  });

  app.post<{ Params: { id: string } }>(
    "/:id/cancel",
    async (request, reply) => {
      const parsed = CancelDealSchema.safeParse(request.body);
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
      const cancelHandler = new CancelDealHandler(app.container.dealRepo);
      const result = await cancelHandler.execute(
        request.params.id,
        request.operatorId,
        parsed.data.reason,
        request.organizationId,
      );
      if (result.isErr()) {
        const status = result.error.message.includes("not found") ? 404 : 400;
        return reply.status(status).send({
          errors: [
            {
              code: status === 404 ? "NOT_FOUND" : "VALIDATION_ERROR",
              message: result.error.message,
              requestId: request.requestId,
            },
          ],
        });
      }
      return reply.status(200).send({
        data: result.value.toJSON(),
        meta: {
          requestId: request.requestId,
          timestamp: new Date().toISOString(),
        },
      });
    },
  );

  app.post<{ Params: { id: string } }>("/:id/quote", async (request, reply) => {
    const handler = new GenerateQuoteHandler(
      app.container.dealRepo,
      app.container.leadRepo,
      app.container.llm,
    );

    // id is the leadId in this context (since quote is generated from a lead)
    const result = await handler.execute({
      leadId: request.params.id,
      operatorId: request.operatorId,
      organizationId: request.organizationId,
    });

    if (result.isErr()) {
      const status = result.error.message.includes("not found") ? 404 : 400;
      return reply.status(status).send({
        errors: [
          {
            code: status === 404 ? "NOT_FOUND" : "GENERATION_ERROR",
            message: result.error.message,
            requestId: request.requestId,
          },
        ],
      });
    }

    return reply.status(201).send({
      data: result.value.toJSON(),
      meta: {
        requestId: request.requestId,
        timestamp: new Date().toISOString(),
      },
    });
  });

  // POST /api/v1/deals/:id/schedule-meeting  (S1-06 — CalCom)
  app.post<{ Params: { id: string } }>(
    "/:id/schedule-meeting",
    async (request, reply) => {
      const deal = await app.container.dealRepo.findById(
        request.params.id,
        request.operatorId,
        request.organizationId,
      );
      if (!deal) {
        return reply.status(404).send({
          errors: [
            {
              code: "NOT_FOUND",
              message: "Deal not found",
              requestId: request.requestId,
            },
          ],
        });
      }

      const body = request.body as {
        eventTypeId?: number;
        startTime?: string;
        timeZone?: string;
        notes?: string;
      };

      if (!body.eventTypeId || !body.startTime) {
        return reply.status(400).send({
          errors: [
            {
              code: "VALIDATION_ERROR",
              message: "eventTypeId and startTime required",
              requestId: request.requestId,
            },
          ],
        });
      }

      const lead = await app.container.leadRepo.findById(
        deal.leadId,
        request.operatorId,
        request.organizationId,
      );
      if (!lead) {
        return reply.status(404).send({
          errors: [
            {
              code: "NOT_FOUND",
              message: "Lead not found",
              requestId: request.requestId,
            },
          ],
        });
      }

      try {
        const calcom = new CalComAdapter(app.container.secrets);
        const booking = await calcom.scheduleBooking({
          eventTypeId: body.eventTypeId,
          name: lead.contact.name,
          email: lead.contact.email ?? "",
          phone: lead.contact.phone,
          notes: body.notes,
          startTime: body.startTime,
          timeZone: body.timeZone,
        });

        return reply.status(201).send({
          data: booking,
          meta: {
            requestId: request.requestId,
            timestamp: new Date().toISOString(),
          },
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return reply.status(502).send({
          errors: [
            {
              code: "CALCOM_ERROR",
              message: msg,
              requestId: request.requestId,
            },
          ],
        });
      }
    },
  );

  // POST /api/v1/deals/:id/close — operator marks deal as closed, triggers briefing
  app.post<{ Params: { id: string } }>("/:id/close", async (request, reply) => {
    const deal = await app.container.dealRepo.findById(
      request.params.id,
      request.operatorId,
      request.organizationId,
    );
    if (!deal) {
      return reply.status(404).send({
        errors: [
          {
            code: "NOT_FOUND",
            message: "Deal not found",
            requestId: request.requestId,
          },
        ],
      });
    }

    const result = deal.close();
    if (result.isErr()) {
      const e = result.error as DomainError;
      return reply.status(409).send({
        errors: [
          {
            code: e.code ?? "INVALID_STATE",
            message: e.message,
            requestId: request.requestId,
          },
        ],
      });
    }

    await app.container.dealRepo.save(deal);

    const events = deal.clearDomainEvents();
    for (const event of events) {
      await app.container.queue.publishEvent(event);
    }

    return reply.status(200).send({
      data: deal.toJSON(),
      meta: {
        requestId: request.requestId,
        timestamp: new Date().toISOString(),
      },
    });
  });
}
