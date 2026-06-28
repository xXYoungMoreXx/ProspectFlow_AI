## [VULN-006] Argon2 Parameter Mismatch in Dummy Work (Timing Leak)

| Field          | Value                              |
|----------------|------------------------------------|
| OWASP 2025     | A07 — Authentication Failures      |
| Severity       | MEDIUM                             |
| EPSS Score     | N/A                                |
| Module         | apps/api/src/application/auth/     |
| Files          | auth.handlers.ts                   |
| Status         | ✅ Fixed                           |

### Attack Vector
The `ForgotPasswordHandler` implements anti-enumeration by performing "dummy work" (an Argon2 hash) when a requested email does not exist in the database. However, the dummy work was using significantly lower cryptographic parameters (`memoryCost: 2048`, `timeCost: 2`) compared to the actual password hashing parameters (`memoryCost: 65536`, `timeCost: 3`). This created a measurable timing difference between requests for existing vs. non-existing users, allowing an attacker to reliably enumerate valid email addresses in the system.

### Proof-of-Concept Test
```typescript
expect(argon2.hash).toHaveBeenCalledWith(
  expect.any(String),
  expect.objectContaining({
    memoryCost: 65536,
    timeCost: 3,
  })
);
```

### Clean Architecture Impact
This vulnerability affected the **Use Case** layer (`ForgotPasswordHandler`). The fix belongs in the Use Case to ensure that business logic paths (existing vs non-existing user) have identical timing signatures.

### Fix Applied
Updated `ForgotPasswordHandler.execute` in `apps/api/src/application/auth/auth.handlers.ts` to use the global `ARGON2_OPTIONS` constant for dummy work, matching the parameters used for real password verification.

### Verification
- Phase 1 TDD test now passes (mock verification).
- Timing parity restored between existing and non-existing user paths.

### Journal Trigger?
YES — recorded in `.sentinel/journal.md` regarding consistent crypto parameters.
