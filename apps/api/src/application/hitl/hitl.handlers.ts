import type { HITLApprovalRepository } from '../../domain/hitl/HITLApprovalRepository.js';
import { NotFoundError, ok, err, type Result } from '../../domain/shared/Result.js';
import type { HITLApproval } from '../../domain/hitl/HITLApproval.js';

export class GetPendingApprovalsHandler {
  constructor(private readonly repo: HITLApprovalRepository) {}

  async execute(operatorId: string): Promise<HITLApproval[]> {
    return this.repo.findPending(operatorId);
  }
}

export class ApproveHITLHandler {
  constructor(private readonly repo: HITLApprovalRepository) {}

  async execute(approvalId: string, operatorId: string, note?: string): Promise<Result<HITLApproval, Error>> {
    const approval = await this.repo.findById(approvalId, operatorId);
    if (!approval) return err(new NotFoundError('HITLApproval', approvalId));

    const result = approval.approve(note);
    if (result.isErr()) return result;

    await this.repo.save(approval);
    return ok(approval);
  }
}

export class RejectHITLHandler {
  constructor(private readonly repo: HITLApprovalRepository) {}

  async execute(approvalId: string, operatorId: string, note?: string): Promise<Result<HITLApproval, Error>> {
    const approval = await this.repo.findById(approvalId, operatorId);
    if (!approval) return err(new NotFoundError('HITLApproval', approvalId));

    const result = approval.reject(note);
    if (result.isErr()) return result;

    await this.repo.save(approval);
    return ok(approval);
  }
}

export class EditAndApproveHITLHandler {
  constructor(private readonly repo: HITLApprovalRepository) {}

  async execute(approvalId: string, operatorId: string, editedPayload: Record<string, unknown>, note?: string): Promise<Result<HITLApproval, Error>> {
    const approval = await this.repo.findById(approvalId, operatorId);
    if (!approval) return err(new NotFoundError('HITLApproval', approvalId));

    const result = approval.editAndApprove(editedPayload, note);
    if (result.isErr()) return result;

    await this.repo.save(approval);
    return ok(approval);
  }
}
