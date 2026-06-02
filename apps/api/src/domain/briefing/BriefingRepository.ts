import type { Briefing } from "./Briefing.js";

export interface BriefingRepository {
  findById(id: string, operatorId: string): Promise<Briefing | null>;
  findByDealId(dealId: string, operatorId: string): Promise<Briefing | null>;
  listByOperator(
    operatorId: string,
    limit: number,
    offset?: number,
  ): Promise<Briefing[]>;
  save(briefing: Briefing): Promise<void>;
}
