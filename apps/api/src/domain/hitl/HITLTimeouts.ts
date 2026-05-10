/**
 * Define timeouts (em segundos) por ActionType.
 * Null indica que nunca auto-expira.
 */
import { HITLActionType } from './HITLActionType.js';

export const HITLTimeouts: Record<HITLActionType, number | null> = {
  [HITLActionType.FIRST_CONTACT]: 3600,     // 1 hora
  [HITLActionType.SEND_PROPOSAL]: 7200,     // 2 horas
  [HITLActionType.DEPLOY_SITE]: 14400,      // 4 horas
  [HITLActionType.FOLLOW_UP]: 1800,         // 30 min (HITL-2 pode auto-aprovar)
  [HITLActionType.PAID_CAMPAIGN]: null,     // HITL-FINANCEIRO, nunca expira
};
