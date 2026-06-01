import { AggregateRoot } from "../shared/AggregateRoot.js";
import { createDomainEvent } from "../shared/DomainEvent.js";
import { ValidationError, ok, err, type Result } from "../shared/Result.js";

export type BriefingStatus = "IN_PROGRESS" | "COMPLETED" | "APPROVED";

export interface BriefingProps {
  id: string;
  dealId: string;
  operatorId: string;
  agentId?: string;
  status: BriefingStatus;
  nicheTemplate?: string;
  briefingData: Record<string, unknown>;
  interviewTranscriptRef?: string;
  approvedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export class Briefing extends AggregateRoot {
  private constructor(private props: BriefingProps) {
    super();
  }

  static create(input: {
    id: string;
    dealId: string;
    operatorId: string;
    agentId?: string;
    nicheTemplate?: string;
  }): Result<Briefing, ValidationError> {
    if (!input.dealId) {
      return err(new ValidationError("dealId is required", "dealId"));
    }

    const now = new Date();
    const briefing = new Briefing({
      id: input.id,
      dealId: input.dealId,
      operatorId: input.operatorId,
      agentId: input.agentId,
      status: "IN_PROGRESS",
      nicheTemplate: input.nicheTemplate,
      briefingData: {},
      createdAt: now,
      updatedAt: now,
    });

    briefing.addDomainEvent(
      createDomainEvent("briefing.created", "Briefing", input.id, {
        briefingId: input.id,
        dealId: input.dealId,
      }),
    );

    return ok(briefing);
  }

  static reconstitute(props: BriefingProps): Briefing {
    return new Briefing(props);
  }

  get id(): string {
    return this.props.id;
  }
  get dealId(): string {
    return this.props.dealId;
  }
  get operatorId(): string {
    return this.props.operatorId;
  }
  get agentId(): string | undefined {
    return this.props.agentId;
  }
  get status(): BriefingStatus {
    return this.props.status;
  }
  get nicheTemplate(): string | undefined {
    return this.props.nicheTemplate;
  }
  get briefingData(): Record<string, unknown> {
    return this.props.briefingData;
  }
  get interviewTranscriptRef(): string | undefined {
    return this.props.interviewTranscriptRef;
  }
  get approvedAt(): Date | undefined {
    return this.props.approvedAt;
  }
  get createdAt(): Date {
    return this.props.createdAt;
  }
  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  complete(
    data: Record<string, unknown>,
    transcriptRef?: string,
  ): Result<void, ValidationError> {
    if (this.props.status !== "IN_PROGRESS") {
      return err(
        new ValidationError(
          `Cannot complete briefing: expected IN_PROGRESS but status is ${this.props.status}`,
          "status",
        ),
      );
    }

    this.props.briefingData = data;
    this.props.interviewTranscriptRef = transcriptRef;
    this.props.status = "COMPLETED";
    this.props.updatedAt = new Date();

    this.addDomainEvent(
      createDomainEvent("briefing.completed", "Briefing", this.props.id, {
        briefingId: this.props.id,
        dealId: this.props.dealId,
      }),
    );

    return ok(undefined);
  }

  approve(): Result<void, ValidationError> {
    if (this.props.status !== "COMPLETED") {
      return err(
        new ValidationError(
          `Cannot approve briefing: expected COMPLETED but status is ${this.props.status}`,
          "status",
        ),
      );
    }

    const now = new Date();
    this.props.status = "APPROVED";
    this.props.approvedAt = now;
    this.props.updatedAt = now;

    this.addDomainEvent(
      createDomainEvent("briefing.approved", "Briefing", this.props.id, {
        briefingId: this.props.id,
        dealId: this.props.dealId,
        approvedAt: now.toISOString(),
      }),
    );

    return ok(undefined);
  }

  // APPROVED is a terminal state — no transitions allowed out of it
  get isTerminal(): boolean {
    return this.props.status === "APPROVED";
  }

  toJSON(): BriefingProps {
    return { ...this.props };
  }
}
