import { describe, it, expect } from "vitest";
import { Briefing } from "./Briefing.js";
import { randomUUID } from "node:crypto";

function makeBriefing(
  overrides: Partial<Parameters<typeof Briefing.create>[0]> = {},
) {
  return Briefing.create({
    id: randomUUID(),
    dealId: randomUUID(),
    operatorId: randomUUID(),
    ...overrides,
  });
}

describe("Briefing", () => {
  describe("create()", () => {
    it("creates with status IN_PROGRESS", () => {
      const result = makeBriefing();
      expect(result.isOk()).toBe(true);
      expect(result.unwrap().status).toBe("IN_PROGRESS");
    });

    it("emits briefing.created domain event", () => {
      const result = makeBriefing();
      const briefing = result.unwrap();
      const events = briefing.clearDomainEvents();
      expect(events).toHaveLength(1);
      expect(events[0]!.eventType).toBe("briefing.created");
    });

    it("fails when dealId is empty", () => {
      const result = makeBriefing({ dealId: "" });
      expect(result.isErr()).toBe(true);
    });
  });

  describe("complete()", () => {
    it("transitions IN_PROGRESS → COMPLETED and stores data", () => {
      const briefing = makeBriefing().unwrap();
      briefing.clearDomainEvents(); // drain create event

      const data = { businessName: "Acme", niche: "restaurant" };
      const result = briefing.complete(data, "vault://transcript/123");

      expect(result.isOk()).toBe(true);
      expect(briefing.status).toBe("COMPLETED");
      expect(briefing.briefingData).toEqual(data);
      expect(briefing.interviewTranscriptRef).toBe("vault://transcript/123");
    });

    it("emits briefing.completed event", () => {
      const briefing = makeBriefing().unwrap();
      briefing.clearDomainEvents();
      briefing.complete({ name: "Test" });
      const events = briefing.clearDomainEvents();
      expect(events[0]!.eventType).toBe("briefing.completed");
    });

    it("fails if already COMPLETED", () => {
      const briefing = makeBriefing().unwrap();
      briefing.complete({});
      const result = briefing.complete({});
      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.field).toBe("status");
      }
    });

    it("fails if status is APPROVED (terminal)", () => {
      const briefing = makeBriefing().unwrap();
      briefing.complete({});
      briefing.approve();
      const result = briefing.complete({});
      expect(result.isErr()).toBe(true);
    });
  });

  describe("approve()", () => {
    it("transitions COMPLETED → APPROVED and sets approvedAt", () => {
      const briefing = makeBriefing().unwrap();
      briefing.complete({ key: "value" });
      briefing.clearDomainEvents();

      const result = briefing.approve();

      expect(result.isOk()).toBe(true);
      expect(briefing.status).toBe("APPROVED");
      expect(briefing.approvedAt).toBeInstanceOf(Date);
    });

    it("emits briefing.approved event with dealId and approvedAt", () => {
      const dealId = randomUUID();
      const briefing = makeBriefing({ dealId }).unwrap();
      briefing.complete({});
      briefing.clearDomainEvents();
      briefing.approve();

      const events = briefing.clearDomainEvents();
      expect(events[0]!.eventType).toBe("briefing.approved");
      const payload = (events[0] as unknown as { payload: { dealId: string } })
        .payload;
      expect(payload.dealId).toBe(dealId);
    });

    it("fails if status is IN_PROGRESS (must complete first)", () => {
      const briefing = makeBriefing().unwrap();
      const result = briefing.approve();
      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.message).toMatch(/COMPLETED/);
      }
    });

    it("APPROVED → COMPLETED is BLOCKED (terminal state immutable)", () => {
      const briefing = makeBriefing().unwrap();
      briefing.complete({});
      briefing.approve();

      // Trying to approve again should fail
      const result = briefing.approve();
      expect(result.isErr()).toBe(true);
    });

    it("isTerminal is true only when APPROVED", () => {
      const briefing = makeBriefing().unwrap();
      expect(briefing.isTerminal).toBe(false);
      briefing.complete({});
      expect(briefing.isTerminal).toBe(false);
      briefing.approve();
      expect(briefing.isTerminal).toBe(true);
    });
  });

  describe("reconstitute()", () => {
    it("rebuilds from persisted props without emitting events", () => {
      const now = new Date();
      const briefing = Briefing.reconstitute({
        id: randomUUID(),
        dealId: randomUUID(),
        operatorId: randomUUID(),
        status: "APPROVED",
        briefingData: { niche: "clinic" },
        approvedAt: now,
        createdAt: now,
        updatedAt: now,
      });

      expect(briefing.status).toBe("APPROVED");
      expect(briefing.clearDomainEvents()).toHaveLength(0);
    });
  });
});
