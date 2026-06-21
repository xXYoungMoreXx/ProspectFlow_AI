## [VULN-004] Missing Idempotency Check in Contract Acceptance

| Field          | Value                              |
|----------------|------------------------------------|
| OWASP 2025     | A06 — Insecure Design              |
| Severity       | HIGH                               |
| Module         | apps/api/src/application/deal      |
| Files          | RecordContractAcceptanceHandler.ts |
| Status         | ✅ Fixed                           |

### Attack Vector
An attacker captures a valid proposal token and replays the POST request to `/deals/:id/accept` multiple times. Without idempotency checks, the system records multiple `ContractAcceptance` entries for the same deal. This can cause duplicate downstream side effects (e.g., duplicate billing, multiple project kickoff events) in an append-only architecture.

### Proof-of-Concept Test
```typescript
  it("VULN-004: should reject acceptance if the deal has already been accepted", async () => {
    const token = await createToken({ dealId, contractHash });
    repo.findByDealId.mockResolvedValueOnce(null);
    repo.save.mockResolvedValueOnce(undefined);

    await handler.execute({ token, dealId, contractText, ... });

    repo.findByDealId.mockResolvedValueOnce({ id: 'existing' } as any);
    const secondResult = await handler.execute({ token, dealId, contractText, ... });

    expect(secondResult.isErr()).toBe(true);
    expect(secondResult.error.message).toMatch(/already accepted/i);
  });
```

### Clean Architecture Impact
The fix was placed in the **Use Case** layer (`RecordContractAcceptanceHandler`). Business logic regarding the state of a deal (whether it can be accepted) belongs here, ensuring that the repository is not called for invalid state transitions.

### Fix Applied
Added a check using `acceptanceRepository.findByDealId(input.dealId)` before proceeding with recording a new acceptance. If an acceptance already exists, a `ValidationError` is returned.

### Verification
- [x] Phase 1 TDD test now passes.
- [x] Full unit test suite green.
- [x] Manual verification of logic in `RecordContractAcceptanceHandler.ts`.
