import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { HITLApprovalRepository } from "../../domain/hitl/HITLApprovalRepository.js";
import {
  NotFoundError,
  ok,
  err,
  type Result,
} from "../../domain/shared/Result.js";
import type { HITLApproval } from "../../domain/hitl/HITLApproval.js";
import { HITLActionType } from "../../domain/hitl/HITLActionType.js";
import type { ProjectRepository } from "../../domain/project/ProjectRepository.js";
import type { DeploymentRouter } from "../../infrastructure/deploy/DeploymentRouter.js";
import { hitlPendingGauge } from "../../infrastructure/metrics/registry.js";

export class GetPendingApprovalsHandler {
  constructor(private readonly repo: HITLApprovalRepository) {}

  async execute(operatorId: string): Promise<HITLApproval[]> {
    return this.repo.findPending(operatorId);
  }
}

export class ApproveHITLHandler {
  constructor(
    private readonly repo: HITLApprovalRepository,
    private readonly projectRepo?: ProjectRepository,
    private readonly deploymentRouter?: DeploymentRouter,
  ) {}

  async execute(
    approvalId: string,
    operatorId: string,
    note?: string,
  ): Promise<Result<HITLApproval, Error>> {
    const approval = await this.repo.findById(approvalId, operatorId);
    if (!approval) return err(new NotFoundError("HITLApproval", approvalId));

    const result = approval.approve(note);
    if (result.isErr()) return result;

    await this.repo.save(approval);

    hitlPendingGauge.dec({ operator_id: operatorId });

    // Bridge: Notify Python Agent Runtime that this is approved
    try {
      const runtimeUrl =
        process.env["AGENT_RUNTIME_URL"] || "http://localhost:8001";
      await fetch(`${runtimeUrl}/tasks/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: approval.agentId,
          approval_id: approval.id,
          operator_id: operatorId,
        }),
      });
      console.info("[ApproveHITLHandler] Notified Agent Runtime of approval", {
        approvalId,
      });
    } catch (error) {
      console.error("[ApproveHITLHandler] Failed to notify Agent Runtime", {
        approvalId,
        error,
      });
    }

    // APPROVE_MOCKUP: dispatch builder.build phase after mockup approved by operator
    if (
      approval.actionType === HITLActionType.APPROVE_MOCKUP &&
      this.agentRuntimeClient
    ) {
      const projectId = (approval.payloadPreview as Record<string, unknown>)?.[
        "projectId"
      ] as string | undefined;
      await this.agentRuntimeClient.dispatch({
        task_type: "builder.build",
        agent_id: approval.agentId.value,
        project_id: projectId,
        operator_id: operatorId,
        correlation_id: approval.id.value,
        payload: { approved: true },
      });
    }

    // APPROVE_STAGING: trigger deployment after HITL approved
    if (
      approval.actionType === HITLActionType.APPROVE_STAGING &&
      this.projectRepo &&
      this.deploymentRouter
    ) {
      await this.triggerDeploy(approval, operatorId);
    }

    return ok(approval);
  }

  private async triggerDeploy(
    approval: HITLApproval,
    operatorId: string,
  ): Promise<void> {
    const projectId = (approval.payloadPreview as Record<string, unknown>)?.[
      "projectId"
    ] as string | undefined;
    if (!projectId) {
      console.warn(
        "[ApproveHITLHandler] APPROVE_STAGING: no projectId in payload",
      );
      return;
    }

    const project = await this.projectRepo!.findById(projectId, operatorId);
    if (!project) {
      console.warn(
        `[ApproveHITLHandler] APPROVE_STAGING: project ${projectId} not found`,
      );
      return;
    }

    const html = (project.deliverableMeta as Record<string, unknown>)?.[
      "html"
    ] as string | undefined;
    if (!html) {
      console.warn(
        `[ApproveHITLHandler] APPROVE_STAGING: no build artifact for project ${projectId}`,
      );
      return;
    }

    let tmpDir: string | undefined;
    try {
      tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "agentepro-deploy-"));
      await fs.writeFile(path.join(tmpDir, "index.html"), html, "utf8");

      const deployResult = await this.deploymentRouter!.deploy({
        projectId,
        sourceCodePath: tmpDir,
        requireHITL: false, // HITL already approved — invariant guaranteed
      });

      if (deployResult.isOk()) {
        const { url } = deployResult.unwrap();
        project.deliver(url, {
          performance: 0,
          accessibility: 0,
          seo: 0,
          bestPractices: 0,
        });
        await this.projectRepo!.save(project);
        console.info(
          `[ApproveHITLHandler] Deployed project ${projectId} → ${url}`,
        );
      } else {
        console.error(
          `[ApproveHITLHandler] Deploy failed for project ${projectId}`,
        );
      }
    } catch (err) {
      console.error("[ApproveHITLHandler] triggerDeploy error:", err);
    } finally {
      if (tmpDir) {
        await fs
          .rm(tmpDir, { recursive: true, force: true })
          .catch(() => undefined);
      }
    }
  }
}

export class RejectHITLHandler {
  constructor(private readonly repo: HITLApprovalRepository) {}

  async execute(
    approvalId: string,
    operatorId: string,
    note?: string,
  ): Promise<Result<HITLApproval, Error>> {
    const approval = await this.repo.findById(approvalId, operatorId);
    if (!approval) return err(new NotFoundError("HITLApproval", approvalId));

    const result = approval.reject(note);
    if (result.isErr()) return result;

    await this.repo.save(approval);
    hitlPendingGauge.dec({ operator_id: operatorId });
    return ok(approval);
  }
}

export class EditAndApproveHITLHandler {
  constructor(private readonly repo: HITLApprovalRepository) {}

  async execute(
    approvalId: string,
    operatorId: string,
    editedPayload: Record<string, unknown>,
    note?: string,
  ): Promise<Result<HITLApproval, Error>> {
    const approval = await this.repo.findById(approvalId, operatorId);
    if (!approval) return err(new NotFoundError("HITLApproval", approvalId));

    const result = approval.editAndApprove(editedPayload, note);
    if (result.isErr()) return result;

    await this.repo.save(approval);
    hitlPendingGauge.dec({ operator_id: operatorId });
    return ok(approval);
  }
}
