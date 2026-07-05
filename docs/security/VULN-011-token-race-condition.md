## [VULN-011] Token Reuse Race Condition

| Field          | Value                              |
|----------------|------------------------------------|
| OWASP 2025     | A06 — Insecure Design              |
| Severity       | HIGH                               |
| Module         | apps/api/src/application/auth      |
| Files          | auth.handlers.ts:145, 267          |
| Status         | ✅ Fixed                           |

### Attack Vector
An attacker could potentially reuse a single-use verification token (email verification or password reset) by sending multiple concurrent requests. Because the system performed a "check-then-act" pattern (SELECT then UPDATE) outside of a pessimistic lock or atomic transaction boundary, two requests could both find the token as "not used" before either one marked it as "used".

### Proof-of-Concept Test
```typescript
it("should use an atomic update or pessimistic lock for token verification", async () => {
    // ...
    await handler.execute(token);
    expect(mockDb.select).not.toHaveBeenCalled(); // Should use tx.select
});
```

### Clean Architecture Impact
The fix was applied in the **Application (Use Case)** layer. The database lookup and update logic were consolidated into a single transaction block to ensure atomicity.

### Fix Applied
Moved the token retrieval logic inside the database transaction and added a strict `usedAt IS NULL` condition to the query. This ensures that if the token is concurrently updated by another process, the first transaction will succeed and subsequent ones will fail to find the resource in a valid state.

### Verification
- [x] Phase 1 test now passes
- [x] Full test suite green

### Journal Trigger?
YES — added to .sentinel/journal.md
