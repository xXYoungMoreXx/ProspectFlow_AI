## [VULN-006] Missing Payload Size Limit on Contract Acceptance

| Field          | Value                              |
|----------------|------------------------------------|
| OWASP 2025     | A05 — Injection (Resource Exhaustion) |
| Severity       | MEDIUM                             |
| Module         | apps/api/src/http/routes           |
| Files          | deals.public.routes.ts, RecordContractAcceptanceHandler.ts |
| Status         | ✅ Fixed                           |

### Attack Vector
An attacker could send an extremely large string in the `contractText` field of the `/deals/:id/accept` POST request. Processing and hashing a multi-megabyte string in memory can lead to CPU spikes and Memory Exhaustion (DoS).

### Clean Architecture Impact
Implemented in two layers for Defense in Depth:
1. **HTTP/Schema Layer**: Zod schema validation prevents large payloads from even reaching the handler.
2. **Use Case Layer**: Explicit length check in the handler as a secondary safeguard.

### Proof-of-Concept Test
```typescript
  it("VULN-006: should reject acceptance if contractText is excessively large", async () => {
    const largeContractText = "a".repeat(100001);
    const result = await handler.execute({ ..., contractText: largeContractText, ... });
    expect(result.isErr()).toBe(true);
    expect(result.error.message).toMatch(/too large/i);
  });
```

### Fix Applied
1. Added `.max(100000)` to `AcceptProposalSchema` in `deals.public.routes.ts`.
2. Added an explicit length check in `RecordContractAcceptanceHandler.ts` before hashing.

### Verification
- [x] Phase 1 TDD test now passes.
- [x] Schema validation verified via code review.
