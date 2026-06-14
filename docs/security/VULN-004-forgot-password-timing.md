## [VULN-004] ForgotPassword Timing Side-Channel

| Field          | Value                              |
|----------------|------------------------------------|
| OWASP 2025     | A01 — Broken Access Control        |
| Severity       | HIGH                               |
| EPSS Score     | N/A                                |
| Module         | apps/api/src/application/auth      |
| Files          | apps/api/src/application/auth/auth.handlers.ts:225 |
| Status         | ✅ Fixed                           |

### Attack Vector
An attacker can iterate through a list of email addresses and measure the response time of the `/forgot-password` endpoint.
Previously, for non-existent users, the system performed dummy work with `memoryCost: 2048`. For real users, it performed database operations and sent emails, but more importantly, the Argon2 standard for the rest of the application is `65536`.
This created a measurable timing difference (approximately 32x difference in CPU/memory usage for the hash portion), allowing the attacker to confirm whether an email is registered in the system.

### Proof-of-Concept Test
```typescript
  describe("VULN-004: ForgotPassword Timing Side-Channel", () => {
    it("should use exactly 64MB memory cost for dummy work", async () => {
      const handler = new ForgotPasswordHandler(mockDb, mockEmailService);

      // Mock user not found
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      await handler.execute("nonexistent@example.com");

      expect(argon2.hash).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          memoryCost: 65536,
        })
      );
    });
  });
```

### Clean Architecture Impact
The fix was applied in the **Use Case (Application)** layer (`ForgotPasswordHandler`). This is the correct layer as it manages the orchestration of the forgot-password business process, including the anti-enumeration logic.

### Fix Applied
Aligned the Argon2 dummy work parameters in `ForgotPasswordHandler` to exactly match the `ARGON2_OPTIONS` used globally (`memoryCost: 65536`). This ensures that the cryptographic workload is identical regardless of whether the user exists or not.

### Verification
- Sentinel security test `VULN-004` passes.
- Dummy work now correctly invokes `argon2.hash` with `memoryCost: 65536`.

### Journal Trigger?
YES — added to `.sentinel/journal.md`.
