import type { BriefingRepository } from "../../domain/briefing/BriefingRepository.js";
import type { BriefingProps } from "../../domain/briefing/Briefing.js";
import { type Result, ok } from "../../domain/shared/Result.js";

export interface ListBriefingsInput {
  operatorId: string;
  limit?: number;
  offset?: number;
}

export class ListBriefingsQuery {
  constructor(private readonly repo: BriefingRepository) {}

  async execute(
    input: ListBriefingsInput,
  ): Promise<Result<BriefingProps[], never>> {
    const limit = input.limit ?? 50;
    const briefings = await this.repo.listByOperator(
      input.operatorId,
      limit,
      input.offset,
    );
    return ok(briefings.map((b) => b.toJSON()));
  }
}
