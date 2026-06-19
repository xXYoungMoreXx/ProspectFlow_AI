import type { Lead } from "./Lead.js";
import type { LeadStatus } from "@hefesto/shared-types";

export interface LeadFilters {
  operatorId: string;
  organizationId: string;
  status?: LeadStatus;
  assignedAgentId?: string;
  search?: string;
  cursor?: string;
  limit?: number;
}

export interface LeadListResult {
  leads: Lead[];
  total: number;
  nextCursor: string | null;
}

export interface LeadRepository {
  findById(
    id: string,
    operatorId: string,
    organizationId: string,
  ): Promise<Lead | null>;
  findMany(filters: LeadFilters): Promise<LeadListResult>;
  save(lead: Lead): Promise<void>;
}
