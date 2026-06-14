## [VULN-005] Token Hex Injection & Weak Validation

| Field          | Value                              |
|----------------|------------------------------------|
| OWASP 2025     | A05 — Injection                    |
| Severity       | MEDIUM                             |
| EPSS Score     | N/A                                |
| Module         | apps/api/src/application/auth      |
| Files          | apps/api/src/http/schemas/auth.schemas.ts, apps/api/src/application/auth/auth.handlers.ts |
| Status         | ✅ Fixed                           |

### Attack Vector
The system accepted 64-character strings as tokens for email verification and password resets without validating that they were actually hexadecimal strings. While `node:crypto`'s `createHash` handles arbitrary input, this violated the "Fail Secure" principle and allowed malformed input to reach the database query and cryptographic layers. In a scenario with complex SQL or NoSQL queries, this could lead to injection or unexpected behavior.

### Proof-of-Concept Test
```typescript
    it("should reject non-hex tokens in VerifyEmailHandler", async () => {
      const handler = new VerifyEmailHandler(mockDb);
      const result = await handler.execute("NOT-A-HEX-TOKEN-!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!");

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.message).toMatch(/Invalid token format/i);
      }
    });
```

### Clean Architecture Impact
Implemented defense-in-depth:
1.  **Application Layer (DTO):** Added regex validation to Zod schemas in `auth.schemas.ts` to reject malformed input at the entry point.
2.  **Use Case Layer:** Added manual regex checks in `auth.handlers.ts` to ensure that even if the schema is bypassed or reused incorrectly, the business logic remains secure.

### Fix Applied
Added stricter `/^[0-9a-f]{64}$/` regex validation (lowercase hex, exactly 64 characters) to:
- `VerifyEmailSchema`
- `ResetPasswordSchema`
- `VerifyEmailHandler`
- `ResetPasswordHandler`
- `verifyTokenHash` internal helper

### Verification
- Sentinel security tests `VULN-005` for both handlers pass.
- Schema validation correctly rejects non-hex input.

### Journal Trigger?
NO — routine hardening.
