## [VULN-004] IDOR Protection in Deal Handlers

| Field          | Value                              |
|----------------|------------------------------------|
| OWASP 2025     | A01 — Broken Access Control        |
| Severity       | HIGH                               |
| EPSS Score     | N/A                                |
| Module         | apps/api/src/application/deal      |
| Files          | deal.handlers.ts                   |
| Status         | ✅ Verified / Protected             |

### Attack Vector
A malicious operator could attempt to access or cancel a deal belonging to another operator or organization by guessing the `dealId`. If the system only filtered by `id`, the attacker would gain unauthorized access to sensitive contract and pricing data.

### Proof-of-Concept Test
```typescript
it("GetDealByIdHandler should return NotFound when operatorId does not match", async () => {
  const dealId = "deal-1";
  const ownerId = "operator-owner";
  const attackerId = "operator-attacker";

  // Repository should return null if (id, operatorId, organizationId) tuple doesn't match
  const result = await handler.execute(dealId, attackerId, orgId);

  expect(result.isErr()).toBe(true);
  expect(result.error).toBeInstanceOf(NotFoundError);
});
```

### Clean Architecture Impact
The protection is enforced at the **Infrastructure (Repository)** layer, which is the most secure place for multi-tenant isolation. The Application layer (Handlers) correctly passes the `operatorId` and `organizationId` from the authenticated request context down to the repository.

### Fix Applied
Verified that `DrizzleDealRepository` already implements multi-tenant isolation in its `findById` and `findMany` methods by including `operatorId` and `organizationId` in the SQL `WHERE` clause. Handlers were audited to ensure they do not use internal "unfiltered" methods for user-facing actions.

### Verification
- Dedicated security tests in `apps/api/tests/security/deal.security.test.ts` pass, confirming that mismatching ownership results in a 404/NotFound error rather than data exposure.
