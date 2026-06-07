## [VULN-006] Weak Token Format Validation (Injection Risk)

| Field          | Value                              |
|----------------|------------------------------------|
| OWASP 2025     | A05 — Injection                    |
| Severity       | LOW                                |
| Module         | apps/api/src/http/schemas          |
| Files          | auth.schemas.ts:38-60              |
| Status         | ✅ Fixed                           |

### Attack Vector
While tokens are looked up via hash, the input validation only checked for length (64 chars). While not directly exploitable for SQL injection due to Drizzle ORM usage, missing strict format validation (hex only) is a violation of Zero Trust principles and could lead to unexpected behavior in downstream processing.

### Proof-of-Concept Test
```typescript
it("VerifyEmailSchema should only accept hex tokens", () => {
  const result = VerifyEmailSchema.safeParse({ token: "g".repeat(64) });
  expect(result.success).toBe(false);
});
```

### Clean Architecture Impact
Application layer DTO schemas were too permissive, allowing non-conformant data to enter the system.

### Fix Applied
Added regex validation (`/^[0-9a-fA-F]+$/`) to `VerifyEmailSchema` and `ResetPasswordSchema` in `auth.schemas.ts`.

### Verification
Passed `auth.sentinel.test.ts`.
