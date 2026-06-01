// SPEC-09 §2 — timeouts in minutes. null = HITL-FINANCEIRO, never auto-expires.
import { HITLActionType } from "./HITLActionType.js";

export const HITLTimeouts: Record<HITLActionType, number | null> = {
  [HITLActionType.APPROVE_LEAD_LIST]: 120, // 2 h
  [HITLActionType.SEND_EXTERNAL_MESSAGE]: 60, // 1 h  (editable)
  [HITLActionType.SEND_PROPOSAL]: 60, // 1 h  (editable)
  [HITLActionType.APPROVE_MOCKUP]: 180, // 3 h  (view in panel)
  [HITLActionType.APPROVE_STAGING]: 120, // 2 h  (see staging URL)
  [HITLActionType.DEPLOY_PRODUCTION]: 60, // 1 h  (financial — never auto-expires when escalated)
  [HITLActionType.APPROVE_BRIEFING]: 60, // 1 h  (editable)
  [HITLActionType.SEND_DELIVERY]: 30, // 30 min (editable)
};
