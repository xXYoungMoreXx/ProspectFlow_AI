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
