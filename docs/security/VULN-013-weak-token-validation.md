## [VULN-013] Weak Token Format Validation

| Field          | Value                              |
|----------------|------------------------------------|
| OWASP 2025     | A05 — Injection                    |
| Severity       | LOW                                |
| Module         | apps/api/src/http/schemas          |
| Files          | auth.schemas.ts:41, 53             |
| Status         | ✅ Fixed                           |

### Attack Vector
Tokens were validated for length (64 characters) but not for character set. While the hashing logic would ultimately fail, accepting non-hexadecimal characters in a field expected to be a hex string is poor practice and can lead to unexpected behavior in downstream logging or database layers.

### Proof-of-Concept Test
```typescript
it("should reject non-hex tokens in VerifyEmailSchema", () => {
    const result = VerifyEmailSchema.safeParse({ token: "G".repeat(64) });
    expect(result.success).toBe(false);
});
```

### Clean Architecture Impact
The fix was applied in the **Application (DTO/Schema)** layer using Zod's regex validation.

### Fix Applied
Added a strict hexadecimal regex `/^[0-9a-fA-F]{64}$/` to all token-related Zod schemas.

### Verification
- [x] Phase 1 test now passes
- [x] Full test suite green

### Journal Trigger?
NO — routine fix
