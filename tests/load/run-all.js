/**
 * Run all load test scenarios in a single k6 run.
 * Uses k6 scenarios API to run them in parallel with separate thresholds.
 *
 * Usage:
 *   k6 run tests/load/run-all.js
 *   k6 run --env BASE_URL=http://localhost:3001/api/v1 tests/load/run-all.js
 */
import { getToken, authHeaders } from "./lib/auth.js";
import { BASE_URL, thresholds } from "./lib/config.js";
import http from "k6/http";
import { check, sleep } from "k6";

export const options = {
  scenarios: {
    leads: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: "30s", target: 20 },
        { duration: "90s", target: 50 },
        { duration: "30s", target: 0 },
      ],
      gracefulRampDown: "10s",
      exec: "leadsScenario",
    },
    hitl: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: "30s", target: 10 },
        { duration: "90s", target: 20 },
        { duration: "30s", target: 0 },
      ],
      gracefulRampDown: "10s",
      exec: "hitlScenario",
    },
    // agent-activate runs last — resource intensive, don't overlap fully
    agentActivate: {
      executor: "ramping-vus",
      startTime: "150s",
      startVUs: 0,
      stages: [
        { duration: "30s", target: 5 },
        { duration: "120s", target: 10 },
        { duration: "30s", target: 0 },
      ],
      gracefulRampDown: "15s",
      exec: "agentActivateScenario",
    },
  },
  thresholds: {
    "http_req_duration{scenario:leads}": thresholds.leads.http_req_duration,
    "http_req_failed{scenario:leads}": thresholds.leads.http_req_failed,
    "http_req_duration{scenario:hitl}":
      thresholds.hitlApprove.http_req_duration,
    "http_req_failed{scenario:hitl}": thresholds.hitlApprove.http_req_failed,
    "http_req_duration{scenario:agentActivate}":
      thresholds.agentActivate.http_req_duration,
    "http_req_failed{scenario:agentActivate}":
      thresholds.agentActivate.http_req_failed,
  },
};

export function setup() {
  return { token: getToken() };
}

export function leadsScenario({ token }) {
  const headers = authHeaders(token);
  const list = http.get(`${BASE_URL}/leads`, { headers });
  check(list, { "GET /leads 200": (r) => r.status === 200 });

  const payload = JSON.stringify({
    contactName: `LT ${Date.now()}`,
    businessName: "Empresa LT LTDA",
    source: "MANUAL",
    contactEmail: `lt_${Date.now()}@test.com`,
  });
  const create = http.post(`${BASE_URL}/leads`, payload, { headers });
  check(create, { "POST /leads 201": (r) => r.status === 201 });
  sleep(0.5);
}

export function hitlScenario({ token }) {
  const headers = authHeaders(token);
  const pending = http.get(`${BASE_URL}/hitl/pending`, { headers });
  check(pending, { "GET /hitl/pending 200": (r) => r.status === 200 });
  sleep(0.3);
}

export function agentActivateScenario({ token }) {
  const headers = authHeaders(token);
  const list = http.get(`${BASE_URL}/agents`, { headers });
  check(list, { "GET /agents 200": (r) => r.status === 200 });

  const agents = list.json("data");
  if (!agents || agents.length === 0) {
    sleep(2);
    return;
  }

  const activate = http.post(
    `${BASE_URL}/agents/${agents[0].id}/activate`,
    JSON.stringify({
      taskType: "hunter.search",
      input: { category: "restaurante", city: "São Paulo", maxResults: 3 },
    }),
    { headers },
  );
  check(activate, {
    "POST /activate 2xx": (r) => r.status >= 200 && r.status < 300,
  });
  sleep(2);
}
