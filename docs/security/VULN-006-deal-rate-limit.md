## [VULN-006] Missing Specific Rate Limiting on Public Deal Endpoints

| Field          | Value                              |
|----------------|------------------------------------|
| OWASP 2025     | A02 — Security Misconfiguration    |
| Severity       | MEDIUM                             |
| Module         | src/application/deal               |
| Files          | apps/api/src/http/routes/deals.public.routes.ts |
| Status         | ✅ Fixed                            |

### Attack Vector
Public endpoints `/deals/:id/proposal` and `/deals/:id/accept` lacked specific rate limiting. While global limits existed (100 req/min), these sensitive endpoints should have tighter controls to prevent automated abuse, brute-forcing of tokens, or high-frequency DoS attempts targeting the database and hashing functions.

### Proof-of-Concept Test
Statically verified via route configuration audit.

### Clean Architecture Impact
Applied at the **Infrastructure Layer** (HTTP Route configuration). Rate limiting is a cross-cutting concern best handled at the edge of the application.

### Fix Applied
Implemented specific rate limits using `@fastify/rate-limit` configuration directly on the public routes:
- `/proposal`: 10 requests per minute.
- `/accept`: 5 requests per minute.

### Verification
- Route configuration updated with `rateLimit` config.

### Journal Trigger?
NO — Standard hardening.
