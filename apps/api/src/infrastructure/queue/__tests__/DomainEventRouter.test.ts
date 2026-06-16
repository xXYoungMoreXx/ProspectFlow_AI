import { describe, it, expect, vi, beforeEach, type Mocked } from "vitest";
import { randomUUID } from "node:crypto";
import { DomainEventRouter } from "../DomainEventRouter.js";
import type { DealRepository } from "../../../domain/deal/DealRepository.js";
import type { BriefingRepository } from "../../../domain/briefing/BriefingRepository.js";
import { Deal } from "../../../domain/deal/Deal.js";
import { createDomainEvent } from "../../../domain/shared/DomainEvent.js";
import type { BullMQAdapter } from "../BullMQAdapter.js";

function makeDeal(operatorId = "op-1") {
  return Deal.reconstitute({
    id: randomUUID(),
    leadId: randomUUID(),
    operatorId,
    agentId: randomUUID(),
    status: "CLOSED",
    serviceType: "SITE_CREATION",
    briefing: {},
    basePriceCents: 150000,
    discountPct: 0,
    addons: [],
    currency: "BRL",
    closedAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

describe("DomainEventRouter — deal.closed", () => {
  let dealRepo: Mocked<DealRepository>;
  let briefingRepo: Mocked<BriefingRepository>;
  let queue: Mocked<Pick<BullMQAdapter, "publishEvent" | "enqueueAgentTask">>;
  let router: DomainEventRouter;

  beforeEach(() => {
    dealRepo = {
      findById: vi.fn(),
      findByIdInternal: vi.fn(),
      findMany: vi.fn(),
      save: vi.fn(),
    } as unknown as Mocked<DealRepository>;

    briefingRepo = {
      findById: vi.fn(),
      findByDealId: vi.fn(),
      listByOperator: vi.fn(),
      save: vi.fn(),
    };

    queue = {
      publishEvent: vi.fn(),
      enqueueAgentTask: vi.fn().mockResolvedValue("job-id"),
    };

    router = new DomainEventRouter(
      dealRepo,
      briefingRepo,
      queue as unknown as BullMQAdapter,
    );
  });

  it("starts a briefing when deal.closed event received", async () => {
    const deal = makeDeal("op-1");
    dealRepo.findByIdInternal.mockResolvedValue(deal);
    briefingRepo.findByDealId.mockResolvedValue(null);
    briefingRepo.save.mockResolvedValue(undefined);

    const event = createDomainEvent("deal.closed", "Deal", deal.id, {
      dealId: deal.id,
      leadId: deal.leadId,
      totalCents: 150000,
      serviceType: "SITE_CREATION",
    });

    await router.handleDealClosed(event);

    expect(briefingRepo.findByDealId).toHaveBeenCalledWith(
      deal.id,
      "op-1",
      "org_mvp",
    );
    expect(briefingRepo.save).toHaveBeenCalledOnce();
  });

  it("skips briefing creation when briefing already exists", async () => {
    const deal = makeDeal("op-1");
    dealRepo.findByIdInternal.mockResolvedValue(deal);

    const existingBriefing = { id: "existing", dealId: deal.id } as any;
    briefingRepo.findByDealId.mockResolvedValue(existingBriefing);

    const event = createDomainEvent("deal.closed", "Deal", deal.id, {
      dealId: deal.id,
      leadId: deal.leadId,
      totalCents: 150000,
      serviceType: "SITE_CREATION",
    });

    await router.handleDealClosed(event);

    expect(briefingRepo.save).not.toHaveBeenCalled();
  });

  it("skips when deal not found (deleted or wrong tenant)", async () => {
    dealRepo.findById.mockResolvedValue(null);

    const event = createDomainEvent("deal.closed", "Deal", "no-such-deal", {
      dealId: "no-such-deal",
      leadId: randomUUID(),
      totalCents: 0,
      serviceType: "SITE_CREATION",
    });

    await router.handleDealClosed(event);

    expect(briefingRepo.save).not.toHaveBeenCalled();
  });
});
