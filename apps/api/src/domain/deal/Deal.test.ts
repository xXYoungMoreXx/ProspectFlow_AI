import { describe, it, expect } from "vitest";
import { Deal } from "./Deal.js";
import { randomUUID } from "node:crypto";

function makeDeal(overrides: Partial<Parameters<typeof Deal.create>[0]> = {}) {
  return Deal.create({
    id: randomUUID(),
    leadId: randomUUID(),
    operatorId: randomUUID(),
    serviceType: "WEBSITE",
    briefing: {},
    basePriceCents: 150_000,
    ...overrides,
  });
}

describe("Deal", () => {
  describe("create()", () => {
    it("creates with status PROPOSED and emits deal.proposed", () => {
      const r = makeDeal();
      expect(r.isOk()).toBe(true);
      const deal = r.unwrap();
      expect(deal.status).toBe("PROPOSED");
      const events = deal.clearDomainEvents();
      expect(events[0]!.eventType).toBe("deal.proposed");
    });

    it("fails when basePriceCents < 0", () => {
      expect(makeDeal({ basePriceCents: -1 }).isErr()).toBe(true);
    });

    it("accepts 0 as base price (free deal)", () => {
      expect(makeDeal({ basePriceCents: 0 }).isOk()).toBe(true);
    });
  });

  describe("totalCents", () => {
    it("is base price when no addons/discount", () => {
      const deal = makeDeal({ basePriceCents: 100_000 }).unwrap();
      expect(deal.totalCents).toBe(100_000);
    });

    it("adds addons to total", () => {
      const deal = makeDeal({ basePriceCents: 100_000 }).unwrap();
      deal.addAddon({ name: "SEO Pack", priceCents: 30_000 });
      expect(deal.totalCents).toBe(130_000);
    });

    it("applies discount correctly", () => {
      const deal = makeDeal({ basePriceCents: 100_000 }).unwrap();
      deal.setDiscount(10); // 10%
      expect(deal.totalCents).toBe(90_000);
    });

    it("discount applied after addons", () => {
      const deal = makeDeal({ basePriceCents: 100_000 }).unwrap();
      deal.addAddon({ name: "Addon", priceCents: 20_000 });
      deal.setDiscount(10); // 10% of 120k = 12k → 108k
      expect(deal.totalCents).toBe(108_000);
    });
  });

  describe("setDiscount()", () => {
    it("fails when pct < 0", () => {
      const deal = makeDeal().unwrap();
      expect(deal.setDiscount(-1).isErr()).toBe(true);
    });

    it("fails when pct > 100", () => {
      const deal = makeDeal().unwrap();
      expect(deal.setDiscount(101).isErr()).toBe(true);
    });

    it("accepts 0 and 100", () => {
      const deal = makeDeal().unwrap();
      expect(deal.setDiscount(0).isOk()).toBe(true);
      expect(deal.setDiscount(100).isOk()).toBe(true);
    });
  });

  describe("close()", () => {
    it("transitions to CLOSED and emits deal.closed", () => {
      const deal = makeDeal().unwrap();
      deal.clearDomainEvents();
      const r = deal.close();
      expect(r.isOk()).toBe(true);
      expect(deal.status).toBe("CLOSED");
      const events = deal.clearDomainEvents();
      expect(events[0]!.eventType).toBe("deal.closed");
    });

    it("fails when already CLOSED", () => {
      const deal = makeDeal().unwrap();
      deal.close();
      expect(deal.close().isErr()).toBe(true);
    });

    it("fails when CANCELLED", () => {
      const deal = makeDeal().unwrap();
      deal.cancel("client changed mind");
      expect(deal.close().isErr()).toBe(true);
    });
  });

  describe("cancel()", () => {
    it("transitions to CANCELLED and emits deal.cancelled", () => {
      const deal = makeDeal().unwrap();
      deal.clearDomainEvents();
      const r = deal.cancel("no budget");
      expect(r.isOk()).toBe(true);
      expect(deal.status).toBe("CANCELLED");
      const events = deal.clearDomainEvents();
      expect(events[0]!.eventType).toBe("deal.cancelled");
    });

    it("fails when already CANCELLED", () => {
      const deal = makeDeal().unwrap();
      deal.cancel("reason");
      expect(deal.cancel("another reason").isErr()).toBe(true);
    });

    it("fails when CLOSED", () => {
      const deal = makeDeal().unwrap();
      deal.close();
      expect(deal.cancel("reason").isErr()).toBe(true);
    });
  });
});
