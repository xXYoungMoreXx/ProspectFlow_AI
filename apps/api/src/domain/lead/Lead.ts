import { AggregateRoot } from "../shared/AggregateRoot.js";
import { createDomainEvent } from "../shared/DomainEvent.js";
import { ValidationError, ok, err, type Result } from "../shared/Result.js";
import type { LeadStatus, LeadSource } from "@agentepro/shared-types";

export interface ContactInfo {
  readonly name: string;
  readonly email?: string;
  readonly phone?: string;
  readonly company?: string;
  readonly website?: string;
}

export interface LeadProps {
  id: string;
  operatorId: string;
  assignedAgentId?: string;
  contact: ContactInfo;
  source: LeadSource;
  qualificationScore?: number;
  status: LeadStatus;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export class Lead extends AggregateRoot {
  private constructor(private props: LeadProps) {
    super();
  }

  static create(input: {
    id: string;
    operatorId: string;
    contact: ContactInfo;
    source: LeadSource;
    assignedAgentId?: string;
  }): Result<Lead, ValidationError> {
    if (input.contact.name.length < 1 || input.contact.name.length > 200) {
      return err(
        new ValidationError(
          "Contact name must be between 1 and 200 chars",
          "contact_name",
        ),
      );
    }

    const now = new Date();
    const lead = new Lead({
      id: input.id,
      operatorId: input.operatorId,
      assignedAgentId: input.assignedAgentId,
      contact: input.contact,
      source: input.source,
      status: "NEW",
      createdAt: now,
      updatedAt: now,
    });

    lead.addDomainEvent(
      createDomainEvent("lead.created", "Lead", input.id, {
        leadId: input.id,
        source: input.source,
        contactName: input.contact.name,
        city: undefined,
      }),
    );

    return ok(lead);
  }

  static reconstitute(props: LeadProps): Lead {
    return new Lead(props);
  }

  get id(): string {
    return this.props.id;
  }
  get operatorId(): string {
    return this.props.operatorId;
  }
  get assignedAgentId(): string | undefined {
    return this.props.assignedAgentId;
  }
  get contact(): ContactInfo {
    return this.props.contact;
  }
  get source(): LeadSource {
    return this.props.source;
  }
  get qualificationScore(): number | undefined {
    return this.props.qualificationScore;
  }
  get status(): LeadStatus {
    return this.props.status;
  }
  get notes(): string | undefined {
    return this.props.notes;
  }
  get createdAt(): Date {
    return this.props.createdAt;
  }
  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  qualify(score: number, agentId: string): Result<void, ValidationError> {
    if (score < 0 || score > 100) {
      return err(
        new ValidationError(
          "Score must be between 0 and 100",
          "qualification_score",
        ),
      );
    }
    this.props.qualificationScore = score;
    this.props.status = "QUALIFIED";
    this.props.updatedAt = new Date();
    this.addDomainEvent(
      createDomainEvent("lead.qualified", "Lead", this.props.id, {
        leadId: this.props.id,
        score,
        agentId,
      }),
    );
    return ok(undefined);
  }

  markContacted(): void {
    if (this.props.status === "NEW") {
      this.props.status = "CONTACTED";
      this.props.updatedAt = new Date();
    }
  }

  convert(dealId: string): Result<void, ValidationError> {
    if (this.props.status === "CONVERTED") {
      return err(new ValidationError("Lead is already converted"));
    }
    if (this.props.status === "LOST") {
      return err(new ValidationError("Cannot convert a lost lead"));
    }
    this.props.status = "CONVERTED";
    this.props.updatedAt = new Date();
    this.addDomainEvent(
      createDomainEvent("lead.converted", "Lead", this.props.id, {
        leadId: this.props.id,
        dealId,
      }),
    );
    return ok(undefined);
  }

  markLost(reason: string): void {
    this.props.status = "LOST";
    this.props.notes = reason;
    this.props.updatedAt = new Date();
    this.addDomainEvent(
      createDomainEvent("lead.lost", "Lead", this.props.id, {
        leadId: this.props.id,
        reason,
      }),
    );
  }

  updateStatus(status: LeadStatus): void {
    this.props.status = status;
    this.props.updatedAt = new Date();
  }

  toJSON(): LeadProps {
    return { ...this.props };
  }
}
