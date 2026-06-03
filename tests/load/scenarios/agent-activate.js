/**
 * Load test: POST /agents/:id/activate
 *
 * Most expensive endpoint — spawns Python CrewAI task via BullMQ.
 * Goal: p95 < 5000ms, error rate < 5%
 * Low VU count: this hits the agent-runtime service.
 */
import http from "k6/http";
import { check, sleep } from "k6";
import { getToken, authHeaders } from "../lib/auth.js";
import { BASE_URL, thresholds } from "../lib/config.js";

export const options = {
  stages: [
    { duration: "30s", target: 5 },
    { duration: "120s", target: 10 },
    { duration: "30s", target: 0 },
  ],
  thresholds: thresholds.agentActivate,
};

// Agent ID must exist in DB — set via env or use first available
const AGENT_ID = __ENV.LOAD_TEST_AGENT_ID || "";

export function setup() {
  const token = getToken();
  const headers = authHeaders(token);

  // If no agent ID provided, grab first active agent
  let agentId = AGENT_ID;
  if (!agentId) {
    const list = http.get(`${BASE_URL}/agents`, { headers });
    check(list, { "GET /agents 200": (r) => r.status === 200 });
    const agents = list.json("data");
    if (agents && agents.length > 0) {
      agentId = agents[0].id;
    }
  }

  return { token, agentId };
}

export default function ({ token, agentId }) {
  if (!agentId) {
    console.warn("No agent ID available — skipping activate test");
    return;
  }

  const headers = authHeaders(token);

  // Activate agent — queues a task to agent-runtime
  const activate = http.post(
    `${BASE_URL}/agents/${agentId}/activate`,
    JSON.stringify({
      taskType: "hunter.search",
      input: { category: "restaurante", city: "São Paulo", maxResults: 5 },
    }),
    { headers },
  );

  check(activate, {
    "POST /activate 2xx": (r) => r.status >= 200 && r.status < 300,
    "not 500": (r) => r.status !== 500,
  });

  sleep(2); // rate-limit — agent-runtime is resource intensive
}
