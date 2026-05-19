import { describe, it, expect } from "vitest";
import {
  Agent,
  type LLMConfiguration,
} from "../../../../src/domain/agent/Agent.js";

describe("Agent Entity", () => {
  const validLLMConfig: LLMConfiguration = {
    provider: "ANTHROPIC",
    model: "claude-3-5-sonnet",
    temperature: 0.7,
    maxTokens: 4000,
  };

  it("should create a valid agent", () => {
    const result = Agent.create({
      id: "agent-123",
      operatorId: "op-123",
      name: "Hunter BDR",
      persona: "HUNTER",
      llmConfig: validLLMConfig,
    });

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      const agent = result.value;
      expect(agent.id).toBe("agent-123");
      expect(agent.status).toBe("INACTIVE");
      expect(agent.tokenBudgetRemaining).toBe(1_000_000);
      expect(agent.domainEvents.length).toBe(0);
    }
  });

  it("should fail creation with invalid name", () => {
    const result = Agent.create({
      id: "agent-123",
      operatorId: "op-123",
      name: "A", // Too short
      persona: "HUNTER",
      llmConfig: validLLMConfig,
    });

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.field).toBe("name");
    }
  });

  it("should activate and add domain event", () => {
    const agent = Agent.create({
      id: "a",
      operatorId: "op",
      name: "Test Agent",
      persona: "CLOSER",
      llmConfig: validLLMConfig,
    }).unwrap();

    const activateResult = agent.activate();
    expect(activateResult.isOk()).toBe(true);
    expect(agent.status).toBe("ACTIVE");
    expect(agent.domainEvents.length).toBe(1);
    expect(agent.domainEvents[0].eventType).toBe("agent.activated");

    // Should fail if already active
    const secondActivate = agent.activate();
    expect(secondActivate.isErr()).toBe(true);
  });

  it("should consume tokens and fail when insufficient", () => {
    const agent = Agent.create({
      id: "a",
      operatorId: "op",
      name: "Test Agent",
      persona: "BUILDER",
      llmConfig: validLLMConfig,
    }).unwrap();

    expect(agent.tokenBudgetRemaining).toBe(1_000_000);

    const consumeResult = agent.consumeTokens(500);
    expect(consumeResult.isOk()).toBe(true);
    expect(agent.tokenBudgetRemaining).toBe(999_500);

    const overConsumeResult = agent.consumeTokens(2_000_000);
    expect(overConsumeResult.isErr()).toBe(true);
    expect(agent.tokenBudgetRemaining).toBe(999_500);
  });
});
