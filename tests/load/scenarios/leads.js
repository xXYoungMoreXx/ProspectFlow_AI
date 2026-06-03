/**
 * Load test: /leads CRUD
 *
 * Scenario: list → create → update → delete
 * Goal: p95 < 200ms, error rate < 1%
 */
import http from "k6/http";
import { check, sleep } from "k6";
import { getToken, authHeaders } from "../lib/auth.js";
import { BASE_URL, thresholds } from "../lib/config.js";

export const options = {
  stages: [
    { duration: "30s", target: 20 }, // ramp up
    { duration: "90s", target: 50 }, // sustained
    { duration: "30s", target: 0 }, // ramp down
  ],
  thresholds: thresholds.leads,
};

export function setup() {
  return { token: getToken() };
}

export default function ({ token }) {
  const headers = authHeaders(token);

  // 1. List leads
  const list = http.get(`${BASE_URL}/leads`, { headers });
  check(list, { "GET /leads 200": (r) => r.status === 200 });

  // 2. Create lead
  const payload = JSON.stringify({
    contactName: `Load Test ${Date.now()}`,
    businessName: "Empresa Teste LTDA",
    source: "MANUAL",
    contactEmail: `load_${Date.now()}@test.com`,
  });
  const create = http.post(`${BASE_URL}/leads`, payload, { headers });
  check(create, { "POST /leads 201": (r) => r.status === 201 });

  const leadId = create.json("data.id");

  if (leadId) {
    // 3. Update lead
    const update = http.patch(
      `${BASE_URL}/leads/${leadId}`,
      JSON.stringify({ contactName: "Load Test Updated" }),
      { headers },
    );
    check(update, { "PATCH /leads/:id 200": (r) => r.status === 200 });
  }

  sleep(0.5);
}
