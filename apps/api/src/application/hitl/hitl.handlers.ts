import type { HITLApprovalRepository } from "../../domain/hitl/HITLApprovalRepository.js";
import {
  NotFoundError,
  ok,
  err,
  type Result,
} from "../../domain/shared/Result.js";
import type { HITLApproval } from "../../domain/hitl/HITLApproval.js";
import { HITLActionType } from "../../domain/hitl/HITLActionType.js";
import { hitlPendingGauge } from "../../infrastructure/metrics/registry.js";

export class GetPendingApprovalsHandler {
  constructor(private readonly repo: HITLApprovalRepository) {}

  async execute(operatorId: string): Promise<HITLApproval[]> {
    return this.repo.findPending(operatorId);
  }
}

export class ApproveHITLHandler {
  constructor(private readonly repo: HITLApprovalRepository) {}

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
          session_id: approval.agentId, // Using agentId as session_id context
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
      // Non-fatal for the Node API, but the agent won't unblock until retried
    }

    // Dispatch task-specific follow-up to Python Runtime
    if (approval.actionType === HITLActionType.APPROVE_MOCKUP) {
      try {
        const runtimeUrl =
          process.env["AGENT_RUNTIME_URL"] || "http://localhost:8001";
        await fetch(`${runtimeUrl}/tasks`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            task_type: "builder.build",
            agent_id: approval.agentId,
            project_id: approval.contextId,
            operator_id: operatorId,
            correlation_id: approvalId,
            payload: {
              approved: true,
              feedback: note ?? null,
            },
          }),
        });
        console.info(
          "[ApproveHITLHandler] mockup approved — builder.build dispatched",
          { approvalId },
        );
      } catch (error) {
        console.error("[ApproveHITLHandler] Failed to dispatch builder.build", {
          approvalId,
          error,
        });
      }
    }

    return ok(approval);
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

    // Dispatch task-specific retry on rejection
    if (approval.actionType === HITLActionType.APPROVE_MOCKUP) {
      try {
        const runtimeUrl =
          process.env["AGENT_RUNTIME_URL"] || "http://localhost:8001";
        await fetch(`${runtimeUrl}/tasks`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            task_type: "builder.design",
            agent_id: approval.agentId,
            project_id: approval.contextId,
            operator_id: operatorId,
            correlation_id: approvalId,
            payload: {
              feedback:
                note ?? "Refaça o mockup com base no feedback do operador.",
              retry: true,
            },
          }),
        });
        console.info(
          "[RejectHITLHandler] mockup rejected — builder.design retry dispatched",
          { approvalId },
        );
      } catch (error) {
        console.error(
          "[RejectHITLHandler] Failed to dispatch builder.design retry",
          { approvalId, error },
        );
      }
    }

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
