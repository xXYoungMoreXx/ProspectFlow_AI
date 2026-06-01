import { describe, it, expect } from "vitest";
import { Lead } from "./Lead.js";
import { randomUUID } from "node:crypto";

function makeLead(overrides: Partial<Parameters<typeof Lead.create>[0]> = {}) {
  return Lead.create({
    id: randomUUID(),
    operatorId: randomUUID(),
    contact: { name: "João Silva", phone: "+5511999998888" },
    source: "MANUAL",
    ...overrides,
  });
}

describe("Lead", () => {
  describe("create()", () => {
    it("creates with status NEW for MANUAL source", () => {
      const r = makeLead({ source: "MANUAL" });
      expect(r.isOk()).toBe(true);
      expect(r.unwrap().status).toBe("NEW");
    });

    it("creates with status PROSPECTED for GOOGLE_MAPS source", () => {
      const r = makeLead({ source: "GOOGLE_MAPS" });
      expect(r.unwrap().status).toBe("PROSPECTED");
    });

    it("creates with status PROSPECTED for APOLLO source", () => {
      const r = makeLead({ source: "APOLLO" });
      expect(r.unwrap().status).toBe("PROSPECTED");
    });

    it("emits lead.created domain event", () => {
      const lead = makeLead().unwrap();
      const events = lead.clearDomainEvents();
      expect(events).toHaveLength(1);
      expect(events[0]!.eventType).toBe("lead.created");
    });

    it("fails when name is empty", () => {
      const r = makeLead({ contact: { name: "" } });
      expect(r.isErr()).toBe(true);
    });

    it("fails when name exceeds 200 chars", () => {
      const r = makeLead({ contact: { name: "a".repeat(201) } });
      expect(r.isErr()).toBe(true);
    });
  });

  describe("approveProspect()", () => {
    it("transitions PROSPECTED → APPROVED", () => {
      const lead = makeLead({ source: "GOOGLE_MAPS" }).unwrap();
      lead.clearDomainEvents();
      const r = lead.approveProspect();
      expect(r.isOk()).toBe(true);
      expect(lead.status).toBe("APPROVED");
    });

    it("emits lead.approved event", () => {
      const lead = makeLead({ source: "GOOGLE_MAPS" }).unwrap();
      lead.clearDomainEvents();
      lead.approveProspect();
      const events = lead.clearDomainEvents();
      expect(events[0]!.eventType).toBe("lead.approved");
    });

    it("fails if lead is NEW (not PROSPECTED)", () => {
      const lead = makeLead({ source: "MANUAL" }).unwrap();
      const r = lead.approveProspect();
      expect(r.isErr()).toBe(true);
    });
  });

  describe("qualify()", () => {
    it("sets score and status QUALIFIED", () => {
      const lead = makeLead().unwrap();
      const r = lead.qualify(75, "agent-1");
      expect(r.isOk()).toBe(true);
      expect(lead.qualificationScore).toBe(75);
      expect(lead.status).toBe("QUALIFIED");
    });

    it("fails when score < 0", () => {
      const lead = makeLead().unwrap();
      expect(lead.qualify(-1, "agent-1").isErr()).toBe(true);
    });

    it("fails when score > 100", () => {
      const lead = makeLead().unwrap();
      expect(lead.qualify(101, "agent-1").isErr()).toBe(true);
    });

    it("emits lead.qualified event", () => {
      const lead = makeLead().unwrap();
      lead.clearDomainEvents();
      lead.qualify(80, "agent-1");
      const events = lead.clearDomainEvents();
      expect(events[0]!.eventType).toBe("lead.qualified");
    });
  });

  describe("markContacted()", () => {
    it("transitions NEW → CONTACTED", () => {
      const lead = makeLead({ source: "MANUAL" }).unwrap();
      lead.markContacted();
      expect(lead.status).toBe("CONTACTED");
    });

    it("transitions APPROVED → CONTACTED", () => {
      const lead = makeLead({ source: "GOOGLE_MAPS" }).unwrap();
      lead.approveProspect();
      lead.markContacted();
      expect(lead.status).toBe("CONTACTED");
    });

    it("ignores when already CONTACTED", () => {
      const lead = makeLead().unwrap();
      lead.markContacted();
      lead.markContacted(); // idempotent
      expect(lead.status).toBe("CONTACTED");
    });
  });

  describe("convert()", () => {
    it("transitions to CONVERTED and emits event", () => {
      const lead = makeLead().unwrap();
      lead.clearDomainEvents();
      const r = lead.convert("deal-1");
      expect(r.isOk()).toBe(true);
      expect(lead.status).toBe("CONVERTED");
      const events = lead.clearDomainEvents();
      expect(events[0]!.eventType).toBe("lead.converted");
    });

    it("fails if already CONVERTED", () => {
      const lead = makeLead().unwrap();
      lead.convert("deal-1");
      expect(lead.convert("deal-2").isErr()).toBe(true);
    });

    it("fails if LOST", () => {
      const lead = makeLead().unwrap();
      lead.markLost("no response");
      expect(lead.convert("deal-1").isErr()).toBe(true);
    });
  });

  describe("markLost()", () => {
    it("sets status LOST with reason", () => {
      const lead = makeLead().unwrap();
      lead.clearDomainEvents();
      lead.markLost("ghosted after 3 attempts");
      expect(lead.status).toBe("LOST");
      const events = lead.clearDomainEvents();
      expect(events[0]!.eventType).toBe("lead.lost");
    });
  });
});
