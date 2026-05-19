import type { HITLApproval } from "./HITLApproval.js";
import type { HITLStatus } from "@agentepro/shared-types";

export interface HITLFilters {
  operatorId: string;
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
  findById(id: string, operatorId: string): Promise<HITLApproval | null>;
  findPending(operatorId: string): Promise<HITLApproval[]>;
  findMany(filters: HITLFilters): Promise<HITLListResult>;
  findExpired(): Promise<HITLApproval[]>;
  save(approval: HITLApproval): Promise<void>;
}
