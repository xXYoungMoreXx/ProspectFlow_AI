## [VULN-010] ForgotPassword Timing Leak

| Field          | Value                              |
|----------------|------------------------------------|
| OWASP 2025     | A04 — Cryptographic Failures       |
| Severity       | CRITICAL                           |
| Module         | apps/api/src/application/auth      |
| Files          | auth.handlers.ts:241               |
| Status         | ✅ Fixed                           |

### Attack Vector
An attacker can perform an email enumeration attack by timing the response of the `/forgot-password` endpoint. If an email exists, the system performs a full Argon2id hash (memoryCost=65536, timeCost=3). In the vulnerable version, if the email did NOT exist, it performed a dummy hash with significantly lower parameters (memoryCost=2048, timeCost=2). The difference in execution time (hundreds of milliseconds) allows an attacker to reliably distinguish between registered and non-registered users.

### Proof-of-Concept Test
```typescript
it("should use exact ARGON2_OPTIONS for dummy work to prevent timing leaks", async () => {
    // ...
    await handler.execute("nonexistent@example.com");
    expect(hash).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        memoryCost: 65536,
        timeCost: 3,
        parallelism: 4,
        type: 2,
      })
    );
});
```

### Clean Architecture Impact
The fix was applied in the **Application (Use Case)** layer (`ForgotPasswordHandler`). This is where the business logic for handling user existence and dummy work resides.

### Fix Applied
Synchronized the Argon2 parameters used in the dummy work to match the global `ARGON2_OPTIONS` exactly. This ensures that the CPU time consumed for non-existent users is indistinguishable from that of existing users.

### Verification
- [x] Phase 1 test now passes
- [x] Full test suite green
- [x] No regressions introduced

### Journal Trigger?
YES — added to .sentinel/journal.md
