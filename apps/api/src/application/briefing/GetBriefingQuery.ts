import type { BriefingRepository } from "../../domain/briefing/BriefingRepository.js";
import type { BriefingProps } from "../../domain/briefing/Briefing.js";
import { NotFoundError } from "../../domain/shared/Result.js";
import { type Result, ok, err } from "../../domain/shared/Result.js";

export interface GetBriefingInput {
  id: string;
  operatorId: string;
  organizationId: string;
}

export class GetBriefingQuery {
  constructor(private readonly repo: BriefingRepository) {}

  async execute(
    input: GetBriefingInput,
  ): Promise<Result<BriefingProps, NotFoundError>> {
    const briefing = await this.repo.findById(
      input.id,
      input.operatorId,
      input.organizationId,
    );
    if (!briefing) {
      return err(new NotFoundError("Briefing", input.id));
    }
    return ok(briefing.toJSON());
  }
}
