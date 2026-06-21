## [VULN-005] Risky JWT Secret Fallback

| Field          | Value                              |
|----------------|------------------------------------|
| OWASP 2025     | A01 — Broken Access Control        |
| Severity       | MEDIUM                             |
| Module         | apps/api/src/http/routes           |
| Files          | deals.public.routes.ts             |
| Status         | ✅ Fixed                           |

### Attack Vector
The public routes for deal acceptance used a fallback for the JWT secret: `process.env["JWT_SECRET"] ?? process.env["INTERNAL_API_TOKEN"]`. If `JWT_SECRET` was not configured, the system would use the token meant for internal service-to-service authentication to verify public-facing proposal links. This increases the impact of an `INTERNAL_API_TOKEN` leak and creates an insecure dependency between internal and external trust domains.

### Clean Architecture Impact
Affects the **Infrastructure/HTTP** layer. Environment configuration for public-facing features should be explicit and not reuse secrets from other security domains.

### Fix Applied
Removed the fallback to `INTERNAL_API_TOKEN`. The route now strictly requires `JWT_SECRET` to be set in the environment.

### Verification
- [x] Code review of `deals.public.routes.ts`.
- [x] Verified that a missing `JWT_SECRET` now correctly triggers a `CONFIG_ERROR` (500) rather than falling back.
