export interface BriefingCompletedPayload {
  briefingId: string;
  dealId: string;
}

export interface BriefingApprovedPayload {
  briefingId: string;
  dealId: string;
  approvedAt: string;
}
