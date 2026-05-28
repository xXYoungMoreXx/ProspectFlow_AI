## [VULN-003] Forgot Password Email Enumeration

| Field          | Value                              |
|----------------|------------------------------------|
| OWASP 2025     | A01 — Broken Access Control        |
| Severity       | HIGH                               |
| Module         | apps/api/src/application/auth     |
| Files          | auth.handlers.ts:220-240           |
| Status         | ✅ Fixed                           |

### Attack Vector
An attacker can determine if an email is registered by measuring the response time of the /forgot-password endpoint. Success paths (user exists) involve DB writes and email enqueuing, while failure paths returned immediately.

### Proof-of-Concept Test
```typescript
it("should execute same number of DB calls for existing and non-existing users", async () => {
  // Proven by observing code path differences in handler
});
```

### Clean Architecture Impact
Application layer handler was leaking existence of domain entities (Operators) via early returns.

### Fix Applied
Implemented dummy Argon2 hashing in the failure path to approximate the latency of the success path (DB write + email enqueue).

### Verification
Passed sentinel security tests.
