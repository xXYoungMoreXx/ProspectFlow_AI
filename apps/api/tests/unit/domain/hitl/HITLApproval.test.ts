import { describe, it, expect, vi } from 'vitest';
import { HITLApproval } from '../../../../src/domain/hitl/HITLApproval.js';

describe('HITLApproval Entity', () => {
  it('should create a valid approval and emit requested event', () => {
    const result = HITLApproval.create({
      id: 'hitl-1',
      operatorId: 'op-1',
      agentId: 'agent-1',
      actionType: 'SEND_PROPOSAL',
      contextType: 'DEAL',
      contextId: 'deal-1',
      payloadPreview: { value: 1000 },
      timeoutMinutes: 60,
    });

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      const approval = result.value;
      expect(approval.status).toBe('PENDING');
      expect(approval.isExpired).toBe(false);
      expect(approval.domainEvents.length).toBe(1);
      expect(approval.domainEvents[0].eventType).toBe('hitl.approval_requested');
    }
  });

  it('should fail creation with invalid timeout', () => {
    const result = HITLApproval.create({
      id: 'hitl-1',
      operatorId: 'op-1',
      agentId: 'agent-1',
      actionType: 'SEND_PROPOSAL',
      contextType: 'DEAL',
      contextId: 'deal-1',
      payloadPreview: { value: 1000 },
      timeoutMinutes: 0, // Invalid
    });

    expect(result.isErr()).toBe(true);
  });

  it('should approve successfully', () => {
    const approval = HITLApproval.create({
      id: 'hitl-1',
      operatorId: 'op-1',
      agentId: 'agent-1',
      actionType: 'SEND_PROPOSAL',
      contextType: 'DEAL',
      contextId: 'deal-1',
      payloadPreview: { value: 1000 },
      timeoutMinutes: 60,
    }).unwrap();

    approval.clearDomainEvents();

    const approveResult = approval.approve('Looks good');
    expect(approveResult.isOk()).toBe(true);
    expect(approval.status).toBe('APPROVED');
    expect(approval.operatorNote).toBe('Looks good');
    expect(approval.domainEvents.length).toBe(1);
    expect(approval.domainEvents[0].eventType).toBe('hitl.approval_decided');
  });

  it('should reject successfully', () => {
    const approval = HITLApproval.create({
      id: 'hitl-1',
      operatorId: 'op-1',
      agentId: 'agent-1',
      actionType: 'SEND_PROPOSAL',
      contextType: 'DEAL',
      contextId: 'deal-1',
      payloadPreview: { value: 1000 },
      timeoutMinutes: 60,
    }).unwrap();

    approval.clearDomainEvents();

    const rejectResult = approval.reject('Price is too low');
    expect(rejectResult.isOk()).toBe(true);
    expect(approval.status).toBe('REJECTED');
    expect(approval.operatorNote).toBe('Price is too low');
    expect(approval.domainEvents.length).toBe(1);
    expect(approval.domainEvents[0].eventType).toBe('hitl.approval_decided');
  });

  it('should expire successfully', () => {
    const approval = HITLApproval.create({
      id: 'hitl-1',
      operatorId: 'op-1',
      agentId: 'agent-1',
      actionType: 'SEND_PROPOSAL',
      contextType: 'DEAL',
      contextId: 'deal-1',
      payloadPreview: { value: 1000 },
      timeoutMinutes: 60,
    }).unwrap();

    // Mock date to be in the future
    vi.useFakeTimers();
    vi.setSystemTime(new Date(Date.now() + 61 * 60 * 1000));

    expect(approval.isExpired).toBe(true);

    approval.clearDomainEvents();

    approval.expire();
    expect(approval.status).toBe('EXPIRED');
    expect(approval.domainEvents.length).toBe(0);

    vi.useRealTimers();
  });
});
