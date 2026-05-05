import type { Deal } from './Deal.js';
import type { DealStatus } from '@agentepro/shared-types';

export interface DealFilters {
  operatorId: string;
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
  findById(id: string, operatorId: string): Promise<Deal | null>;
  findMany(filters: DealFilters): Promise<DealListResult>;
  save(deal: Deal): Promise<void>;
}
