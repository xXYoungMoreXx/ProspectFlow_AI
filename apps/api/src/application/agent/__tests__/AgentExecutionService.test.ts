import { describe, it, expect, vi, beforeEach, type Mocked } from "vitest";
import { AgentExecutionService } from "../AgentExecutionService.js";
import type { AgentRepository } from "../../../domain/agent/AgentRepository.js";
import type { BullMQAdapter } from "../../../infrastructure/queue/BullMQAdapter.js";
import { Agent } from "../../../domain/agent/Agent.js";

describe("AgentExecutionService", () => {
  let agentRepo: Mocked<AgentRepository>;
  let queue: Mocked<BullMQAdapter>;
  let service: AgentExecutionService;

  beforeEach(() => {
    agentRepo = {
      findById: vi.fn(),
      save: vi.fn(),
    } as any;

    queue = {
      createWorker: vi.fn(),
    } as any;

    service = new AgentExecutionService(agentRepo, queue);

    // Mock global fetch
    global.fetch = vi.fn();
  });

  it("should process a task and call the Python runtime over HTTP", async () => {
    // 1. Arrange
    const agent = Agent.reconstitute({
      id: "agent-123",
      operatorId: "operator-123",
      name: "Test Hunter",
      persona: "HUNTER",
      status: "ACTIVE",
      llmConfig: {
        provider: "OPENAI",
        model: "gpt-4o",
        temperature: 0.7,
        maxTokens: 4096,
      },
      tokenBudgetTotal: 100000,
      tokenBudgetRemaining: 100000,
      ragEnabled: false,
      ragTopK: 5,
      ragThreshold: 0.7,
      hitlTimeoutMinutes: 60,
      hitlNotifyChannel: "email",
      skills: [],
      rules: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    agentRepo.findById.mockResolvedValue(agent);

    // Mock successful Python Response
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({
        status: "completed",
        result: { raw_output: "Sample lead data found" },
        correlation_id: "corr-123",
      }),
    });

    const job = {
      data: {
        agentId: "agent-123",
        operatorId: "operator-123",
        taskType: "hunter.search",
        userPrompt: "Find dentists in NY",
        correlationId: "corr-123",
        metadata: { category: "dentists" },
      },
      updateProgress: vi.fn().mockResolvedValue(true),
    } as any;

    // 2. Act
    await (service as any).processTask(job);

    // 3. Assert
    expect(agentRepo.findById).toHaveBeenCalledWith(
      "agent-123",
      "operator-123",
    );

    // Verify HTTP call was made correctly
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/tasks"),
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
      }),
    );

    const fetchCallArg = JSON.parse(
      (global.fetch as any).mock.calls[0][1].body,
    );
    expect(fetchCallArg.task_type).toBe("hunter.search");
    expect(fetchCallArg.payload.user_message).toBe("Find dentists in NY");
    expect(fetchCallArg.payload.category).toBe("dentists");

    // Verify Job progress was updated with Python's result
    expect(job.updateProgress).toHaveBeenCalledWith(
      expect.objectContaining({
        output: "Sample lead data found",
      }),
    );

    // Verify agent token budget was reduced and saved
    expect(agent.tokenBudgetRemaining).toBe(100000 - 500); // 500 is the hardcoded mock usage currently
    expect(agentRepo.save).toHaveBeenCalledWith(agent);
  });

  it("should pause agent if Python returns pending_hitl", async () => {
    // 1. Arrange
    const agent = Agent.reconstitute({
      id: "agent-123",
      operatorId: "operator-123",
      name: "Test Closer",
      persona: "CLOSER",
      status: "ACTIVE",
      llmConfig: {
        provider: "OPENAI",
        model: "gpt-4o",
        temperature: 0.7,
        maxTokens: 4096,
      },
      tokenBudgetTotal: 100000,
      tokenBudgetRemaining: 100000,
      ragEnabled: false,
      ragTopK: 5,
      ragThreshold: 0.7,
      hitlTimeoutMinutes: 60,
      hitlNotifyChannel: "email",
      skills: [],
      rules: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    agentRepo.findById.mockResolvedValue(agent);

    // Mock HITL Pause Python Response
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({
        status: "pending_hitl",
        error: "Requires human approval to send quote",
        correlation_id: "corr-123",
      }),
    });

    const job = {
      data: {
        agentId: "agent-123",
        operatorId: "operator-123",
        taskType: "closer.negotiate",
        userPrompt: "Send proposal",
        correlationId: "corr-123",
      },
      updateProgress: vi.fn().mockResolvedValue(true),
    } as any;

    // 2. Act
    await expect((service as any).processTask(job)).rejects.toThrow(
      "Agent Task paused for HITL",
    );

    // 3. Assert
    expect(agent.status).toBe("PAUSED");
    expect(agentRepo.save).toHaveBeenCalledWith(agent);
    expect(job.updateProgress).toHaveBeenCalledWith({
      status: "pending_hitl",
      error: "Requires human approval to send quote",
    });
  });
});
