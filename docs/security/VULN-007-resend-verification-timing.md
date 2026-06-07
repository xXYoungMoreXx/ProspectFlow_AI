## [VULN-007] Resend Verification Timing Leak

| Field          | Value                              |
|----------------|------------------------------------|
| OWASP 2025     | A07 — Authentication Failures      |
| Severity       | MEDIUM                             |
| Module         | apps/api/src/application/auth      |
| Files          | auth.handlers.ts:180-185           |
| Status         | ✅ Fixed                           |

### Attack Vector
Similar to VULN-004, the `ResendVerificationHandler` returned immediately if a user was not found or already verified, while performing intensive work (generating tokens and sending emails) for valid users. This allowed an attacker to enumerate valid, unverified email addresses.

### Proof-of-Concept Test
```typescript
it("should perform dummy work when user is not found", async () => {
  await handler.execute("nonexistent@example.com");
  expect(argon2.hash).toHaveBeenCalled();
});
```

### Clean Architecture Impact
Application layer lacked consistent execution paths, leaking information about user registration status through timing.

### Fix Applied
Added dummy Argon2 hash work to the exit paths of `ResendVerificationHandler` when an operator is not found or is already verified.

### Verification
Passed `auth.sentinel.test.ts`.
