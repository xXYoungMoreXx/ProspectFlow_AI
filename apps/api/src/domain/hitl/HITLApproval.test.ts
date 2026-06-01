import { describe, it, expect } from "vitest";
import { HITLApproval } from "./HITLApproval.js";
import { HITLLevel } from "./HITLLevel.js";
import { HITLActionType } from "./HITLActionType.js";
import { HITLTimeouts } from "./HITLTimeouts.js";
import { randomUUID } from "node:crypto";

function makeApproval(
  overrides: Partial<Parameters<typeof HITLApproval.create>[0]> = {},
) {
  return HITLApproval.create({
    id: randomUUID(),
    operatorId: randomUUID(),
    agentId: randomUUID(),
    hitlLevel: HITLLevel.HITL_1,
    actionType: HITLActionType.APPROVE_LEAD_LIST,
    contextType: "LEAD",
    contextId: randomUUID(),
    payloadPreview: { message: "Approve 5 leads?" },
    timeoutMinutes: HITLTimeouts[HITLActionType.APPROVE_LEAD_LIST],
    ...overrides,
  });
}

describe("HITLApproval", () => {
  describe("create()", () => {
    it("creates with status PENDING and emits event", () => {
      const r = makeApproval();
      expect(r.isOk()).toBe(true);
      const approval = r.unwrap();
      expect(approval.status).toBe("PENDING");
      const events = approval.clearDomainEvents();
      expect(events[0]!.eventType).toBe("hitl.approval_requested");
    });

    it("sets expiresAt based on timeoutMinutes", () => {
      const before = new Date();
      const approval = makeApproval({ timeoutMinutes: 60 }).unwrap();
      const after = new Date();
      const diffMs = approval.expiresAt.getTime() - before.getTime();
      // Should be ~60 minutes, with small tolerance
      expect(diffMs).toBeGreaterThanOrEqual(59 * 60 * 1000);
      expect(diffMs).toBeLessThanOrEqual(
        61 * 60 * 1000 + (after.getTime() - before.getTime()),
      );
    });

    it("sets expiresAt 100 years ahead for null timeout (HITL-FINANCEIRO)", () => {
      const approval = makeApproval({ timeoutMinutes: null }).unwrap();
      const diffYears =
        (approval.expiresAt.getTime() - Date.now()) / (365 * 24 * 3600 * 1000);
      expect(diffYears).toBeGreaterThan(90);
    });

    it("fails when timeout is < 1 minute (non-null)", () => {
      expect(makeApproval({ timeoutMinutes: 0 }).isErr()).toBe(true);
    });
  });

  describe("HITLTimeouts", () => {
    it("APPROVE_LEAD_LIST = 120 min", () => {
      expect(HITLTimeouts[HITLActionType.APPROVE_LEAD_LIST]).toBe(120);
    });
    it("APPROVE_MOCKUP = 180 min", () => {
      expect(HITLTimeouts[HITLActionType.APPROVE_MOCKUP]).toBe(180);
    });
    it("SEND_DELIVERY = 30 min", () => {
      expect(HITLTimeouts[HITLActionType.SEND_DELIVERY]).toBe(30);
    });
    it("APPROVE_LEAD_LIST, SEND_EXTERNAL_MESSAGE, etc. all defined", () => {
      for (const type of Object.values(HITLActionType)) {
        expect(HITLTimeouts[type]).toBeDefined();
      }
    });
  });

  describe("approve()", () => {
    it("transitions PENDING → APPROVED", () => {
      const approval = makeApproval().unwrap();
      approval.clearDomainEvents();
      expect(approval.approve("LGTM").isOk()).toBe(true);
      expect(approval.status).toBe("APPROVED");
    });

    it("emits hitl.approval_decided with APPROVED", () => {
      const approval = makeApproval().unwrap();
      approval.clearDomainEvents();
      approval.approve();
      const events = approval.clearDomainEvents();
      expect(events[0]!.eventType).toBe("hitl.approval_decided");
    });

    it("fails if already APPROVED", () => {
      const approval = makeApproval().unwrap();
      approval.approve();
      expect(approval.approve().isErr()).toBe(true);
    });

    it("fails if REJECTED", () => {
      const approval = makeApproval().unwrap();
      approval.reject();
      expect(approval.approve().isErr()).toBe(true);
    });
  });

  describe("reject()", () => {
    it("transitions PENDING → REJECTED", () => {
      const approval = makeApproval().unwrap();
      const r = approval.reject("too risky");
      expect(r.isOk()).toBe(true);
      expect(approval.status).toBe("REJECTED");
    });

    it("fails if already REJECTED", () => {
      const approval = makeApproval().unwrap();
      approval.reject();
      expect(approval.reject().isErr()).toBe(true);
    });
  });

  describe("editAndApprove()", () => {
    it("transitions PENDING → EDITED_APPROVED with new payload", () => {
      const approval = makeApproval().unwrap();
      const r = approval.editAndApprove(
        { message: "edited payload" },
        "operator note",
      );
      expect(r.isOk()).toBe(true);
      expect(approval.status).toBe("EDITED_APPROVED");
      expect(approval.payloadPreview["message"]).toBe("edited payload");
    });
  });

  describe("expire()", () => {
    it("transitions PENDING → EXPIRED (non-financial)", () => {
      const approval = makeApproval({ hitlLevel: HITLLevel.HITL_1 }).unwrap();
      approval.expire();
      expect(approval.status).toBe("EXPIRED");
    });

    it("HITL-FINANCEIRO never expires", () => {
      const approval = makeApproval({
        hitlLevel: HITLLevel.HITL_FINANCEIRO,
        timeoutMinutes: null,
      }).unwrap();
      approval.expire(); // no-op for financial
      expect(approval.status).toBe("PENDING");
    });
  });

  describe("isFinancial / canAutoApprove", () => {
    it("isFinancial true for HITL-FINANCEIRO level", () => {
      const approval = makeApproval({
        hitlLevel: HITLLevel.HITL_FINANCEIRO,
        timeoutMinutes: null,
      }).unwrap();
      expect(approval.isFinancial).toBe(true);
    });

    it("isFinancial false for HITL_1", () => {
      const approval = makeApproval({ hitlLevel: HITLLevel.HITL_1 }).unwrap();
      expect(approval.isFinancial).toBe(false);
    });

    it("canAutoApprove false before expiry", () => {
      const approval = makeApproval({ hitlLevel: HITLLevel.HITL_2 }).unwrap();
      expect(approval.canAutoApprove).toBe(false);
    });
  });
});
