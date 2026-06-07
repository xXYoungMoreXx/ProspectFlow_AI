## [VULN-004] Forgot Password Timing Leak (Weak Dummy Work)

| Field          | Value                              |
|----------------|------------------------------------|
| OWASP 2025     | A07 — Authentication Failures      |
| Severity       | MEDIUM                             |
| Module         | apps/api/src/application/auth      |
| Files          | auth.handlers.ts:222-227           |
| Status         | ✅ Fixed                           |

### Attack Vector
An attacker could distinguish between existing and non-existing email addresses in the forgot-password flow by measuring response times. The "dummy work" meant to prevent this was using much weaker Argon2 parameters (2MB memory, 2 iterations) than the real password hash (64MB memory, 3 iterations), creating a measurable timing difference.

### Proof-of-Concept Test
```typescript
it("should use standard ARGON2_OPTIONS for dummy work", async () => {
  const handler = new ForgotPasswordHandler(mockDb, mockEmailService);
  await handler.execute("nonexistent@example.com");
  const options = vi.mocked(argon2.hash).mock.calls[0][1];
  expect(options).toMatchObject({
    memoryCost: 65536,
    timeCost: 3,
  });
});
```

### Clean Architecture Impact
Application layer implementation of anti-enumeration was flawed, leaking metadata about the database state through side channels (timing).

### Fix Applied
Updated `ForgotPasswordHandler` to use the project's standard `ARGON2_OPTIONS` for dummy work, ensuring the execution time is consistent whether the user exists or not.

### Verification
Passed `auth.sentinel.test.ts`.
