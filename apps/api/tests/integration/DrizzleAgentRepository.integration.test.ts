import { describe, it, expect, beforeEach } from "vitest";
import { randomUUID } from "node:crypto";
import { DrizzleAgentRepository } from "../../infrastructure/db/repositories/DrizzleAgentRepository.js";
import { Agent } from "../../domain/agent/Agent.js";
import * as schema from "../../infrastructure/db/schema.js";
import { getIntegrationContext } from "./global.setup.js";

/**
 * Integration tests for DrizzleAgentRepository.
 *
 * Covers:
 * - save / findById round-trip
 * - findMany by operatorId
 * - activate / pause status transitions persisted
 * - tenant isolation
 */
describe("DrizzleAgentRepository (integration)", () => {
  let agentRepo: DrizzleAgentRepository;
  let operatorId: string;

  function buildAgent(overrides: Partial<{ name: string }> = {}): Agent {
    const result = Agent.create({
      id: randomUUID(),
      operatorId,
      name: overrides.name ?? "Hunter Agent",
      persona: "HUNTER",
      llmConfig: {
        provider: "ANTHROPIC",
        model: "claude-haiku-4-5-20251001",
        temperature: 0.7,
        maxTokens: 4096,
      },
    });
    if (result.isErr()) throw result.error;
    return result.unwrap();
  }

  beforeEach(async () => {
    const { db } = getIntegrationContext();
    agentRepo = new DrizzleAgentRepository(db);

    operatorId = randomUUID();
    await db.insert(schema.operators).values({
      id: operatorId,
      email: `agent-op-${operatorId}@test.com`,
      passwordHash: "argon2id-hash",
      name: "Agent Test Operator",
    });
  });

  it("saves and retrieves agent by id", async () => {
    const agent = buildAgent({ name: "My Hunter" });
    await agentRepo.save(agent);

    const found = await agentRepo.findById(agent.id, operatorId);
    expect(found).not.toBeNull();
    expect(found!.name).toBe("My Hunter");
    expect(found!.persona).toBe("HUNTER");
    expect(found!.operatorId).toBe(operatorId);
  });

  it("findMany returns agents for operator", async () => {
    const a1 = buildAgent({ name: "Agent One" });
    const a2 = buildAgent({ name: "Agent Two" });
    await agentRepo.save(a1);
    await agentRepo.save(a2);

    const result = await agentRepo.findMany({ operatorId });
    const names = result.agents.map((a) => a.name);

    expect(names).toContain("Agent One");
    expect(names).toContain("Agent Two");
    expect(result.agents.length).toBe(2);
  });

  it("tenant isolation — cannot see other operator agents", async () => {
    const agent = buildAgent();
    await agentRepo.save(agent);

    const otherOp = randomUUID();
    const found = await agentRepo.findById(agent.id, otherOp);
    expect(found).toBeNull();
  });

  it("activate persists ACTIVE status", async () => {
    const agent = buildAgent();
    await agentRepo.save(agent);

    const activateResult = agent.activate();
    expect(activateResult.isOk()).toBe(true);
    await agentRepo.save(agent);

    const found = await agentRepo.findById(agent.id, operatorId);
    expect(found!.status).toBe("ACTIVE");
  });

  it("pause persists PAUSED status", async () => {
    const agent = buildAgent();
    agent.activate();
    await agentRepo.save(agent);

    agent.pause("maintenance");
    await agentRepo.save(agent);

    const found = await agentRepo.findById(agent.id, operatorId);
    expect(found!.status).toBe("PAUSED");
  });
});
