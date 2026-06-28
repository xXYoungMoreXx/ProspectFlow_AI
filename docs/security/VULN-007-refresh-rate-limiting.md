## [VULN-007] Missing Rate Limiting on Refresh Token Endpoint

| Field          | Value                              |
|----------------|------------------------------------|
| OWASP 2025     | A02 — Security Misconfiguration    |
| Severity       | MEDIUM                             |
| EPSS Score     | N/A                                |
| Module         | apps/api/src/http/routes/          |
| Files          | auth.routes.ts                     |
| Status         | ✅ Fixed                           |

### Attack Vector
While most sensitive authentication endpoints (login, register, forgot-password) had explicit rate limiting configured, the `/refresh` endpoint was missing specific throttling. This allowed an attacker to perform high-frequency brute-force attempts on refresh tokens or cause resource exhaustion by triggering repeated database lookups and Argon2 hashing operations (used for refresh token verification).

### Proof-of-Concept Test
```typescript
const response = await app.inject({
  method: "POST",
  url: "/api/v1/auth/refresh",
  body: { refreshToken: "invalid" }
});
expect(response.headers['x-ratelimit-limit']).toBeDefined();
```

### Clean Architecture Impact
This vulnerability affected the **Infrastructure/HTTP** layer. The fix was applied at the route level using Fastify's rate-limit plugin, which is the correct layer for traffic management and DoS protection.

### Fix Applied
Added rate-limiting configuration to the `/refresh` route in `apps/api/src/http/routes/auth.routes.ts`, limiting to 10 attempts per hour.

### Verification
- Phase 1 TDD test now passes.
- Verified `x-ratelimit-*` headers are present in responses from the `/refresh` endpoint.

### Journal Trigger?
NO — routine hardening of auth endpoints.
