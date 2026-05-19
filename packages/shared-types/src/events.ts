/**
 * Domain Events — immutable, carry timestamp + correlation ID
 * Aligned with PRD §7 Domain Events specification
 */

export interface DomainEventBase {
  readonly eventId: string;
  readonly eventType: string;
  readonly aggregateId: string;
  readonly aggregateType: string;
  readonly occurredAt: string; // ISO 8601
  readonly correlationId: string; // UUID for distributed tracing
  readonly causationId?: string; // Event that caused this one
}

// ─── Agent Events ────────────────────────────────────────────────────────────

export interface AgentActivatedEvent extends DomainEventBase {
  readonly eventType: "agent.activated";
  readonly aggregateType: "Agent";
  readonly payload: { agentId: string; persona: string };
}

export interface AgentPausedEvent extends DomainEventBase {
  readonly eventType: "agent.paused";
  readonly aggregateType: "Agent";
  readonly payload: { agentId: string; reason?: string };
}

export interface AgentTaskCompletedEvent extends DomainEventBase {
  readonly eventType: "agent.task_completed";
  readonly aggregateType: "Agent";
  readonly payload: {
    agentId: string;
    taskType: string;
    durationMs: number;
    tokensUsed: number;
  };
}

export interface AgentTaskFailedEvent extends DomainEventBase {
  readonly eventType: "agent.task_failed";
  readonly aggregateType: "Agent";
  readonly payload: {
    agentId: string;
    taskType: string;
    errorCode: string;
    errorMessage: string;
  };
}

// ─── Lead Events ─────────────────────────────────────────────────────────────

export interface LeadCreatedEvent extends DomainEventBase {
  readonly eventType: "lead.created";
  readonly aggregateType: "Lead";
  readonly payload: {
    leadId: string;
    source: string;
    contactName: string;
    city?: string;
  };
}

export interface LeadQualifiedEvent extends DomainEventBase {
  readonly eventType: "lead.qualified";
  readonly aggregateType: "Lead";
  readonly payload: { leadId: string; score: number; agentId: string };
}

export interface LeadConvertedEvent extends DomainEventBase {
  readonly eventType: "lead.converted";
  readonly aggregateType: "Lead";
  readonly payload: { leadId: string; dealId: string };
}

export interface LeadLostEvent extends DomainEventBase {
  readonly eventType: "lead.lost";
  readonly aggregateType: "Lead";
  readonly payload: { leadId: string; reason: string };
}

// ─── Deal Events ─────────────────────────────────────────────────────────────

export interface DealProposedEvent extends DomainEventBase {
  readonly eventType: "deal.proposed";
  readonly aggregateType: "Deal";
  readonly payload: { dealId: string; leadId: string; totalCents: number };
}

export interface DealClosedEvent extends DomainEventBase {
  readonly eventType: "deal.closed";
  readonly aggregateType: "Deal";
  readonly payload: {
    dealId: string;
    leadId: string;
    totalCents: number;
    serviceType: string;
  };
}

export interface DealCancelledEvent extends DomainEventBase {
  readonly eventType: "deal.cancelled";
  readonly aggregateType: "Deal";
  readonly payload: { dealId: string; reason: string };
}

// ─── Project Events ──────────────────────────────────────────────────────────

export interface ProjectStartedEvent extends DomainEventBase {
  readonly eventType: "project.started";
  readonly aggregateType: "Project";
  readonly payload: { projectId: string; dealId: string; templateId?: string };
}

export interface ProjectReadyForReviewEvent extends DomainEventBase {
  readonly eventType: "project.ready_for_review";
  readonly aggregateType: "Project";
  readonly payload: { projectId: string; previewUrl: string };
}

export interface ProjectDeliveredEvent extends DomainEventBase {
  readonly eventType: "project.delivered";
  readonly aggregateType: "Project";
  readonly payload: {
    projectId: string;
    deliverableUrl: string;
    lighthousePerf?: number;
  };
}

export interface RevisionRequestedEvent extends DomainEventBase {
  readonly eventType: "project.revision_requested";
  readonly aggregateType: "Project";
  readonly payload: {
    projectId: string;
    notes: string;
    revisionNumber: number;
  };
}

// ─── HITL Events ─────────────────────────────────────────────────────────────

export interface HITLApprovalRequestedEvent extends DomainEventBase {
  readonly eventType: "hitl.approval_requested";
  readonly aggregateType: "HITLApproval";
  readonly payload: {
    approvalId: string;
    actionType: string;
    contextType: string;
    contextId: string;
  };
}

export interface HITLApprovalDecidedEvent extends DomainEventBase {
  readonly eventType: "hitl.approval_decided";
  readonly aggregateType: "HITLApproval";
  readonly payload: {
    approvalId: string;
    decision: string;
    operatorNote?: string;
  };
}

// ─── Message Events ──────────────────────────────────────────────────────────

export interface MessageSentEvent extends DomainEventBase {
  readonly eventType: "message.sent";
  readonly aggregateType: "Message";
  readonly payload: {
    messageId: string;
    leadId: string;
    channel: string;
    direction: "OUTBOUND";
  };
}

export interface MessageReceivedEvent extends DomainEventBase {
  readonly eventType: "message.received";
  readonly aggregateType: "Message";
  readonly payload: {
    messageId: string;
    leadId: string;
    channel: string;
    direction: "INBOUND";
  };
}

// Union type of all domain events
export type DomainEvent =
  | AgentActivatedEvent
  | AgentPausedEvent
  | AgentTaskCompletedEvent
  | AgentTaskFailedEvent
  | LeadCreatedEvent
  | LeadQualifiedEvent
  | LeadConvertedEvent
  | LeadLostEvent
  | DealProposedEvent
  | DealClosedEvent
  | DealCancelledEvent
  | ProjectStartedEvent
  | ProjectReadyForReviewEvent
  | ProjectDeliveredEvent
  | RevisionRequestedEvent
  | HITLApprovalRequestedEvent
  | HITLApprovalDecidedEvent
  | MessageSentEvent
  | MessageReceivedEvent;
