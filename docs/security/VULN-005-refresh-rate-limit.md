## [VULN-005] Missing Rate Limiting on Refresh Token Endpoint

| Field          | Value                              |
|----------------|------------------------------------|
| OWASP 2025     | A02 — Security Misconfiguration    |
| Severity       | MEDIUM                             |
| Module         | apps/api/src/http/routes           |
| Files          | auth.routes.ts:296-300             |
| Status         | ✅ Fixed                           |

### Attack Vector
An attacker could attempt to brute-force or spray refresh tokens without any throttling. Since refresh token verification involves Argon2 (CPU intensive), this also presents a DoS vector.

### Proof-of-Concept Test
```typescript
it("should have rate limiting configured on /refresh route", async () => {
  await authRoutes(mockApp);
  const refreshRoute = mockApp.post.mock.calls.find(call => call[0] === "/refresh");
  expect(refreshRoute[1]).toHaveProperty("config.rateLimit");
});
```

### Clean Architecture Impact
Infrastructure layer (HTTP routes) lacked essential security controls (rate limiting) for a sensitive authentication endpoint.

### Fix Applied
Added `@fastify/rate-limit` configuration to the `/refresh` route in `auth.routes.ts`, limiting it to 10 attempts per 5 minutes.

### Verification
Passed `auth.sentinel.test.ts`.
