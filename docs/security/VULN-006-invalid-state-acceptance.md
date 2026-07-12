## [VULN-006] Invalid State Acceptance in Deal Module

| Field          | Value                              |
|----------------|------------------------------------|
| OWASP 2025     | A06 — Insecure Design              |
| Severity       | HIGH                               |
| EPSS Score     | N/A                                |
| Module         | apps/api/src/application/deal      |
| Files          | RecordContractAcceptanceHandler.ts |
| Status         | ✅ Fixed                            |

### Attack Vector
A user could accept a deal that was in an invalid state, such as `CANCELLED` or already `CLOSED`, by hitting the public `/accept` endpoint with a valid (but perhaps old or leaked) token. The handler only verified the JWT and the contract hash, but never checked the current state of the Deal in the database. This allowed "ghost acceptances" on deals that were no longer eligible for acceptance.

### Proof-of-Concept Test
```typescript
it("should reject acceptance if the deal is CANCELLED", async () => {
  mockDealRepo.findByIdInternal.mockResolvedValue({
    id: dealId,
    status: "CANCELLED",
  });
  const result = await handler.execute({ ... });
  expect(result.isErr()).toBe(true);
  expect(result.error?.message).toMatch(/invalid deal status/i);
});
```

### Clean Architecture Impact
The fix required the Use Case (`RecordContractAcceptanceHandler`) to interact with the `DealRepository`. This highlights that even "public" or "token-based" handlers must verify the current state of the domain entities they affect, not just the validity of the incoming token.

### Fix Applied
Injected `DealRepository` into `RecordContractAcceptanceHandler`. The handler now fetches the deal using `findByIdInternal` and verifies that its status is `PROPOSED` or `NEGOTIATING` before allowing the acceptance to be recorded. It also correctly transitions the deal state to `CLOSED` upon successful acceptance.

### Verification
- Phase 1 security test now passes.
- Unit tests remain green.

### Journal Trigger?
YES — added to .sentinel/journal.md
