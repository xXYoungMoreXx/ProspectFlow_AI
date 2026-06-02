import { AggregateRoot } from "../shared/AggregateRoot.js";
import { createDomainEvent } from "../shared/DomainEvent.js";
import { ValidationError, ok, err, type Result } from "../shared/Result.js";
import type { ProjectStatus } from "@agentepro/shared-types";

export interface LighthouseScores {
  readonly performance?: number;
  readonly accessibility?: number;
  readonly seo?: number;
  readonly bestPractices?: number;
}

export interface ProjectProps {
  id: string;
  dealId: string;
  operatorId: string;
  assignedAgentId?: string;
  status: ProjectStatus;
  templateId?: string;
  briefing: Record<string, unknown>;
  deliverableUrl?: string;
  deliverableMeta: Record<string, unknown>;
  lighthouse: LighthouseScores;
  revisionCount: number;
  revisionNotes?: string;
  deliveredAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export class Project extends AggregateRoot {
  private constructor(private props: ProjectProps) {
    super();
  }

  static create(input: {
    id: string;
    dealId: string;
    operatorId: string;
    assignedAgentId?: string;
    templateId?: string;
    briefing: Record<string, unknown>;
  }): Result<Project, ValidationError> {
    const now = new Date();
    const project = new Project({
      id: input.id,
      dealId: input.dealId,
      operatorId: input.operatorId,
      assignedAgentId: input.assignedAgentId,
      status: "PLANNING",
      templateId: input.templateId,
      briefing: input.briefing,
      deliverableMeta: {},
      lighthouse: {},
      revisionCount: 0,
      createdAt: now,
      updatedAt: now,
    });

    project.addDomainEvent(
      createDomainEvent("project.started", "Project", input.id, {
        projectId: input.id,
        dealId: input.dealId,
        templateId: input.templateId,
      }),
    );

    return ok(project);
  }

  static reconstitute(props: ProjectProps): Project {
    return new Project(props);
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
  get status(): ProjectStatus {
    return this.props.status;
  }
  get deliverableUrl(): string | undefined {
    return this.props.deliverableUrl;
  }
  get lighthouse(): LighthouseScores {
    return this.props.lighthouse;
  }
  get revisionCount(): number {
    return this.props.revisionCount;
  }
  get createdAt(): Date {
    return this.props.createdAt;
  }
  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  storeBuildArtifact(html: string): void {
    this.props.deliverableMeta = {
      ...this.props.deliverableMeta,
      html,
      builtAt: new Date().toISOString(),
    };
    this.props.updatedAt = new Date();
  }

  markReadyForReview(previewUrl: string): void {
    this.props.status = "REVIEW";
    this.props.deliverableUrl = previewUrl;
    this.props.updatedAt = new Date();
    this.addDomainEvent(
      createDomainEvent("project.ready_for_review", "Project", this.props.id, {
        projectId: this.props.id,
        previewUrl,
      }),
    );
  }

  deliver(url: string, scores: LighthouseScores): void {
    this.props.status = "DELIVERED";
    this.props.deliverableUrl = url;
    this.props.lighthouse = scores;
    this.props.deliveredAt = new Date();
    this.props.updatedAt = new Date();
    this.addDomainEvent(
      createDomainEvent("project.delivered", "Project", this.props.id, {
        projectId: this.props.id,
        deliverableUrl: url,
        lighthousePerf: scores.performance,
      }),
    );
  }

  requestRevision(notes: string): Result<void, ValidationError> {
    if (this.props.status === "CANCELLED") {
      return err(
        new ValidationError("Cannot request revision on cancelled project"),
      );
    }
    if (this.props.revisionCount >= 3) {
      return err(new ValidationError("Maximum revision limit reached (3)"));
    }
    this.props.status = "REVISION";
    this.props.revisionCount += 1;
    this.props.revisionNotes = notes;
    this.props.updatedAt = new Date();
    this.addDomainEvent(
      createDomainEvent(
        "project.revision_requested",
        "Project",
        this.props.id,
        {
          projectId: this.props.id,
          notes,
          revisionNumber: this.props.revisionCount,
        },
      ),
    );
    return ok(undefined);
  }

  toJSON(): ProjectProps {
    return { ...this.props };
  }
}
