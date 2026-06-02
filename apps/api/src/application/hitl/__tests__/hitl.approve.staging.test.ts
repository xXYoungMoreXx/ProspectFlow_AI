import { describe, it, expect, vi, beforeEach } from "vitest";
import { ApproveHITLHandler } from "../hitl.handlers.js";
import { HITLActionType } from "../../../domain/hitl/HITLActionType.js";
import { HITLApproval } from "../../../domain/hitl/HITLApproval.js";
import { HITLLevel } from "../../../domain/hitl/HITLLevel.js";
import { Project } from "../../../domain/project/Project.js";
import { ulid } from "ulid";

function makeApproval(
  actionType: HITLActionType,
  payloadPreview: Record<string, unknown>,
) {
  const result = HITLApproval.create({
    id: ulid(),
    operatorId: "op-1",
    agentId: "agent-1",
    hitlLevel: HITLLevel.HITL_1,
    actionType,
    contextType: "PROJECT",
    contextId: "proj-1",
    payloadPreview,
    timeoutMinutes: 120,
  });
  return result.unwrap();
}

function makeProject(html?: string) {
  return Project.reconstitute({
    id: "proj-1",
    dealId: "deal-1",
    operatorId: "op-1",
    status: "PLANNING",
    briefing: {},
    deliverableMeta: html ? { html } : {},
    lighthouse: {},
    revisionCount: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

describe("ApproveHITLHandler — APPROVE_STAGING", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
    vi.stubGlobal("fetch", fetchMock);
  });

  it("chama deploymentRouter.deploy() quando APPROVE_STAGING aprovado com html", async () => {
    const approval = makeApproval(HITLActionType.APPROVE_STAGING, {
      projectId: "proj-1",
    });

    const repo = {
      findById: vi.fn().mockResolvedValue(approval),
      save: vi.fn(),
    };

    const projectRepo = {
      findById: vi.fn().mockResolvedValue(makeProject("<html>site</html>")),
      save: vi.fn(),
    };

    const deployMock = vi.fn().mockResolvedValue({
      isOk: () => true,
      unwrap: () => ({
        url: "https://live.example.com",
        provider: "vercel",
        deploymentId: "dep-1",
      }),
    });
    const deploymentRouter = { deploy: deployMock };

    const handler = new ApproveHITLHandler(
      repo as any,
      projectRepo as any,
      deploymentRouter as any,
    );
    const result = await handler.execute("hitl-1", "op-1");

    expect(result.isOk()).toBe(true);
    expect(deployMock).toHaveBeenCalledWith(
      expect.objectContaining({ projectId: "proj-1" }),
    );
    expect(projectRepo.save).toHaveBeenCalled();
  });

  it("não chama deploymentRouter para outros action types", async () => {
    const approval = makeApproval(HITLActionType.APPROVE_LEAD_LIST, {});

    const repo = {
      findById: vi.fn().mockResolvedValue(approval),
      save: vi.fn(),
    };

    const deployMock = vi.fn();
    const deploymentRouter = { deploy: deployMock };

    const handler = new ApproveHITLHandler(
      repo as any,
      undefined,
      deploymentRouter as any,
    );
    await handler.execute("hitl-2", "op-1");

    expect(deployMock).not.toHaveBeenCalled();
  });

  it("não quebra quando deploymentRouter não fornecido", async () => {
    const approval = makeApproval(HITLActionType.APPROVE_STAGING, {
      projectId: "proj-1",
    });

    const repo = {
      findById: vi.fn().mockResolvedValue(approval),
      save: vi.fn(),
    };

    const handler = new ApproveHITLHandler(repo as any);
    const result = await handler.execute("hitl-3", "op-1");

    expect(result.isOk()).toBe(true); // aprovação bem-sucedida sem deploy
  });
});
