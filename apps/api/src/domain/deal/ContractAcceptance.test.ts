import { describe, it, expect } from "vitest";
import { ContractAcceptance } from "./ContractAcceptance.js";

describe("ContractAcceptance", () => {
  const base = {
    id: "ca1",
    dealId: "deal1",
    ipRaw: "192.0.2.1",
    userAgent: "Mozilla/5.0",
    sessionId: "sess1",
    contractText: "I agree to the terms.",
  };

  describe("recordAcceptance()", () => {
    it("ok with valid input", () => {
      const r = ContractAcceptance.recordAcceptance(base);
      expect(r.isOk()).toBe(true);
      if (r.isOk()) {
        const ca = r.value;
        expect(ca.id).toBe("ca1");
        expect(ca.dealId).toBe("deal1");
        expect(ca.contractHash).toHaveLength(64);
        expect(ca.ipHash).toHaveLength(64);
        expect(ca.userAgentHash).toHaveLength(64);
        expect(ca.sessionId).toBe("sess1");
        expect(ca.acceptedAt).toBeInstanceOf(Date);
        expect(ca.createdAt).toBeInstanceOf(Date);
      }
    });

    it("err when dealId empty", () => {
      const r = ContractAcceptance.recordAcceptance({ ...base, dealId: "" });
      expect(r.isErr()).toBe(true);
    });

    it("err when contractText empty", () => {
      const r = ContractAcceptance.recordAcceptance({
        ...base,
        contractText: "",
      });
      expect(r.isErr()).toBe(true);
    });

    it("toJSON returns all fields", () => {
      const r = ContractAcceptance.recordAcceptance(base);
      expect(r.isOk()).toBe(true);
      if (r.isOk()) {
        const json = r.value.toJSON();
        expect(json).toMatchObject({ id: "ca1", dealId: "deal1" });
      }
    });
  });

  describe("reconstitute()", () => {
    it("restores all props from persistence", () => {
      const now = new Date();
      const ca = ContractAcceptance.reconstitute({
        id: "ca2",
        dealId: "deal2",
        contractHash: "chash",
        acceptedAt: now,
        ipHash: "iphash",
        userAgentHash: "uahash",
        sessionId: "s2",
        createdAt: now,
      });
      expect(ca.id).toBe("ca2");
      expect(ca.contractHash).toBe("chash");
      expect(ca.ipHash).toBe("iphash");
      expect(ca.userAgentHash).toBe("uahash");
    });
  });
});
