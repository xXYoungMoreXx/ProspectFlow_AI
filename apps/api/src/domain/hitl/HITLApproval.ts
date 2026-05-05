import { AggregateRoot } from '../shared/AggregateRoot.js';
import { createDomainEvent } from '../shared/DomainEvent.js';
import { ValidationError, ok, err, type Result } from '../shared/Result.js';
import type { HITLStatus } from '@agentepro/shared-types';

export interface HITLApprovalProps {
  id: string;
  operatorId: string;
  agentId: string;
  actionType: string;
  contextType: string;
  contextId: string;
  payloadPreview: Record<string, unknown>;
  payloadFullRef?: string;
  status: HITLStatus;
  expiresAt: Date;
  decidedAt?: Date;
  operatorNote?: string;
  createdAt: Date;
}

export class HITLApproval extends AggregateRoot {
  private constructor(private props: HITLApprovalProps) {
    super();
  }

  static create(input: {
    id: string;
    operatorId: string;
    agentId: string;
    actionType: string;
    contextType: string;
    contextId: string;
    payloadPreview: Record<string, unknown>;
    payloadFullRef?: string;
    timeoutMinutes: number;
  }): Result<HITLApproval, ValidationError> {
    if (input.timeoutMinutes < 1 || input.timeoutMinutes > 1440) {
      return err(new ValidationError('Timeout must be between 1 and 1440 minutes'));
    }

    const now = new Date();
    const expiresAt = new Date(now.getTime() + input.timeoutMinutes * 60 * 1000);

    const approval = new HITLApproval({
      id: input.id,
      operatorId: input.operatorId,
      agentId: input.agentId,
      actionType: input.actionType,
      contextType: input.contextType,
      contextId: input.contextId,
      payloadPreview: input.payloadPreview,
      payloadFullRef: input.payloadFullRef,
      status: 'PENDING',
      expiresAt,
      createdAt: now,
    });

    approval.addDomainEvent(
      createDomainEvent('hitl.approval_requested', 'HITLApproval', input.id, {
        approvalId: input.id,
        actionType: input.actionType,
        contextType: input.contextType,
        contextId: input.contextId,
      }),
    );

    return ok(approval);
  }

  static reconstitute(props: HITLApprovalProps): HITLApproval {
    return new HITLApproval(props);
  }

  get id(): string { return this.props.id; }
  get operatorId(): string { return this.props.operatorId; }
  get agentId(): string { return this.props.agentId; }
  get actionType(): string { return this.props.actionType; }
  get contextType(): string { return this.props.contextType; }
  get contextId(): string { return this.props.contextId; }
  get payloadPreview(): Record<string, unknown> { return this.props.payloadPreview; }
  get status(): HITLStatus { return this.props.status; }
  get expiresAt(): Date { return this.props.expiresAt; }
  get decidedAt(): Date | undefined { return this.props.decidedAt; }
  get operatorNote(): string | undefined { return this.props.operatorNote; }
  get createdAt(): Date { return this.props.createdAt; }

  get isExpired(): boolean {
    return this.props.status === 'PENDING' && new Date() > this.props.expiresAt;
  }

  approve(note?: string): Result<void, ValidationError> {
    if (this.props.status !== 'PENDING') {
      return err(new ValidationError(`Cannot approve: status is ${this.props.status}`));
    }
    if (this.isExpired) {
      return err(new ValidationError('Approval has expired'));
    }
    this.props.status = 'APPROVED';
    this.props.decidedAt = new Date();
    this.props.operatorNote = note;
    this.addDomainEvent(
      createDomainEvent('hitl.approval_decided', 'HITLApproval', this.props.id, {
        approvalId: this.props.id,
        decision: 'APPROVED',
        operatorNote: note,
      }),
    );
    return ok(undefined);
  }

  reject(note?: string): Result<void, ValidationError> {
    if (this.props.status !== 'PENDING') {
      return err(new ValidationError(`Cannot reject: status is ${this.props.status}`));
    }
    this.props.status = 'REJECTED';
    this.props.decidedAt = new Date();
    this.props.operatorNote = note;
    this.addDomainEvent(
      createDomainEvent('hitl.approval_decided', 'HITLApproval', this.props.id, {
        approvalId: this.props.id,
        decision: 'REJECTED',
        operatorNote: note,
      }),
    );
    return ok(undefined);
  }

  editAndApprove(editedPayload: Record<string, unknown>, note?: string): Result<void, ValidationError> {
    if (this.props.status !== 'PENDING') {
      return err(new ValidationError(`Cannot edit: status is ${this.props.status}`));
    }
    if (this.isExpired) {
      return err(new ValidationError('Approval has expired'));
    }
    this.props.payloadPreview = editedPayload;
    this.props.status = 'EDITED_APPROVED';
    this.props.decidedAt = new Date();
    this.props.operatorNote = note;
    this.addDomainEvent(
      createDomainEvent('hitl.approval_decided', 'HITLApproval', this.props.id, {
        approvalId: this.props.id,
        decision: 'EDITED_APPROVED',
        operatorNote: note,
      }),
    );
    return ok(undefined);
  }

  expire(): void {
    if (this.props.status === 'PENDING') {
      this.props.status = 'EXPIRED';
      this.props.decidedAt = new Date();
    }
  }

  toJSON(): HITLApprovalProps {
    return { ...this.props };
  }
}
