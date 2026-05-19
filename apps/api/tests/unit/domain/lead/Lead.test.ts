import { describe, it, expect } from "vitest";
import { Lead } from "../../../../src/domain/lead/Lead.js";

describe("Lead Entity", () => {
  it("should create a valid lead and emit created event", () => {
    const result = Lead.create({
      id: "lead-123",
      operatorId: "op-1",
      contact: { name: "Acme Corp", phone: "123456789" },
      source: "MANUAL",
    });

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      const lead = result.value;
      expect(lead.status).toBe("NEW");
      expect(lead.domainEvents.length).toBe(1);
      expect(lead.domainEvents[0].eventType).toBe("lead.created");
    }
  });

  it("should fail creation with invalid contact name", () => {
    const result = Lead.create({
      id: "lead-123",
      operatorId: "op-1",
      contact: { name: "" }, // Too short
      source: "MANUAL",
    });

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.field).toBe("contact_name");
    }
  });

  it("should qualify lead and emit qualified event", () => {
    const lead = Lead.create({
      id: "lead-1",
      operatorId: "op-1",
      contact: { name: "Test" },
      source: "AGENT_HUNTER",
    }).unwrap();

    // Clear initial events
    lead.clearDomainEvents();

    const qualifyResult = lead.qualify(85, "agent-hunter");
    expect(qualifyResult.isOk()).toBe(true);
    expect(lead.status).toBe("QUALIFIED");
    expect(lead.qualificationScore).toBe(85);
    expect(lead.domainEvents.length).toBe(1);
    expect(lead.domainEvents[0].eventType).toBe("lead.qualified");
  });

  it("should fail qualification with invalid score", () => {
    const lead = Lead.create({
      id: "lead-1",
      operatorId: "op-1",
      contact: { name: "Test" },
      source: "AGENT_HUNTER",
    }).unwrap();

    const qualifyResult = lead.qualify(150, "agent-hunter"); // Over 100
    expect(qualifyResult.isErr()).toBe(true);
  });

  it("should convert lead successfully", () => {
    const lead = Lead.create({
      id: "lead-1",
      operatorId: "op-1",
      contact: { name: "Test" },
      source: "MANUAL",
    }).unwrap();

    const convertResult = lead.convert("deal-123");
    expect(convertResult.isOk()).toBe(true);
    expect(lead.status).toBe("CONVERTED");
  });

  it("should not convert a lost lead", () => {
    const lead = Lead.create({
      id: "lead-1",
      operatorId: "op-1",
      contact: { name: "Test" },
      source: "MANUAL",
    }).unwrap();

    lead.markLost("Not interested");
    expect(lead.status).toBe("LOST");

    const convertResult = lead.convert("deal-123");
    expect(convertResult.isErr()).toBe(true);
    expect(lead.status).toBe("LOST"); // Still lost
  });
});
