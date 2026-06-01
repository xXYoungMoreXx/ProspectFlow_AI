/**
 * Load test: HITL approve flow
 *
 * Scenario: GET /hitl/pending → POST /hitl/:id/approve
 * Goal: p95 < 500ms, error rate < 1%
 */
import http from "k6/http";
import { check, sleep } from "k6";
import { getToken, authHeaders } from "../lib/auth.js";
import { BASE_URL, thresholds } from "../lib/config.js";

export const options = {
  stages: [
    { duration: "30s", target: 10 },
    { duration: "90s", target: 20 },
    { duration: "30s", target: 0 },
  ],
  thresholds: thresholds.hitlApprove,
};

export function setup() {
  return { token: getToken() };
}

export default function ({ token }) {
  const headers = authHeaders(token);

  // 1. Get pending approvals
  const pending = http.get(`${BASE_URL}/hitl/pending`, { headers });
  check(pending, { "GET /hitl/pending 200": (r) => r.status === 200 });

  const items = pending.json("data");

  if (items && items.length > 0) {
    // 2. Approve first pending item
    const id = items[0].id;
    const approve = http.post(
      `${BASE_URL}/hitl/${id}/approve`,
      JSON.stringify({ comment: "load-test approved" }),
      { headers },
    );
    check(approve, {
      "POST /hitl/:id/approve 200": (r) => r.status === 200,
    });
  }

  // Also test reject path on every other VU
  if (__VU % 2 === 0 && items && items.length > 1) {
    const id = items[1].id;
    const reject = http.post(
      `${BASE_URL}/hitl/${id}/reject`,
      JSON.stringify({ comment: "load-test rejected" }),
      { headers },
    );
    check(reject, {
      "POST /hitl/:id/reject 200": (r) => r.status === 200,
    });
  }

  sleep(0.3);
}
