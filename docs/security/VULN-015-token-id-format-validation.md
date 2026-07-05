## [VULN-015] Insecure Token ID Format Handling

| Field          | Value                              |
|----------------|------------------------------------|
| OWASP 2025     | A05 — Injection                    |
| Severity       | MEDIUM                             |
| Module         | apps/api/src/application/auth      |
| Files          | auth.handlers.ts:416               |
| Status         | ✅ Fixed                           |

### Attack Vector
The `RefreshTokenHandler` extracts a `tokenId` from the provided refresh token and uses it directly in a database query. If the `tokenId` is not a valid UUID, PostgreSQL throws a syntax error. While handled by the generic error boundary, this creates unnecessary database noise, potential for log-based DoS, and bypasses the Clean Architecture's responsibility of input validation before infrastructure interaction.

### Proof-of-Concept Test
```typescript
it("should return AuthenticationError for invalid UUID tokenId", async () => {
    const result = await handler.execute("invalid-uuid.part");
    expect(result.isErr()).toBe(true);
});
```

### Clean Architecture Impact
The fix was applied in the **Application (Use Case)** layer. Validating the format of the opaque identifier before hitting the database prevents infrastructure-level leaks and ensures fail-fast behavior.

### Fix Applied
Added a strict UUID regex validation in `RefreshTokenHandler.execute`. Tokens with invalid `tokenId` parts now return a generic `AuthenticationError` immediately, preventing DB syntax errors.

### Verification
- [x] Security tests (VULN-001) now pass with valid UUIDs
- [x] E2E tests updated to use valid UUID formats in mocks

### Journal Trigger?
NO — routine fix
