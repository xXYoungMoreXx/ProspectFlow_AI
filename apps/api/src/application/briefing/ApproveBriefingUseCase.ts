import type { BriefingRepository } from "../../domain/briefing/BriefingRepository.js";
import type { BriefingProps } from "../../domain/briefing/Briefing.js";
import { NotFoundError } from "../../domain/shared/Result.js";
import { type Result, ok, err } from "../../domain/shared/Result.js";
import type { BullMQAdapter } from "../../infrastructure/queue/BullMQAdapter.js";

export interface ApproveBriefingCommand {
  briefingId: string;
  operatorId: string;
  organizationId: string;
  correlationId: string;
}

export class ApproveBriefingUseCase {
  constructor(
    private readonly repo: BriefingRepository,
    private readonly queue: BullMQAdapter,
  ) {}

  async execute(
    cmd: ApproveBriefingCommand,
  ): Promise<Result<BriefingProps, Error>> {
    const briefing = await this.repo.findById(
      cmd.briefingId,
      cmd.operatorId,
      cmd.organizationId,
    );
    if (!briefing) {
      return err(new NotFoundError("Briefing", cmd.briefingId));
    }

    const result = briefing.approve();
    if (result.isErr()) return err(result.error);

    await this.repo.save(briefing);

    const events = briefing.clearDomainEvents();
    for (const event of events) {
      await this.queue.publishEvent(event);
    }

    // Phase 1 of 2-stage build: COPYWRITER+DESIGNER+IMAGER → HITL APPROVE_MOCKUP
    // On operator approval: builder.build (phase 2) → CODER → SEO+DEPLOY → HITL APPROVE_STAGING
    await this.queue.enqueueAgentTask(
      "builder.design",
      {
        briefingId: briefing.id,
        dealId: briefing.dealId,
        briefing: briefing.briefingData,
      },
      cmd.correlationId,
    );

    return ok(briefing.toJSON());
  }
}
