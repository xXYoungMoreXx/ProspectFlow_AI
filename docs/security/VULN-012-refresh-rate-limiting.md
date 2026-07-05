## [VULN-012] Refresh Token Rate Limiting

| Field          | Value                              |
|----------------|------------------------------------|
| OWASP 2025     | A07 — Authentication Failures      |
| Severity       | MEDIUM                             |
| Module         | apps/api/src/http/routes           |
| Files          | auth.routes.ts:300                 |
| Status         | ✅ Fixed                           |

### Attack Vector
The `/refresh` endpoint performs expensive Argon2id hash verifications. Without rate limiting, an attacker could spam this endpoint to cause a CPU Denial of Service (DoS) on the API server.

### Proof-of-Concept Test
```typescript
it("should have rate limiting configured for /refresh endpoint", async () => {
    // ...
    expect(refreshRoute.opts.config.rateLimit).toBeDefined();
});
```

### Clean Architecture Impact
The fix was applied in the **Infrastructure (HTTP)** layer using Fastify's native rate-limiting middleware.

### Fix Applied
Configured `@fastify/rate-limit` for the `/refresh` route with a limit of 10 requests per hour. In the `test` environment, this limit is increased to 1000 to prevent CI failures during E2E test execution.

### Verification
- [x] Phase 1 test now passes
- [x] Full test suite green

### Journal Trigger?
NO — routine fix
