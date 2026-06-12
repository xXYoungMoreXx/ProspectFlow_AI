import { describe, it, expect, vi, beforeEach } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";
import { ApproveHITLHandler } from "../hitl.handlers.js";
import { HITLActionType } from "../../../domain/hitl/HITLActionType.js";
import { HITLApproval } from "../../../domain/hitl/HITLApproval.js";
import { HITLLevel } from "../../../domain/hitl/HITLLevel.js";
import { Project } from "../../../domain/project/Project.js";
import { ulid } from "ulid";

const PNG_BASE64 = Buffer.from([0x89]).toString("base64");

function makeApproval(
  actionType: HITLActionType,
  payloadPreview: Record<string, unknown>,
) {
  return HITLApproval.create({
    id: ulid(),
    operatorId: "op-1",
    agentId: "agent-1",
    hitlLevel: HITLLevel.HITL_1,
    actionType,
    contextType: "PROJECT",
    contextId: "proj-1",
    payloadPreview,
    timeoutMinutes: 120,
  }).unwrap();
}

function makeProject(deliverableMeta: Record<string, unknown>) {
  return Project.reconstitute({
    id: "proj-1",
    dealId: "deal-1",
    operatorId: "op-1",
    status: "PLANNING",
    briefing: { businessName: "Barbearia Top" },
    deliverableMeta,
    lighthouse: {},
    revisionCount: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

describe("ApproveHITLHandler — APPROVE_MOCKUP (F2: imagens + design_result)", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
    vi.stubGlobal("fetch", fetchMock);
  });

  it("gera imagens dos image_prompts e despacha builder.build com design_result + image_urls", async () => {
    const approval = makeApproval(HITLActionType.APPROVE_MOCKUP, {
      projectId: "proj-1",
    });
    const repo = {
      findById: vi.fn().mockResolvedValue(approval),
      save: vi.fn(),
    };
    const project = makeProject({
      designResult: {
        color_palette: ["#111"],
        image_prompts: ["foto barbeiro", "foto fachada"],
      },
    });
    const projectRepo = {
      findById: vi.fn().mockResolvedValue(project),
      save: vi.fn(),
    };
    const mediaRouter = {
      generate: vi.fn().mockResolvedValue({
        buffer: Buffer.from([0x89]),
        format: "png",
        provider: "test",
      }),
    };

    const handler = new ApproveHITLHandler(
      repo as never,
      projectRepo as never,
      undefined,
      undefined,
      mediaRouter as never,
    );
    const result = await handler.execute("hitl-1", "op-1");

    expect(result.isOk()).toBe(true);
    expect(mediaRouter.generate).toHaveBeenCalledTimes(2);
    expect(projectRepo.save).toHaveBeenCalled();
    expect(
      (project.deliverableMeta["assets"] as Array<{ path: string }>).map(
        (a) => a.path,
      ),
    ).toEqual(["assets/img-1.png", "assets/img-2.png"]);

    // dispatch do builder.build leva design_result completo + briefing
    const dispatchCall = fetchMock.mock.calls.find(([url]) =>
      String(url).endsWith("/tasks"),
    );
    expect(dispatchCall).toBeDefined();
    const body = JSON.parse((dispatchCall![1] as { body: string }).body) as {
      task_type: string;
      payload: {
        briefing: Record<string, unknown>;
        design_result: { image_urls?: string[] };
      };
    };
    expect(body.task_type).toBe("builder.build");
    expect(body.payload.briefing["businessName"]).toBe("Barbearia Top");
    expect(body.payload.design_result.image_urls).toEqual([
      "assets/img-1.png",
      "assets/img-2.png",
    ]);
  });

  it("falha de geração de imagem não bloqueia o dispatch (graceful)", async () => {
    const approval = makeApproval(HITLActionType.APPROVE_MOCKUP, {
      projectId: "proj-1",
    });
    const repo = {
      findById: vi.fn().mockResolvedValue(approval),
      save: vi.fn(),
    };
    const projectRepo = {
      findById: vi
        .fn()
        .mockResolvedValue(
          makeProject({ designResult: { image_prompts: ["x"] } }),
        ),
      save: vi.fn(),
    };
    const mediaRouter = {
      generate: vi.fn().mockRejectedValue(new Error("no provider")),
    };

    const handler = new ApproveHITLHandler(
      repo as never,
      projectRepo as never,
      undefined,
      undefined,
      mediaRouter as never,
    );
    const result = await handler.execute("hitl-2", "op-1");

    expect(result.isOk()).toBe(true);
    const dispatchCall = fetchMock.mock.calls.find(([url]) =>
      String(url).endsWith("/tasks"),
    );
    expect(dispatchCall).toBeDefined();
  });
});

describe("ApproveHITLHandler — APPROVE_STAGING escreve assets no deploy (F2)", () => {
  it("inclui assets/img-1.png no diretório enviado ao deploymentRouter", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }),
    );
    const approval = makeApproval(HITLActionType.APPROVE_STAGING, {
      projectId: "proj-1",
    });
    const repo = {
      findById: vi.fn().mockResolvedValue(approval),
      save: vi.fn(),
    };
    const projectRepo = {
      findById: vi.fn().mockResolvedValue(
        makeProject({
          html: "<html>site</html>",
          assets: [{ path: "assets/img-1.png", base64: PNG_BASE64 }],
        }),
      ),
      save: vi.fn(),
    };

    let sawAsset = false;
    const deploymentRouter = {
      deploy: vi
        .fn()
        .mockImplementation(async (opts: { sourceCodePath: string }) => {
          const assetFile = path.join(
            opts.sourceCodePath,
            "assets",
            "img-1.png",
          );
          sawAsset = (await fs.readFile(assetFile)).length === 1;
          return {
            isOk: () => true,
            unwrap: () => ({
              url: "https://live.example.com",
              provider: "vercel",
              deploymentId: "dep-1",
            }),
          };
        }),
    };

    const handler = new ApproveHITLHandler(
      repo as never,
      projectRepo as never,
      deploymentRouter as never,
    );
    const result = await handler.execute("hitl-3", "op-1");

    expect(result.isOk()).toBe(true);
    expect(deploymentRouter.deploy).toHaveBeenCalled();
    expect(sawAsset).toBe(true);
  });
});
