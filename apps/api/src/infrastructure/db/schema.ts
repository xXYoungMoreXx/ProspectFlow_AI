/**
 * Drizzle ORM Schema — mirrors PRD §13 SQL schema exactly.
 * PostgreSQL 16, RLS-ready, audit_log append-only.
 */
import {
  pgTable,
  pgEnum,
  uuid,
  text,
  boolean,
  timestamp,
  integer,
  bigint,
  numeric,
  jsonb,
  inet,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";

// ─── Enums ────────────────────────────────────────────────────────────────────

export const agentPersonaEnum = pgEnum("agent_persona", [
  "HUNTER",
  "CLOSER",
  "BUILDER",
  "QA",
]);
export const agentStatusEnum = pgEnum("agent_status", [
  "ACTIVE",
  "INACTIVE",
  "PAUSED",
]);
export const llmProviderEnum = pgEnum("llm_provider", [
  "OLLAMA",
  "OPENAI",
  "ANTHROPIC",
  "GOOGLE",
  "GROQ",
  "CUSTOM",
]);
export const leadSourceEnum = pgEnum("lead_source", [
  "MANUAL",
  "SCRAPED",
  "REFERRAL",
  "GOOGLE_MAPS",
  "APOLLO",
]);
export const leadStatusEnum = pgEnum("lead_status", [
  "NEW",
  "PROSPECTED",
  "APPROVED",
  "CONTACTED",
  "QUALIFIED",
  "NEGOTIATING",
  "CONVERTED",
  "LOST",
]);
export const messageDirectionEnum = pgEnum("message_direction", [
  "INBOUND",
  "OUTBOUND",
]);
export const messageChannelEnum = pgEnum("message_channel", [
  "WHATSAPP",
  "EMAIL",
  "INTERNAL",
  "TELEGRAM",
]);
export const dealStatusEnum = pgEnum("deal_status", [
  "PROPOSED",
  "NEGOTIATING",
  "CLOSED",
  "CANCELLED",
]);
export const serviceTypeEnum = pgEnum("service_type", [
  "WEBSITE",
  "TRAFFIC",
  "SOCIAL_MEDIA",
  "OTHER",
]);
export const projectStatusEnum = pgEnum("project_status", [
  "PLANNING",
  "IN_PROGRESS",
  "REVIEW",
  "DELIVERED",
  "REVISION",
  "CANCELLED",
]);
export const hitlStatusEnum = pgEnum("hitl_status", [
  "PENDING",
  "APPROVED",
  "REJECTED",
  "EXPIRED",
  "EDITED_APPROVED",
]);
export const verificationTypeEnum = pgEnum("verification_type", [
  "EMAIL_VERIFICATION",
  "PASSWORD_RESET",
]);
export const hitlActionTypeEnum = pgEnum("hitl_action_type", [
  "APPROVE_LEAD_LIST",
  "SEND_EXTERNAL_MESSAGE",
  "SEND_PROPOSAL",
  "APPROVE_MOCKUP",
  "APPROVE_STAGING",
  "DEPLOY_PRODUCTION",
  "APPROVE_BRIEFING",
  "SEND_DELIVERY",
]);

// ═══════════════════════════════════════════════════════════════════════════════
// IAM CONTEXT
// ═══════════════════════════════════════════════════════════════════════════════

export const operators = pgTable("operators", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(), // Argon2id
  name: text("name").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  emailVerified: boolean("email_verified").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const refreshTokens = pgTable("refresh_tokens", {
  id: uuid("id").primaryKey().defaultRandom(),
  operatorId: uuid("operator_id")
    .notNull()
    .references(() => operators.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const emailVerifications = pgTable(
  "email_verifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    operatorId: uuid("operator_id")
      .notNull()
      .references(() => operators.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull().unique(),
    type: verificationTypeEnum("type").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_email_verifications_operator_type").on(
      table.operatorId,
      table.type,
    ),
  ],
);

export const pricingConfig = pgTable(
  "pricing_config",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    operatorId: uuid("operator_id")
      .notNull()
      .references(() => operators.id, { onDelete: "cascade" }),
    serviceType: serviceTypeEnum("service_type").notNull(),
    basePriceCents: bigint("base_price_cents", { mode: "number" }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    operatorServiceIdx: index("idx_pricing_config_operator_service").on(
      table.operatorId,
      table.serviceType,
    ),
  }),
);

// ═══════════════════════════════════════════════════════════════════════════════
// AGENT MANAGEMENT CONTEXT
// ═══════════════════════════════════════════════════════════════════════════════

export const agents = pgTable("agents", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: text("organization_id").notNull().default("org_mvp"),
  operatorId: uuid("operator_id")
    .notNull()
    .references(() => operators.id),
  name: text("name").notNull(),
  persona: agentPersonaEnum("persona").notNull(),
  status: agentStatusEnum("status").notNull().default("INACTIVE"),
  llmProvider: llmProviderEnum("llm_provider").notNull(),
  llmModel: text("llm_model").notNull(),
  llmBaseUrl: text("llm_base_url"),
  llmApiKeyRef: text("llm_api_key_ref"),
  llmTemperature: numeric("llm_temperature", { precision: 3, scale: 2 })
    .notNull()
    .default("0.70"),
  llmMaxTokens: integer("llm_max_tokens").notNull().default(4096),
  llmSystemPrompt: text("llm_system_prompt"),
  tokenBudgetTotal: bigint("token_budget_total", { mode: "number" })
    .notNull()
    .default(1_000_000),
  tokenBudgetRemaining: bigint("token_budget_remaining", { mode: "number" })
    .notNull()
    .default(1_000_000),
  ragEnabled: boolean("rag_enabled").notNull().default(false),
  ragCollection: text("rag_collection"),
  ragTopK: integer("rag_top_k").default(5),
  ragThreshold: numeric("rag_threshold", { precision: 3, scale: 2 }).default(
    "0.70",
  ),
  hitlTimeoutMinutes: integer("hitl_timeout_minutes").notNull().default(60),
  hitlNotifyChannel: text("hitl_notify_channel").notNull().default("email"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const agentSkills = pgTable("agent_skills", {
  id: uuid("id").primaryKey().defaultRandom(),
  agentId: uuid("agent_id")
    .notNull()
    .references(() => agents.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  skillType: text("skill_type").notNull(),
  config: jsonb("config").notNull().default({}),
  isEnabled: boolean("is_enabled").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const agentRules = pgTable("agent_rules", {
  id: uuid("id").primaryKey().defaultRandom(),
  agentId: uuid("agent_id")
    .notNull()
    .references(() => agents.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  condition: text("condition").notNull(),
  action: text("action").notNull(), // BLOCK | WARN | LOG | ESCALATE_HITL
  priority: integer("priority").notNull().default(100),
  isEnabled: boolean("is_enabled").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const mcpServers = pgTable("mcp_servers", {
  id: uuid("id").primaryKey().defaultRandom(),
  agentId: uuid("agent_id")
    .notNull()
    .references(() => agents.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  url: text("url").notNull(),
  authRef: text("auth_ref"),
  isEnabled: boolean("is_enabled").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// SPEC-02: Sub-agents are independently-configurable LLM workers within an Agent.
export const executionModeEnum = pgEnum("execution_mode", [
  "sequential",
  "parallel",
]);

export const subAgents = pgTable(
  "sub_agents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: text("organization_id").notNull().default("org_mvp"),
    agentId: uuid("agent_id")
      .notNull()
      .references(() => agents.id, { onDelete: "cascade" }),
    role: text("role").notNull(),
    llmProvider: llmProviderEnum("llm_provider").notNull(),
    llmModel: text("llm_model").notNull(),
    llmTemperature: numeric("llm_temperature", { precision: 3, scale: 2 })
      .notNull()
      .default("0.70"),
    llmMaxTokens: integer("llm_max_tokens").notNull().default(4096),
    executionMode: executionModeEnum("execution_mode")
      .notNull()
      .default("sequential"),
    parallelGroup: integer("parallel_group"),
    maxRetries: integer("max_retries").notNull().default(3),
    timeoutSeconds: integer("timeout_seconds").notNull().default(120),
    isEnabled: boolean("is_enabled").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("idx_sub_agents_agent").on(table.agentId)],
);

// ═══════════════════════════════════════════════════════════════════════════════
// LEAD & PROSPECTING CONTEXT
// ═══════════════════════════════════════════════════════════════════════════════

export const leads = pgTable(
  "leads",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: text("organization_id").notNull().default("org_mvp"),
    operatorId: uuid("operator_id")
      .notNull()
      .references(() => operators.id),
    assignedAgentId: uuid("assigned_agent_id").references(() => agents.id),
    contactName: text("contact_name").notNull(),
    contactEmail: text("contact_email"),
    contactPhone: text("contact_phone"),
    contactCompany: text("contact_company"),
    cnpj: text("cnpj"),
    companyData: jsonb("company_data").default({}),
    contactWebsite: text("contact_website"),
    source: leadSourceEnum("source").notNull().default("MANUAL"),
    qualificationScore: integer("qualification_score"),
    status: leadStatusEnum("status").notNull().default("NEW"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_leads_status").on(table.status, table.operatorId),
    index("idx_leads_agent").on(table.assignedAgentId),
  ],
);

export const messages = pgTable(
  "messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    leadId: uuid("lead_id")
      .notNull()
      .references(() => leads.id),
    agentId: uuid("agent_id").references(() => agents.id),
    direction: messageDirectionEnum("direction").notNull(),
    channel: messageChannelEnum("channel").notNull(),
    content: text("content").notNull(),
    contentType: text("content_type").notNull().default("text/plain"),
    externalId: text("external_id"),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    // Append-only: no UPDATE/DELETE via RLS
  },
  (table) => [index("idx_messages_lead").on(table.leadId, table.createdAt)],
);

// ═══════════════════════════════════════════════════════════════════════════════
// SALES & NEGOTIATION CONTEXT
// ═══════════════════════════════════════════════════════════════════════════════

export const deals = pgTable(
  "deals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: text("organization_id").notNull().default("org_mvp"),
    leadId: uuid("lead_id")
      .notNull()
      .references(() => leads.id),
    operatorId: uuid("operator_id")
      .notNull()
      .references(() => operators.id),
    agentId: uuid("agent_id").references(() => agents.id),
    serviceType: serviceTypeEnum("service_type").notNull(),
    status: dealStatusEnum("status").notNull().default("PROPOSED"),
    briefing: jsonb("briefing").notNull().default({}),
    proposalText: text("proposal_text"),
    basePriceCents: bigint("base_price_cents", { mode: "number" })
      .notNull()
      .default(0),
    addons: jsonb("addons").notNull().default([]),
    discountPct: numeric("discount_pct", { precision: 5, scale: 2 })
      .notNull()
      .default("0"),
    currency: text("currency").notNull().default("BRL"),
    proposalSentAt: timestamp("proposal_sent_at", { withTimezone: true }),
    closedAt: timestamp("closed_at", { withTimezone: true }),
    closedReason: text("closed_reason"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_deals_lead").on(table.leadId),
    index("idx_deals_status").on(table.status, table.operatorId),
  ],
);

// SPEC-04: Follow-ups — cadência [3, 7, 14] dias após closedAt
export const followUpStatusEnum = pgEnum("follow_up_status", [
  "SCHEDULED",
  "SENT",
  "FAILED",
  "CANCELLED",
]);

export const followUps = pgTable(
  "follow_ups",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: text("organization_id").notNull().default("org_mvp"),
    dealId: uuid("deal_id")
      .notNull()
      .references(() => deals.id, { onDelete: "cascade" }),
    leadId: uuid("lead_id")
      .notNull()
      .references(() => leads.id),
    operatorId: uuid("operator_id")
      .notNull()
      .references(() => operators.id),
    attempt: integer("attempt").notNull().default(1), // 1, 2, or 3
    scheduledDate: timestamp("scheduled_date", {
      withTimezone: true,
    }).notNull(),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    channel: messageChannelEnum("channel").notNull(),
    status: followUpStatusEnum("status").notNull().default("SCHEDULED"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_follow_ups_deal").on(table.dealId),
    index("idx_follow_ups_scheduled").on(table.scheduledDate, table.status),
  ],
);

// SPEC-05: Briefings — coleta de requisitos pós-deal
export const briefingStatusEnum = pgEnum("briefing_status", [
  "IN_PROGRESS",
  "COMPLETED",
  "APPROVED",
]);

export const briefings = pgTable(
  "briefings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: text("organization_id").notNull().default("org_mvp"),
    dealId: uuid("deal_id")
      .notNull()
      .references(() => deals.id)
      .unique(),
    operatorId: uuid("operator_id")
      .notNull()
      .references(() => operators.id),
    agentId: uuid("agent_id").references(() => agents.id),
    status: briefingStatusEnum("status").notNull().default("IN_PROGRESS"),
    nicheTemplate: text("niche_template"),
    briefingData: jsonb("briefing_data").notNull().default({}),
    interviewTranscriptRef: text("interview_transcript_ref"),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("idx_briefings_deal").on(table.dealId)],
);

// SPEC-05: Briefing assets — logos, fotos, documentos (validação magic bytes obrigatória)
export const briefingAssetTypeEnum = pgEnum("briefing_asset_type", [
  "logo",
  "photo",
  "document",
  "other",
]);

export const briefingAssets = pgTable(
  "briefing_assets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: text("organization_id").notNull().default("org_mvp"),
    briefingId: uuid("briefing_id")
      .notNull()
      .references(() => briefings.id, { onDelete: "cascade" }),
    assetType: briefingAssetTypeEnum("asset_type").notNull(),
    mimeType: text("mime_type").notNull(),
    storageRef: text("storage_ref").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    magicBytesValidated: boolean("magic_bytes_validated")
      .notNull()
      .default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("idx_briefing_assets_briefing").on(table.briefingId)],
);

// ═══════════════════════════════════════════════════════════════════════════════
// COMPLIANCE & CLICKWRAP CONTEXT
// ═══════════════════════════════════════════════════════════════════════════════

export const contractAcceptances = pgTable(
  "contract_acceptances",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    dealId: uuid("deal_id")
      .notNull()
      .references(() => deals.id),
    contractHash: text("contract_hash").notNull(),
    acceptedAt: timestamp("accepted_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    ipHash: text("ip_hash").notNull(),
    userAgentHash: text("user_agent_hash").notNull(),
    sessionId: text("session_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    // Append-only: no UPDATE/DELETE
  },
  (table) => [index("idx_contract_acceptances_deal").on(table.dealId)],
);

export const prospectOptouts = pgTable(
  "prospect_optouts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    operatorId: uuid("operator_id")
      .notNull()
      .references(() => operators.id),
    phoneHash: text("phone_hash"),
    emailHash: text("email_hash"),
    optedOutAt: timestamp("opted_out_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_optouts_operator_phone").on(table.operatorId, table.phoneHash),
    index("idx_optouts_operator_email").on(table.operatorId, table.emailHash),
  ],
);

// ═══════════════════════════════════════════════════════════════════════════════
// DELIVERY & DEVELOPMENT CONTEXT
// ═══════════════════════════════════════════════════════════════════════════════

export const projects = pgTable(
  "projects",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: text("organization_id").notNull().default("org_mvp"),
    dealId: uuid("deal_id")
      .notNull()
      .references(() => deals.id),
    operatorId: uuid("operator_id")
      .notNull()
      .references(() => operators.id),
    assignedAgentId: uuid("assigned_agent_id").references(() => agents.id),
    status: projectStatusEnum("status").notNull().default("PLANNING"),
    templateId: text("template_id"),
    briefing: jsonb("briefing").notNull().default({}),
    deliverableUrl: text("deliverable_url"),
    mockupHtml: text("mockup_html"),
    mockupUrl: text("mockup_url"),
    deliverableMeta: jsonb("deliverable_meta").default({}),
    lighthousePerf: integer("lighthouse_perf"),
    lighthouseA11y: integer("lighthouse_a11y"),
    lighthouseSeo: integer("lighthouse_seo"),
    lighthouseBp: integer("lighthouse_bp"),
    revisionCount: integer("revision_count").notNull().default(0),
    revisionNotes: text("revision_notes"),
    deliveredAt: timestamp("delivered_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("idx_projects_status").on(table.status, table.operatorId)],
);

// SPEC-10: media_assets — imagens geradas por IA (magic bytes obrigatório)
export const mediaAssetStatusEnum = pgEnum("media_asset_status", [
  "PENDING",
  "VALIDATED",
  "REJECTED",
]);

export const mediaAssets = pgTable(
  "media_assets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: text("organization_id").notNull().default("org_mvp"),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    provider: text("provider").notNull(), // NanaBanana | DALLE | OllamaVision
    url: text("url").notNull(),
    mimeType: text("mime_type").notNull(),
    sizeBytes: integer("size_bytes"),
    validationStatus: mediaAssetStatusEnum("validation_status")
      .notNull()
      .default("PENDING"),
    magicBytesValidated: boolean("magic_bytes_validated")
      .notNull()
      .default(false),
    metadata: jsonb("metadata").default({}),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("idx_media_assets_project").on(table.projectId)],
);

// ═══════════════════════════════════════════════════════════════════════════════
// HITL CONTEXT
// ═══════════════════════════════════════════════════════════════════════════════

export const hitlApprovals = pgTable(
  "hitl_approvals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: text("organization_id").notNull().default("org_mvp"),
    operatorId: uuid("operator_id")
      .notNull()
      .references(() => operators.id),
    agentId: uuid("agent_id")
      .notNull()
      .references(() => agents.id),
    hitlLevel: text("hitl_level").notNull().default("HITL-1"),
    actionType: hitlActionTypeEnum("action_type").notNull(),
    contextType: text("context_type").notNull(), // LEAD | DEAL | PROJECT
    contextId: uuid("context_id").notNull(),
    payloadPreview: jsonb("payload_preview").notNull(),
    payloadFullRef: text("payload_full_ref"),
    status: hitlStatusEnum("status").notNull().default("PENDING"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
    operatorNote: text("operator_note"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_hitl_pending").on(table.operatorId, table.status),
    index("idx_hitl_level_status").on(table.hitlLevel, table.status),
  ],
);

// BUILD_ORDER 3.1: token_usage — custo por execução de agente
export const tokenUsage = pgTable(
  "token_usage",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: text("organization_id").notNull().default("org_mvp"),
    agentId: uuid("agent_id")
      .notNull()
      .references(() => agents.id, { onDelete: "cascade" }),
    operatorId: uuid("operator_id")
      .notNull()
      .references(() => operators.id),
    subAgentType: text("sub_agent_type"), // PROSPECTOR | OUTREACH_WRITER | etc.
    provider: text("provider").notNull(),
    promptTokens: integer("prompt_tokens").notNull().default(0),
    completionTokens: integer("completion_tokens").notNull().default(0),
    totalTokens: integer("total_tokens").notNull().default(0),
    costUsd: numeric("cost_usd", { precision: 10, scale: 8 })
      .notNull()
      .default("0"),
    taskType: text("task_type"),
    correlationId: uuid("correlation_id"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_token_usage_agent").on(table.agentId, table.createdAt),
    index("idx_token_usage_operator").on(table.operatorId, table.createdAt),
  ],
);

// ═══════════════════════════════════════════════════════════════════════════════
// QA RESULTS — QA agent validation output per project
// ═══════════════════════════════════════════════════════════════════════════════

export const qaResults = pgTable(
  "qa_results",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: text("organization_id").notNull(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    agentId: uuid("agent_id")
      .notNull()
      .references(() => agents.id),
    checkType: text("check_type").notNull(), // 'LIGHTHOUSE' | 'CONTENT' | 'LINKS' | 'MOBILE'
    status: text("status").notNull(), // 'PASS' | 'FAIL' | 'WARNING'
    score: integer("score"),
    details: jsonb("details"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_qa_results_project").on(table.projectId),
    index("idx_qa_results_org").on(table.organizationId),
  ],
);

// ═══════════════════════════════════════════════════════════════════════════════
// AUDIT LOG (APPEND-ONLY)
// ═══════════════════════════════════════════════════════════════════════════════

export const auditLog = pgTable(
  "audit_log",
  {
    id: text("id").primaryKey(), // ULID for temporal ordering
    timestamp: timestamp("timestamp", { withTimezone: true })
      .notNull()
      .defaultNow(),
    actor: text("actor").notNull(),
    actorId: text("actor_id").notNull(),
    action: text("action").notNull(),
    resourceType: text("resource_type").notNull(),
    resourceId: text("resource_id").notNull(),
    payload: jsonb("payload").notNull().default({}),
    ipAddress: inet("ip_address"),
    correlationId: uuid("correlation_id").notNull(),
    causationId: uuid("causation_id"),
  },
  (table) => [
    index("idx_audit_resource").on(table.resourceType, table.resourceId),
    index("idx_audit_correlation").on(table.correlationId),
  ],
);

// ═══════════════════════════════════════════════════════════════════════════════
// SYSTEM SETTINGS (UI-CONFIGURABLE)
// ═══════════════════════════════════════════════════════════════════════════════

export const settingCategoryEnum = pgEnum("setting_category", [
  "llm_providers",
  "messaging",
  "integrations",
  "system",
]);

export const systemSettings = pgTable(
  "system_settings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    operatorId: uuid("operator_id")
      .notNull()
      .references(() => operators.id, { onDelete: "cascade" }),
    category: settingCategoryEnum("category").notNull(),
    key: text("key").notNull(),
    value: text("value").notNull(), // Plaintext or AES-256-GCM encrypted
    isSecret: boolean("is_secret").notNull().default(false),
    isActive: boolean("is_active").notNull().default(true),
    metadata: jsonb("metadata").default({}),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("uq_settings_operator_key").on(table.operatorId, table.key),
    index("idx_settings_operator_cat").on(table.operatorId, table.category),
  ],
);

// ── Multi-tenancy ──────────────────────────────────────────────────────────

export const organizations = pgTable("organizations", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const members = pgTable(
  "members",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull(),
    role: text("role").notNull().default("owner"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [uniqueIndex("members_org_user_uidx").on(t.organizationId, t.userId)],
);
