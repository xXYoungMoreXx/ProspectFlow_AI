import { randomUUID } from "node:crypto";
import { Briefing } from "../../domain/briefing/Briefing.js";
import type { BriefingRepository } from "../../domain/briefing/BriefingRepository.js";
import { ConflictError } from "../../domain/shared/Result.js";
import { type Result, ok, err } from "../../domain/shared/Result.js";
import type { BriefingProps } from "../../domain/briefing/Briefing.js";

export interface StartBriefingCommand {
  dealId: string;
  operatorId: string;
  agentId?: string;
  nicheTemplate?: string;
  correlationId: string;
}

export class StartBriefingUseCase {
  constructor(private readonly repo: BriefingRepository) {}

  async execute(
    cmd: StartBriefingCommand,
  ): Promise<Result<BriefingProps, ConflictError | Error>> {
    const existing = await this.repo.findByDealId(cmd.dealId, cmd.operatorId);
    if (existing) {
      return err(
        new ConflictError(`Briefing already exists for deal ${cmd.dealId}`),
      );
    }

    const result = Briefing.create({
      id: randomUUID(),
      dealId: cmd.dealId,
      operatorId: cmd.operatorId,
      agentId: cmd.agentId,
      nicheTemplate: cmd.nicheTemplate,
    });

    if (result.isErr()) return err(result.error);

    const briefing = result.unwrap();
    await this.repo.save(briefing);

    return ok(briefing.toJSON());
  }
}
