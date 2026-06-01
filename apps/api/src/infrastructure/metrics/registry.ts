import * as promClient from "prom-client";

promClient.register.clear();

export const agentTokensConsumedTotal = new promClient.Counter({
  name: "agentepro_agent_tokens_consumed_total",
  help: "Total tokens consumed by agent executions",
  labelNames: ["persona", "provider"],
});

export const hitlPendingGauge = new promClient.Gauge({
  name: "agentepro_hitl_pending",
  help: "Number of pending HITL approvals per operator",
  labelNames: ["operator_id"],
});

export const authFailuresTotal = new promClient.Counter({
  name: "agentepro_auth_failures_total",
  help: "Total number of authentication failures",
  labelNames: ["reason"],
});

export const ssrfBlockedTotal = new promClient.Counter({
  name: "agentepro_ssrf_blocked_total",
  help: "Total SSRF attempts blocked",
});

export const invalidUploadTotal = new promClient.Counter({
  name: "agentepro_invalid_upload_total",
  help: "Total invalid uploads rejected",
  labelNames: ["reason"],
});

// S3-08: Additional SPEC-00 Fase 3 metrics

export const agentTasksTotal = new promClient.Counter({
  name: "agentepro_agent_tasks_total",
  help: "Total agent tasks by persona and status",
  labelNames: ["persona", "status"],
});

export const hitlApprovalsTotal = new promClient.Counter({
  name: "agentepro_hitl_approvals_total",
  help: "Total HITL decisions",
  labelNames: ["action_type", "decision"],
});

export const leadQualificationScoreHistogram = new promClient.Histogram({
  name: "agentepro_lead_qualification_score",
  help: "Distribution of lead qualification scores",
  buckets: [10, 20, 30, 40, 50, 60, 70, 80, 90, 100],
});

export const llmRequestsTotal = new promClient.Counter({
  name: "agentepro_llm_requests_total",
  help: "Total LLM API requests",
  labelNames: ["provider", "model", "status"],
});
