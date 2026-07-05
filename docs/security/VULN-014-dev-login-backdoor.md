## [VULN-014] Insecure DevLogin Backdoor

| Field          | Value                              |
|----------------|------------------------------------|
| OWASP 2025     | A02 — Security Misconfiguration    |
| Severity       | HIGH                               |
| Module         | apps/api/src/application/auth      |
| Files          | auth.handlers.ts:518               |
| Status         | ✅ Fixed                           |

### Attack Vector
The `DevLoginHandler` allows creating or logging into an owner account without email verification or SMTP. It relied solely on `NODE_ENV === "production"` to be disabled. In misconfigured staging or preview environments where `NODE_ENV` might not be set to `production`, this backdoor could be exposed, granting full administrative access to anyone.

### Proof-of-Concept Test
```typescript
it("should strictly refuse execution if NODE_ENV is NOT development or test", async () => {
    process.env["NODE_ENV"] = "staging";
    const result = await handler.execute("admin@example.com", "password");
    expect(result.isErr()).toBe(true);
});
```

### Clean Architecture Impact
The fix was applied in the **Application (Use Case)** layer. The handler now enforces a strict allow-list of environments.

### Fix Applied
Modified the check to only allow execution if `NODE_ENV` is explicitly "development" or "test". Any other value (including undefined or "staging") will cause the handler to fail-secure.

### Verification
- [x] Phase 1 test now passes
- [x] Full test suite green

### Journal Trigger?
NO — routine fix
