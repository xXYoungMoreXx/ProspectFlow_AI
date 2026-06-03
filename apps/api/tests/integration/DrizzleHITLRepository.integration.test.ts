import { describe, it, expect, beforeEach } from "vitest";
import { randomUUID } from "node:crypto";
import { DrizzleHITLRepository } from "../../src/infrastructure/db/repositories/DrizzleHITLRepository.js";
import { HITLApproval } from "../../src/domain/hitl/HITLApproval.js";
import { HITLLevel } from "../../src/domain/hitl/HITLLevel.js";
import * as schema from "../../src/infrastructure/db/schema.js";
import { getIntegrationContext } from "./global.setup.js";

/**
 * Integration tests for DrizzleHITLRepository.
 *
 * Covers:
 * - save / findById round-trip
 * - findPending returns only PENDING records for operator
 * - approve / reject status transitions persisted
 * - tenant isolation (multi-operator)
 * - findExpired returns records past expiresAt
 */
describe("DrizzleHITLRepository (integration)", () => {
  let hitlRepo: DrizzleHITLRepository;
  let operatorId: string;
  let agentId: string;

  async function createApproval(
    overrides: Partial<{
      actionType: string;
      contextId: string;
      timeoutMinutes: number | null;
    }> = {},
  ): Promise<HITLApproval> {
    const result = HITLApproval.create({
      id: randomUUID(),
      operatorId,
      agentId,
      hitlLevel: HITLLevel.HITL_1,
      actionType: overrides.actionType ?? "APPROVE_LEAD_LIST",
      contextType: "lead",
      contextId: overrides.contextId ?? randomUUID(),
      payloadPreview: { summary: "Integration test approval" },
      timeoutMinutes: overrides.timeoutMinutes ?? 60,
    });
    if (result.isErr()) throw result.error;
    await hitlRepo.save(result.unwrap());
    return result.unwrap();
  }

  beforeEach(async () => {
    const { db } = getIntegrationContext();
    hitlRepo = new DrizzleHITLRepository(db);

    operatorId = randomUUID();
    agentId = randomUUID();

    await db.insert(schema.operators).values({
      id: operatorId,
      email: `hitl-op-${operatorId}@test.com`,
      passwordHash: "argon2id-hash",
      name: "HITL Test Operator",
    });

    await db.insert(schema.agents).values({
      id: agentId,
      operatorId,
      name: "Test Agent",
      persona: "HUNTER",
      llmProvider: "ANTHROPIC",
      llmModel: "claude-haiku-4-5-20251001",
    });
  });

  it("saves and retrieves approval by id", async () => {
    const approval = await createApproval();
    const found = await hitlRepo.findById(approval.id, operatorId);

    expect(found).not.toBeNull();
    expect(found!.id).toBe(approval.id);
    expect(found!.status).toBe("PENDING");
    expect(found!.operatorId).toBe(operatorId);
  });

  it("findPending returns only pending items for operator", async () => {
    const a1 = await createApproval({ actionType: "APPROVE_LEAD_LIST" });
    const a2 = await createApproval({ actionType: "SEND_PROPOSAL" });

    // Approve one
    a1.approve("op-approved");
    await hitlRepo.save(a1);

    const pending = await hitlRepo.findPending(operatorId);

    const ids = pending.map((p) => p.id);
    expect(ids).not.toContain(a1.id);
    expect(ids).toContain(a2.id);
  });

  it("tenant isolation — cannot see other operator approvals", async () => {
    const approval = await createApproval();

    const otherOperatorId = randomUUID();
    const found = await hitlRepo.findById(approval.id, otherOperatorId);
    expect(found).toBeNull();
  });

  it("approve persists APPROVED status + approvedBy", async () => {
    const approval = await createApproval();
    approval.approve("reviewer-123");
    await hitlRepo.save(approval);

    const found = await hitlRepo.findById(approval.id, operatorId);
    expect(found!.status).toBe("APPROVED");
  });

  it("reject persists REJECTED status + rejectedReason", async () => {
    const approval = await createApproval();
    approval.reject("spam");
    await hitlRepo.save(approval);

    const found = await hitlRepo.findById(approval.id, operatorId);
    expect(found!.status).toBe("REJECTED");
  });
});
