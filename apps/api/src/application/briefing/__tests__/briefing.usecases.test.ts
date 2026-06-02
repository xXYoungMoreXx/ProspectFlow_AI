import { describe, it, expect, vi, beforeEach, type Mocked } from "vitest";
import { randomUUID } from "node:crypto";
import { StartBriefingUseCase } from "../StartBriefingUseCase.js";
import { ApproveBriefingUseCase } from "../ApproveBriefingUseCase.js";
import { GetBriefingQuery } from "../GetBriefingQuery.js";
import { DomainEventRouter } from "../../../infrastructure/queue/DomainEventRouter.js";
import type { DealRepository } from "../../../domain/deal/DealRepository.js";
import type { LeadRepository } from "../../../domain/lead/LeadRepository.js";
import type { BullMQAdapter } from "../../../infrastructure/queue/BullMQAdapter.js";
import type { Redis } from "ioredis";
import { ListBriefingsQuery } from "../ListBriefingsQuery.js";
import type { BriefingRepository } from "../../../domain/briefing/BriefingRepository.js";
import { Briefing } from "../../../domain/briefing/Briefing.js";
import type { BullMQAdapter } from "../../../infrastructure/queue/BullMQAdapter.js";
import type { Err } from "../../../domain/shared/Result.js";
import type { DomainError } from "../../../domain/shared/Result.js";

// Helper to extract error code from a Result.Err
function errCode(result: { isErr(): boolean; error?: unknown }): string {
  const e = result as Err<DomainError>;
  return e.error.code;
}

function makeBriefing(status: Briefing["status"] = "IN_PROGRESS") {
  const b = Briefing.create({
    id: randomUUID(),
    dealId: randomUUID(),
    operatorId: "op-1",
  }).unwrap();
  b.clearDomainEvents();
  if (status === "COMPLETED") {
    b.complete({ niche: "restaurant" }).unwrap();
    b.clearDomainEvents();
  }
  return b;
}

describe("StartBriefingUseCase", () => {
  let repo: Mocked<BriefingRepository>;
  let uc: StartBriefingUseCase;

  beforeEach(() => {
    repo = {
      findById: vi.fn(),
      findByDealId: vi.fn(),
      listByOperator: vi.fn(),
      save: vi.fn(),
    };
    uc = new StartBriefingUseCase(repo);
  });

  it("creates briefing with IN_PROGRESS status", async () => {
    repo.findByDealId.mockResolvedValue(null);
    repo.save.mockResolvedValue(undefined);

    const result = await uc.execute({
      dealId: randomUUID(),
      operatorId: "op-1",
      nicheTemplate: "restaurant",
      correlationId: randomUUID(),
    });

    expect(result.isOk()).toBe(true);
    expect(result.unwrap().status).toBe("IN_PROGRESS");
    expect(repo.save).toHaveBeenCalledOnce();
  });

  it("returns ConflictError when briefing already exists for deal", async () => {
    repo.findByDealId.mockResolvedValue(makeBriefing());

    const result = await uc.execute({
      dealId: randomUUID(),
      operatorId: "op-1",
      correlationId: randomUUID(),
    });

    expect(result.isErr()).toBe(true);
    expect(errCode(result)).toBe("CONFLICT");
    expect(repo.save).not.toHaveBeenCalled();
  });
});

describe("ApproveBriefingUseCase", () => {
  let repo: Mocked<BriefingRepository>;
  let queue: Mocked<BullMQAdapter>;
  let uc: ApproveBriefingUseCase;

  beforeEach(() => {
    repo = {
      findById: vi.fn(),
      findByDealId: vi.fn(),
      listByOperator: vi.fn(),
      save: vi.fn(),
    };
    queue = {
      publishEvent: vi.fn(),
      enqueueAgentTask: vi.fn(),
    } as unknown as Mocked<BullMQAdapter>;
    uc = new ApproveBriefingUseCase(repo, queue);
  });

  it("approves a COMPLETED briefing and enqueues builder task", async () => {
    const briefing = makeBriefing("COMPLETED");
    repo.findById.mockResolvedValue(briefing);
    repo.save.mockResolvedValue(undefined);
    queue.publishEvent.mockResolvedValue(undefined);
    queue.enqueueAgentTask.mockResolvedValue("job-id");

    const result = await uc.execute({
      briefingId: briefing.id,
      operatorId: "op-1",
      correlationId: randomUUID(),
    });

    expect(result.isOk()).toBe(true);
    expect(result.unwrap().status).toBe("APPROVED");
    expect(repo.save).toHaveBeenCalledOnce();
    expect(queue.publishEvent).toHaveBeenCalledOnce();
    expect(queue.enqueueAgentTask).toHaveBeenCalledWith(
      "builder.generate",
      expect.objectContaining({ briefingId: briefing.id }),
      expect.any(String),
    );
  });

  it("returns NotFoundError when briefing does not exist", async () => {
    repo.findById.mockResolvedValue(null);

    const result = await uc.execute({
      briefingId: randomUUID(),
      operatorId: "op-1",
      correlationId: randomUUID(),
    });

    expect(result.isErr()).toBe(true);
    expect(errCode(result)).toBe("NOT_FOUND");
    expect(repo.save).not.toHaveBeenCalled();
  });

  it("returns ValidationError when briefing is IN_PROGRESS (not COMPLETED)", async () => {
    const briefing = makeBriefing("IN_PROGRESS");
    repo.findById.mockResolvedValue(briefing);

    const result = await uc.execute({
      briefingId: briefing.id,
      operatorId: "op-1",
      correlationId: randomUUID(),
    });

    expect(result.isErr()).toBe(true);
    expect(repo.save).not.toHaveBeenCalled();
  });
});

describe("GetBriefingQuery", () => {
  let repo: Mocked<BriefingRepository>;
  let query: GetBriefingQuery;

  beforeEach(() => {
    repo = {
      findById: vi.fn(),
      findByDealId: vi.fn(),
      listByOperator: vi.fn(),
      save: vi.fn(),
    };
    query = new GetBriefingQuery(repo);
  });

  it("returns briefing data when found", async () => {
    const briefing = makeBriefing();
    repo.findById.mockResolvedValue(briefing);

    const result = await query.execute({ id: briefing.id, operatorId: "op-1" });

    expect(result.isOk()).toBe(true);
    expect(result.unwrap().id).toBe(briefing.id);
  });

  it("returns NotFoundError when not found", async () => {
    repo.findById.mockResolvedValue(null);

    const result = await query.execute({
      id: randomUUID(),
      operatorId: "op-1",
    });

    expect(result.isErr()).toBe(true);
    expect(errCode(result)).toBe("NOT_FOUND");
  });
});

describe("ListBriefingsQuery", () => {
  let repo: Mocked<BriefingRepository>;
  let query: ListBriefingsQuery;

  beforeEach(() => {
    repo = {
      findById: vi.fn(),
      findByDealId: vi.fn(),
      save: vi.fn(),
      listByOperator: vi.fn(),
    } as unknown as Mocked<BriefingRepository>;
    query = new ListBriefingsQuery(repo);
  });

  it("returns list of briefings for operator", async () => {
    const briefings = [makeBriefing(), makeBriefing()];
    (repo as any).listByOperator.mockResolvedValue(briefings);

    const result = await query.execute({ operatorId: "op-1", limit: 20 });

    expect(result.isOk()).toBe(true);
    expect(result.unwrap()).toHaveLength(2);
  });
});

// ── DomainEventRouter WhatsApp session tests ──────────────────────────────

describe("DomainEventRouter.handleDealClosed — Redis session", () => {
  function makeRouter(
    deal: Record<string, unknown> | null,
    lead: { id: string; phone?: string } | null,
    redisMock: Partial<Redis>,
    briefingFindByDealId: unknown = null,
  ) {
    const dealRepo = {
      findByIdInternal: vi.fn().mockResolvedValue(deal),
    } as unknown as DealRepository;

    const leadRepo = {
      findById: vi.fn().mockResolvedValue(lead),
    } as unknown as LeadRepository;

    const briefingRepoMock = {
      findByDealId: vi.fn().mockResolvedValue(briefingFindByDealId),
      save: vi.fn().mockResolvedValue(undefined),
    } as unknown as Mocked<BriefingRepository>;

    const queue = {
      createWorker: vi.fn(),
      enqueueAgentTask: vi.fn(),
    } as unknown as BullMQAdapter;

    return new DomainEventRouter(
      dealRepo,
      briefingRepoMock,
      queue,
      leadRepo,
      redisMock as Redis,
    );
  }

  const baseEvent = {
    eventType: "deal.closed",
    correlationId: "corr-1",
    payload: { dealId: "deal-1" },
  } as any;

  it("grava chave whatsapp:{phone} no Redis quando lead tem telefone", async () => {
    const redisMock = {
      set: vi.fn().mockResolvedValue("OK"),
    } as Partial<Redis>;
    const router = makeRouter(
      { id: "deal-1", operatorId: "op-1", leadId: "lead-1" },
      { id: "lead-1", phone: "+5511999990000" },
      redisMock,
    );

    await router.handleDealClosed(baseEvent);

    expect(redisMock.set).toHaveBeenCalledWith(
      "whatsapp:+5511999990000",
      expect.any(String),
      "EX",
      86400,
    );
  });

  it("não chama Redis.set quando lead não tem telefone", async () => {
    const redisMock = { set: vi.fn() } as Partial<Redis>;
    const router = makeRouter(
      { id: "deal-2", operatorId: "op-1", leadId: "lead-2" },
      { id: "lead-2", phone: undefined },
      redisMock,
    );

    await router.handleDealClosed({
      ...baseEvent,
      payload: { dealId: "deal-2" },
    });

    expect(redisMock.set).not.toHaveBeenCalled();
  });

  it("não chama Redis.set quando leadRepo não fornecido", async () => {
    const redisMock = { set: vi.fn() } as Partial<Redis>;
    const dealRepo = {
      findByIdInternal: vi
        .fn()
        .mockResolvedValue({
          id: "deal-3",
          operatorId: "op-1",
          leadId: "lead-3",
        }),
    } as unknown as DealRepository;
    const briefingRepoMock = {
      findByDealId: vi.fn().mockResolvedValue(null),
      save: vi.fn(),
    } as unknown as BriefingRepository;
    const queue = { createWorker: vi.fn() } as unknown as BullMQAdapter;

    // No leadRepo, no redis passed
    const router = new DomainEventRouter(dealRepo, briefingRepoMock, queue);
    await router.handleDealClosed({
      ...baseEvent,
      payload: { dealId: "deal-3" },
    });

    expect(redisMock.set).not.toHaveBeenCalled();
  });
});
