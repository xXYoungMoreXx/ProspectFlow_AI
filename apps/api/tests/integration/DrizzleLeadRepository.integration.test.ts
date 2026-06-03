import { describe, it, expect, beforeEach } from "vitest";
import { randomUUID } from "node:crypto";
import { DrizzleLeadRepository } from "../../src/infrastructure/db/repositories/DrizzleLeadRepository.js";
import { Lead } from "../../src/domain/lead/Lead.js";
import * as schema from "../../src/infrastructure/db/schema.js";
import { getIntegrationContext } from "./global.setup.js";

/**
 * Integration tests for DrizzleLeadRepository.
 * Requires a running PostgreSQL container via Testcontainers global setup.
 *
 * Covers:
 * - save / findById round-trip
 * - tenant isolation (multi-operator)
 * - upsert on second save (qualify, markContacted)
 * - cursor-based pagination
 * - search by contactName
 * - domain status transitions (qualify, markLost, convert)
 */
describe("DrizzleLeadRepository (integration)", () => {
  let leadRepo: DrizzleLeadRepository;
  let operatorId: string;

  /** Helper: create and save a minimal lead, returning the domain object. */
  async function createLead(
    overrides: Partial<{
      name: string;
      email: string;
      source: "MANUAL" | "SCRAPED" | "REFERRAL";
    }> = {},
  ): Promise<Lead> {
    const result = Lead.create({
      id: randomUUID(),
      operatorId,
      contact: {
        name: overrides.name ?? "Acme Corp",
        email: overrides.email,
      },
      source: overrides.source ?? "MANUAL",
    });
    if (result.isErr()) throw result.error;
    await leadRepo.save(result.unwrap());
    return result.unwrap();
  }

  beforeEach(async () => {
    const { db } = getIntegrationContext();
    leadRepo = new DrizzleLeadRepository(db);

    // Seed: unique operator per test to ensure full isolation
    operatorId = randomUUID();
    await db.insert(schema.operators).values({
      id: operatorId,
      email: `op-${operatorId}@test.com`,
      passwordHash: "argon2id-hash",
      name: "Test Operator",
    });
  });

  // ── findById ───────────────────────────────────────────────────────────────

  it("saves and retrieves a lead by id", async () => {
    const lead = await createLead({
      name: "Widgets Inc",
      email: "hello@widgets.com",
    });

    const found = await leadRepo.findById(lead.id, operatorId);

    expect(found).not.toBeNull();
    expect(found!.id).toBe(lead.id);
    expect(found!.contact.name).toBe("Widgets Inc");
    expect(found!.contact.email).toBe("hello@widgets.com");
    expect(found!.status).toBe("NEW");
    expect(found!.operatorId).toBe(operatorId);
  });

  it("returns null when lead does not exist", async () => {
    const result = await leadRepo.findById(randomUUID(), operatorId);
    expect(result).toBeNull();
  });

  // ── Tenant isolation ───────────────────────────────────────────────────────

  it("does NOT return a lead belonging to another operator", async () => {
    const { db } = getIntegrationContext();

    // Seed another operator with their own lead
    const otherOpId = randomUUID();
    await db.insert(schema.operators).values({
      id: otherOpId,
      email: `other-${otherOpId}@test.com`,
      passwordHash: "hash",
      name: "Other Op",
    });

    const otherLeadResult = Lead.create({
      id: randomUUID(),
      operatorId: otherOpId,
      contact: { name: "Other Corp" },
      source: "SCRAPED",
    });
    if (otherLeadResult.isErr()) throw otherLeadResult.error;
    const otherLead = otherLeadResult.unwrap();
    await leadRepo.save(otherLead);

    // Query as the first operator — must not see other operator's lead
    const found = await leadRepo.findById(otherLead.id, operatorId);
    expect(found).toBeNull();
  });

  // ── Upsert ────────────────────────────────────────────────────────────────

  it("updates a lead on second save (upsert — qualify)", async () => {
    const lead = await createLead();

    // Mutate domain state and re-save
    const qualifyResult = lead.qualify(87, randomUUID());
    expect(qualifyResult.isOk()).toBe(true);
    await leadRepo.save(lead);

    const found = await leadRepo.findById(lead.id, operatorId);

    expect(found!.status).toBe("QUALIFIED");
    expect(found!.qualificationScore).toBe(87);
  });

  it("updates a lead on second save (upsert — markContacted)", async () => {
    const lead = await createLead();

    lead.markContacted();
    await leadRepo.save(lead);

    const found = await leadRepo.findById(lead.id, operatorId);
    expect(found!.status).toBe("CONTACTED");
  });

  // ── findMany / pagination ─────────────────────────────────────────────────

  it("paginates leads with cursor correctly", async () => {
    // Create 5 leads sequentially
    for (let i = 0; i < 5; i++) {
      await createLead({ name: `Lead ${i}` });
    }

    // Page 1 — most recent first
    const page1 = await leadRepo.findMany({ operatorId, limit: 3 });
    expect(page1.leads).toHaveLength(3);
    expect(page1.total).toBe(5);
    expect(page1.nextCursor).not.toBeNull();

    // Page 2 via cursor
    const page2 = await leadRepo.findMany({
      operatorId,
      limit: 3,
      cursor: page1.nextCursor!,
    });
    expect(page2.leads.length).toBeGreaterThanOrEqual(1);
    expect(page2.leads.length).toBeLessThanOrEqual(3);
    expect(page2.nextCursor).toBeNull();
  });

  it("filters leads by status", async () => {
    const lead = await createLead({ name: "To Qualify" });
    lead.qualify(72, randomUUID());
    await leadRepo.save(lead);

    await createLead({ name: "Still New" });

    const newLeads = await leadRepo.findMany({ operatorId, status: "NEW" });
    const qualifiedLeads = await leadRepo.findMany({
      operatorId,
      status: "QUALIFIED",
    });

    expect(newLeads.leads.every((l) => l.status === "NEW")).toBe(true);
    expect(qualifiedLeads.leads.some((l) => l.id === lead.id)).toBe(true);
  });

  it("searches leads by contactName (case insensitive)", async () => {
    await createLead({ name: "Acme Corporation" });
    await createLead({ name: "Widgets Inc" });
    await createLead({ name: "ACME Startup" });

    const results = await leadRepo.findMany({ operatorId, search: "acme" });

    expect(results.leads).toHaveLength(2);
    expect(
      results.leads.every((l) => l.contact.name.toLowerCase().includes("acme")),
    ).toBe(true);
  });

  // ── Domain transitions ────────────────────────────────────────────────────

  it("persists LOST status after markLost()", async () => {
    const lead = await createLead();

    lead.markLost("Budget insuficiente");
    await leadRepo.save(lead);

    const found = await leadRepo.findById(lead.id, operatorId);
    expect(found!.status).toBe("LOST");
    expect(found!.notes).toBe("Budget insuficiente");
  });

  it("persists CONVERTED status after convert()", async () => {
    const lead = await createLead();

    const convertResult = lead.convert(randomUUID());
    expect(convertResult.isOk()).toBe(true);
    await leadRepo.save(lead);

    const found = await leadRepo.findById(lead.id, operatorId);
    expect(found!.status).toBe("CONVERTED");
  });
});
