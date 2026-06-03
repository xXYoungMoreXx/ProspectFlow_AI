import http from "k6/http";
import { check } from "k6";
import { BASE_URL, TEST_USER } from "./config.js";

/**
 * Login and return Bearer token.
 * Call once in setup() and pass token to default().
 */
export function getToken() {
  const res = http.post(`${BASE_URL}/auth/login`, JSON.stringify(TEST_USER), {
    headers: { "Content-Type": "application/json" },
  });

  check(res, { "login 200": (r) => r.status === 200 });

  const body = res.json();
  if (!body.data?.accessToken) {
    throw new Error(`Login failed: ${res.status} ${res.body}`);
  }
  return body.data.accessToken;
}

export function authHeaders(token) {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}
