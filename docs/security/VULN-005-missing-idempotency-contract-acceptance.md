## [VULN-005] Missing Idempotency in Contract Acceptance

| Field          | Value                              |
|----------------|------------------------------------|
| OWASP 2025     | A06 — Insecure Design              |
| Severity       | HIGH                               |
| EPSS Score     | N/A                                |
| Module         | apps/api/src/application/deal      |
| Files          | RecordContractAcceptanceHandler.ts |
| Status         | ✅ Fixed                            |

### Attack Vector
An attacker or a malfunctioning client could submit multiple POST requests to the `/api/v1/deals/:id/accept` endpoint for the same deal. Since the handler didn't check for existing acceptances, it would record multiple entries in the `contract_acceptances` table. This could lead to business logic errors, duplicate state transitions, or legal ambiguity regarding which acceptance is binding.

### Proof-of-Concept Test
```typescript
it("should reject duplicate acceptances for the same deal", async () => {
  const dealId = "deal-123";
  const contractText = "Legal Terms";
  // ... token generation ...
  mockAcceptanceRepo.findByDealId.mockResolvedValue({ id: "existing-acc" });
  const result = await handler.execute({ ... });
  expect(result.isErr()).toBe(true);
  expect(result.error?.message).toMatch(/already accepted/i);
});
```

### Clean Architecture Impact
The fix was applied at the **Application (Use Case)** layer. The Use Case is responsible for orchestrating domain objects and enforcing cross-aggregate business rules (like ensuring a deal isn't accepted twice).

### Fix Applied
Added a check to `RecordContractAcceptanceHandler.ts` that queries the `ContractAcceptanceRepository` for an existing acceptance for the given `dealId` before proceeding with the recording of a new one.

### Verification
- Phase 1 security test now passes.
- Unit tests for the domain and use cases remain green.

### Journal Trigger?
YES — added to .sentinel/journal.md
