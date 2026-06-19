import type { Deal } from "./Deal.js";
import type { DealStatus } from "@hefesto/shared-types";

export interface DealFilters {
  operatorId: string;
  organizationId: string;
  status?: DealStatus;
  leadId?: string;
  cursor?: string;
  limit?: number;
}

export interface DealListResult {
  deals: Deal[];
  total: number;
  nextCursor: string | null;
}

export interface DealRepository {
  findById(
    id: string,
    operatorId: string,
    organizationId: string,
  ): Promise<Deal | null>;
  /** Internal use only — skips tenant check. Use for event handlers / workers. */
  findByIdInternal(id: string): Promise<Deal | null>;
  findMany(filters: DealFilters): Promise<DealListResult>;
  save(deal: Deal): Promise<void>;
}
