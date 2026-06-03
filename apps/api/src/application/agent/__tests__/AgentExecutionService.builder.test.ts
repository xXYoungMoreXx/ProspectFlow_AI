import { describe, it, expect, vi, beforeEach } from "vitest";
import { AgentExecutionService } from "../AgentExecutionService.js";
import { HITLActionType } from "../../../domain/hitl/HITLActionType.js";
import { Project } from "../../../domain/project/Project.js";

function makeAgent() {
  return {
    id: "agent-1",
    name: "Builder",
    persona: "BUILDER",
    status: "ACTIVE",
    llmConfig: { provider: "anthropic", model: "claude-sonnet-4-6" },
    ragEnabled: false,
    ragCollection: null,
    consumeTokens: vi.fn().mockReturnValue({ isErr: () => false }),
    recordTaskCompleted: vi.fn(),
    pause: vi.fn(),
  };
}

function makeProject() {
  return Project.reconstitute({
    id: "proj-1",
    dealId: "deal-1",
    operatorId: "op-1",
    assignedAgentId: "agent-1",
    status: "PLANNING",
    briefing: {},
    deliverableMeta: {},
    lighthouse: {},
    revisionCount: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

describe("AgentExecutionService — builder.generate HITL", () => {
  let agentRepo: any;
  let hitlRepo: { save: ReturnType<typeof vi.fn> };
  let projectRepo: any;
  let queue: { createWorker: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    agentRepo = {
      findById: vi.fn().mockResolvedValue(makeAgent()),
      save: vi.fn(),
    };
    hitlRepo = { save: vi.fn() };
    projectRepo = {
      findById: vi.fn().mockResolvedValue(makeProject()),
      save: vi.fn(),
    };
    queue = { createWorker: vi.fn() };
  });

  it("cria HITL APPROVE_STAGING quando builder.generate retorna completed", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        status: "completed",
        result: {
          html: "<html>site</html>",
          previewUrl: "https://preview.example.com",
        },
      }),
      text: async () => "",
    });
    vi.stubGlobal("fetch", fetchMock);

    const svc = new AgentExecutionService(
      agentRepo as any,
      queue as any,
      undefined,
      hitlRepo as any,
      projectRepo as any,
    );

    const job = {
      data: {
        agentId: "agent-1",
        operatorId: "op-1",
        taskType: "builder.generate",
        userPrompt: "build site",
        correlationId: "corr-1",
        metadata: { projectId: "proj-1" },
      },
      updateProgress: vi.fn(),
    };

    await (svc as any).processTask(job);

    expect(hitlRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        actionType: HITLActionType.APPROVE_STAGING,
      }),
    );
    expect(projectRepo.save).toHaveBeenCalled();
  });

  it("não cria HITL APPROVE_STAGING para hunter.search", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ status: "completed", result: { raw_output: "[]" } }),
      text: async () => "",
    });
    vi.stubGlobal("fetch", fetchMock);

    // No projectRepo — APPROVE_STAGING should not be called
    const svc = new AgentExecutionService(
      agentRepo as any,
      queue as any,
      undefined,
      hitlRepo as any,
    );

    const job = {
      data: {
        agentId: "agent-1",
        operatorId: "op-1",
        taskType: "hunter.search",
        userPrompt: "search",
        correlationId: "corr-2",
        metadata: {},
      },
      updateProgress: vi.fn(),
    };

    await (svc as any).processTask(job);

    const stagingCalls = (
      hitlRepo.save as ReturnType<typeof vi.fn>
    ).mock.calls.filter(
      (args: any[]) => args[0]?.actionType === HITLActionType.APPROVE_STAGING,
    );
    expect(stagingCalls).toHaveLength(0);
  });
});
