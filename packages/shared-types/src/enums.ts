// ─── Agent Domain ────────────────────────────────────────────────────────────

export const AgentPersona = {
  HUNTER: "HUNTER",
  CLOSER: "CLOSER",
  BUILDER: "BUILDER",
  QA: "QA",
} as const;
export type AgentPersona = (typeof AgentPersona)[keyof typeof AgentPersona];

export const AgentStatus = {
  ACTIVE: "ACTIVE",
  INACTIVE: "INACTIVE",
  PAUSED: "PAUSED",
} as const;
export type AgentStatus = (typeof AgentStatus)[keyof typeof AgentStatus];

export const LLMProvider = {
  OLLAMA: "OLLAMA",
  OPENAI: "OPENAI",
  ANTHROPIC: "ANTHROPIC",
  GOOGLE: "GOOGLE",
  GROQ: "GROQ",
  CUSTOM: "CUSTOM",
} as const;
export type LLMProvider = (typeof LLMProvider)[keyof typeof LLMProvider];

// ─── Lead Domain ─────────────────────────────────────────────────────────────

export const LeadSource = {
  MANUAL: "MANUAL",
  SCRAPED: "SCRAPED",
  REFERRAL: "REFERRAL",
  GOOGLE_MAPS: "GOOGLE_MAPS",
  APOLLO: "APOLLO",
} as const;
export type LeadSource = (typeof LeadSource)[keyof typeof LeadSource];

export const LeadStatus = {
  NEW: "NEW",
  PROSPECTED: "PROSPECTED",
  APPROVED: "APPROVED",
  CONTACTED: "CONTACTED",
  QUALIFIED: "QUALIFIED",
  NEGOTIATING: "NEGOTIATING",
  CONVERTED: "CONVERTED",
  LOST: "LOST",
} as const;
export type LeadStatus = (typeof LeadStatus)[keyof typeof LeadStatus];

export const MessageDirection = {
  INBOUND: "INBOUND",
  OUTBOUND: "OUTBOUND",
} as const;
export type MessageDirection =
  (typeof MessageDirection)[keyof typeof MessageDirection];

export const MessageChannel = {
  WHATSAPP: "WHATSAPP",
  EMAIL: "EMAIL",
  INTERNAL: "INTERNAL",
} as const;
export type MessageChannel =
  (typeof MessageChannel)[keyof typeof MessageChannel];

// ─── Deal Domain ─────────────────────────────────────────────────────────────

export const DealStatus = {
  PROPOSED: "PROPOSED",
  NEGOTIATING: "NEGOTIATING",
  CLOSED: "CLOSED",
  CANCELLED: "CANCELLED",
} as const;
export type DealStatus = (typeof DealStatus)[keyof typeof DealStatus];

export const ServiceType = {
  SITE_CREATION: "SITE_CREATION",
  TRAFFIC_MANAGEMENT: "TRAFFIC_MANAGEMENT",
  SOCIAL_MEDIA: "SOCIAL_MEDIA",
  FULL_DIGITAL: "FULL_DIGITAL",
} as const;
export type ServiceType = (typeof ServiceType)[keyof typeof ServiceType];

export const SERVICE_TYPE_LABELS: Record<string, string> = {
  SITE_CREATION: "Criação de Site",
  TRAFFIC_MANAGEMENT: "Gestão de Tráfego",
  SOCIAL_MEDIA: "Social Media",
  FULL_DIGITAL: "Full Digital (Completo)",
};

export const SERVICE_TYPES = [
  "SITE_CREATION",
  "TRAFFIC_MANAGEMENT",
  "SOCIAL_MEDIA",
  "FULL_DIGITAL",
] as const;

// ─── Project Domain ──────────────────────────────────────────────────────────

export const ProjectStatus = {
  PLANNING: "PLANNING",
  IN_PROGRESS: "IN_PROGRESS",
  REVIEW: "REVIEW",
  DELIVERED: "DELIVERED",
  REVISION: "REVISION",
  CANCELLED: "CANCELLED",
} as const;
export type ProjectStatus = (typeof ProjectStatus)[keyof typeof ProjectStatus];

// ─── HITL Domain ─────────────────────────────────────────────────────────────

export const HITLStatus = {
  PENDING: "PENDING",
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
  EXPIRED: "EXPIRED",
  EDITED_APPROVED: "EDITED_APPROVED",
} as const;
export type HITLStatus = (typeof HITLStatus)[keyof typeof HITLStatus];

export const RuleAction = {
  BLOCK: "BLOCK",
  WARN: "WARN",
  LOG: "LOG",
  ESCALATE_HITL: "ESCALATE_HITL",
} as const;
export type RuleAction = (typeof RuleAction)[keyof typeof RuleAction];
