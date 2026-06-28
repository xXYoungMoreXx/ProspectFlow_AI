## [VULN-005] Missing Strict Token Format Validation

| Field          | Value                              |
|----------------|------------------------------------|
| OWASP 2025     | A01 — Broken Access Control        |
| Severity       | MEDIUM                             |
| EPSS Score     | N/A                                |
| Module         | apps/api/src/http/schemas/         |
| Files          | auth.schemas.ts                    |
| Status         | ✅ Fixed                           |

### Attack Vector
The authentication system uses 64-character hex tokens for email verification and password resets. Previously, the Zod schemas only validated the string length (64 characters) but did not enforce the hexadecimal format. An attacker could submit tokens containing non-hex characters. While the hashing layer might catch some issues, improper validation at the edge can lead to unexpected behavior in downstream layers, including database query errors or potential bypasses if tokens are treated inconsistently.

### Proof-of-Concept Test
```typescript
it("VerifyEmailSchema should reject non-hex tokens", () => {
  const result = VerifyEmailSchema.safeParse({ token: "g".repeat(64) });
  expect(result.success).toBe(false);
});
```

### Clean Architecture Impact
This vulnerability affected the **Application/DTO** layer (schemas). The fix was placed in the schemas to ensure that invalid data is rejected at the entry point of the application, adhering to the "Fail Secure" principle.

### Fix Applied
Updated `VerifyEmailSchema` and `ResetPasswordSchema` in `apps/api/src/http/schemas/auth.schemas.ts` to use a strict regular expression: `/^[0-9a-f]{64}$/`.

### Verification
- Phase 1 TDD test now passes.
- Verified that tokens with non-hex characters are rejected with `INVALID_TOKEN_FORMAT`.

### Journal Trigger?
NO — routine fix for validation strengthening.
