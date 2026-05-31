## [VULN-005] Deal Acceptance Unbounded Input (DoS)

| Field          | Value                              |
|----------------|------------------------------------|
| OWASP 2025     | A05 — Injection (DoS variant)       |
| Severity       | MEDIUM                             |
| Module         | src/application/deal               |
| Files          | apps/api/src/http/routes/deals.public.routes.ts |
| Status         | ✅ Fixed                            |

### Attack Vector
The public `/accept` endpoint accepted `contractText` as a string without any length constraints. An attacker could send a massive payload (e.g., several hundred megabytes of text) which would exhaust server memory during JSON parsing, Zod validation, and SHA-256 hashing. Since this is a public endpoint, it was a high-leverage DoS vector.

### Proof-of-Concept Test
Statically verified via Zod schema audit. Payload size limits were missing.

### Clean Architecture Impact
The fix was applied at the **Infrastructure Layer** (HTTP Route/Schema). While the Domain layer could also enforce limits, the Infrastructure layer is the first line of defense to prevent resource exhaustion before the payload even reaches the inner layers.

### Fix Applied
Updated the `AcceptProposalSchema` in `deals.public.routes.ts` to include a `.max(100000)` constraint on the `contractText` field, limiting it to approximately 100KB.

### Verification
- Schema now includes `.max()` constraint.
- Fastify's global `bodyLimit` also provides a second layer of defense.

### Journal Trigger?
NO — Routine input validation.
