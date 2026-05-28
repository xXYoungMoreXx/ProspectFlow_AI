## [VULN-001] Refresh Token Linear Scan Timing / DoS

| Field          | Value                              |
|----------------|------------------------------------|
| OWASP 2025     | A02 — Security Misconfiguration    |
| Severity       | MEDIUM                             |
| Module         | apps/api/src/application/auth     |
| Files          | auth.handlers.ts:380-400           |
| Status         | ✅ Fixed                           |

### Attack Vector
An attacker with many active (or revoked but not cleared) refresh tokens could cause high CPU usage and response delay by forcing the server to perform linear Argon2 verification across a large list of tokens.

### Proof-of-Concept Test
```typescript
it("should NOT fetch multiple tokens for linear scan", async () => {
  const handler = new RefreshTokenHandler(mockDb);
  await handler.execute("some-token");
  const limitCall = mockDb.select().from().where().limit.mock.calls[0][0];
  expect(limitCall).toBe(1);
});
```

### Clean Architecture Impact
Application layer leaked timing data and was vulnerable to DoS due to inefficient infrastructure-level lookup logic being managed in the handler.

### Fix Applied
Refactored refresh tokens to include a prefix (ULID) in the opaque string. The handler now performs an O(1) lookup by ID before verifying the hash, preventing linear Argon2 scans.

### Verification
Passed sentinel security tests and unit tests.
