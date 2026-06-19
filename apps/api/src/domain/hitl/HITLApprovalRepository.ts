import type { HITLApproval } from "./HITLApproval.js";
import type { HITLStatus } from "@hefesto/shared-types";

export interface HITLFilters {
  operatorId: string;
  organizationId: string;
  status?: HITLStatus;
  agentId?: string;
  cursor?: string;
  limit?: number;
}

export interface HITLListResult {
  approvals: HITLApproval[];
  total: number;
  nextCursor: string | null;
}

export interface HITLApprovalRepository {
  findById(
    id: string,
    operatorId: string,
    organizationId: string,
  ): Promise<HITLApproval | null>;
  findPending(
    operatorId: string,
    organizationId: string,
  ): Promise<HITLApproval[]>;
  findMany(filters: HITLFilters): Promise<HITLListResult>;
  findExpired(): Promise<HITLApproval[]>;
  save(approval: HITLApproval): Promise<void>;
}
