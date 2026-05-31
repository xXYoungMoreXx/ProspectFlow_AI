## [VULN-004] Deal Acceptance Replay (Lack of Idempotency)

| Field          | Value                              |
|----------------|------------------------------------|
| OWASP 2025     | A06 — Insecure Design              |
| Severity       | HIGH                               |
| Module         | src/application/deal               |
| Files          | apps/api/src/application/deal/RecordContractAcceptanceHandler.ts |
| Status         | ✅ Fixed                            |

### Attack Vector
An attacker or a user could resubmit the contract acceptance multiple times for the same deal. While the tokens are signed and valid, the system lacked a check to see if the deal had already been closed/accepted. This could lead to duplicate records in the database, potentially triggering multiple fulfillment workflows, corrupting audit trails, or enabling "race-to-the-bottom" exploits in downstream systems.

### Proof-of-Concept Test
```typescript
it("should reject a second acceptance for the same deal", async () => {
  const handler = new RecordContractAcceptanceHandler(mockAcceptanceRepo as any, JWT_SECRET);
  // ... setup mock repository to return an existing acceptance
  const result = await handler.execute({ ... });
  expect(result.isErr()).toBe(true);
  expect(result.error.message).toContain("already been accepted");
});
```

### Clean Architecture Impact
The fix was applied at the **Application Layer** (Use Case). The `RecordContractAcceptanceHandler` now orchestrates the check against the `ContractAcceptanceRepository` before proceeding with the business logic of recording a new acceptance. This ensures that the rule is enforced regardless of which delivery mechanism (HTTP, CLI, Queue) triggers the action.

### Fix Applied
Added a pre-validation step in `RecordContractAcceptanceHandler.execute` that queries the repository for any existing acceptance for the given `dealId`. If one is found, it returns a `ValidationError`.

### Verification
- Unit test `tests/security/deals.unit.sentinel.test.ts` passes.
- Manual verification of the logic flow.
- No regressions in deal acceptance flow.

### Journal Trigger?
YES — Idempotency in clickwrap flows is a critical pattern for Amuri.
