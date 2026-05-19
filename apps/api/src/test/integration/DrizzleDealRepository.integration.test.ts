import { describe, it, expect, beforeEach } from "vitest";
import { randomUUID } from "node:crypto";
import { DrizzleDealRepository } from "../../infrastructure/db/repositories/DrizzleDealRepository.js";
import { Deal } from "../../domain/deal/Deal.js";
import * as schema from "../../infrastructure/db/schema.js";
import { getIntegrationContext } from "./global.setup.js";

/**
 * Integration tests for DrizzleDealRepository.
 * Requires a running PostgreSQL container via Testcontainers global setup.
 *
 * Covers:
 * - save / findById round-trip
 * - tenant isolation (multi-operator)
 * - upsert on second save
 * - cursor-based pagination
 * - domain state transitions (cancel)
 */
describe("DrizzleDealRepository (integration)", () => {
  let dealRepo: DrizzleDealRepository;
  let operatorId: string;
  let leadId: string;

  /** Helper: create and save a minimal deal, returning the domain object. */
  async function createDeal(overrides: Partial<{ basePriceCents: number }> = {}): Promise<Deal> {
    const result = Deal.create({
      id: randomUUID(),
      leadId,
      operatorId,
      serviceType: "WEBSITE",
      briefing: {},
      basePriceCents: overrides.basePriceCents ?? 100_000,
    });
    if (result.isErr()) throw result.error;
    await dealRepo.save(result.unwrap());
    return result.unwrap();
  }

  beforeEach(async () => {
    const { db } = getIntegrationContext();
    dealRepo = new DrizzleDealRepository(db);

    // Seed: unique operator per test
    operatorId = randomUUID();
    await db.insert(schema.operators).values({
      id: operatorId,
      email: `op-${operatorId}@test.com`,
      passwordHash: "argon2id-hash",
      name: "Test Operator",
    });

    // Seed: lead owned by that operator
    leadId = randomUUID();
    await db.insert(schema.leads).values({
      id: leadId,
      operatorId,
      contactName: "Acme Corp",
      source: "MANUAL",
      status: "NEW",
    });
  });

  // ── findById ───────────────────────────────────────────────────────────────

  it("saves and retrieves a deal by id", async () => {
    const deal = await createDeal({ basePriceCents: 150_000 });

    const found = await dealRepo.findById(deal.id, operatorId);

    expect(found).not.toBeNull();
    expect(found!.id).toBe(deal.id);
    expect(found!.basePriceCents).toBe(150_000);
    expect(found!.status).toBe("PROPOSED");
    expect(found!.leadId).toBe(leadId);
    expect(found!.operatorId).toBe(operatorId);
  });

  it("returns null when deal does not exist", async () => {
    const result = await dealRepo.findById(randomUUID(), operatorId);
    expect(result).toBeNull();
  });

  // ── Tenant isolation ───────────────────────────────────────────────────────

  it("does NOT return a deal belonging to another operator", async () => {
    const { db } = getIntegrationContext();

    // Seed another operator with their own lead + deal
    const otherOpId = randomUUID();
    const otherLeadId = randomUUID();
    await db.insert(schema.operators).values({
      id: otherOpId,
      email: `other-${otherOpId}@test.com`,
      passwordHash: "hash",
      name: "Other Op",
    });
    await db.insert(schema.leads).values({
      id: otherLeadId,
      operatorId: otherOpId,
      contactName: "Other Corp",
      source: "MANUAL",
      status: "NEW",
    });
    const otherDealResult = Deal.create({
      id: randomUUID(),
      leadId: otherLeadId,
      operatorId: otherOpId,
      serviceType: "WEBSITE",
      briefing: {},
      basePriceCents: 50_000,
    });
    if (otherDealResult.isErr()) throw otherDealResult.error;
    const otherDeal = otherDealResult.unwrap();
    await dealRepo.save(otherDeal);

    // Query as the first operator — must not see other operator's deal
    const found = await dealRepo.findById(otherDeal.id, operatorId);
    expect(found).toBeNull();
  });

  // ── Upsert ────────────────────────────────────────────────────────────────

  it("updates a deal on second save (upsert)", async () => {
    const deal = await createDeal();

    // Mutate and re-save
    deal.addAddon({ name: "Logo Design", priceCents: 25_000 });
    deal.setProposal("Proposta revisada v2");
    await dealRepo.save(deal);

    const found = await dealRepo.findById(deal.id, operatorId);

    expect(found!.addons).toHaveLength(1);
    expect(found!.addons[0]!.name).toBe("Logo Design");
    expect(found!.proposalText).toBe("Proposta revisada v2");
    expect(found!.totalCents).toBe(125_000); // 100k base + 25k addon
  });

  // ── findMany / pagination ─────────────────────────────────────────────────

  it("paginates deals with cursor correctly", async () => {
    // Create 5 deals sequentially so IDs are sortable
    for (let i = 0; i < 5; i++) {
      await createDeal({ basePriceCents: 10_000 * (i + 1) });
    }

    // Page 1
    const page1 = await dealRepo.findMany({ operatorId, limit: 3 });
    expect(page1.deals).toHaveLength(3);
    expect(page1.total).toBe(5);
    expect(page1.nextCursor).not.toBeNull();

    // Page 2 via cursor
    const page2 = await dealRepo.findMany({
      operatorId,
      limit: 3,
      cursor: page1.nextCursor!,
    });
    expect(page2.deals.length).toBeGreaterThanOrEqual(1);
    expect(page2.deals.length).toBeLessThanOrEqual(3);
    expect(page2.nextCursor).toBeNull();
  });

  it("filters deals by status", async () => {
    const deal = await createDeal();
    deal.cancel("Teste de filtro");
    await dealRepo.save(deal);

    const proposed = await dealRepo.findMany({ operatorId, status: "PROPOSED" });
    const cancelled = await dealRepo.findMany({ operatorId, status: "CANCELLED" });

    expect(proposed.deals.every((d) => d.status === "PROPOSED")).toBe(true);
    expect(cancelled.deals.some((d) => d.id === deal.id)).toBe(true);
  });

  // ── Domain transitions ────────────────────────────────────────────────────

  it("persists CANCELLED status after domain cancel()", async () => {
    const deal = await createDeal();

    const cancelResult = deal.cancel("Cliente desistiu");
    expect(cancelResult.isOk()).toBe(true);
    await dealRepo.save(deal);

    const found = await dealRepo.findById(deal.id, operatorId);
    expect(found!.status).toBe("CANCELLED");
  });
});
