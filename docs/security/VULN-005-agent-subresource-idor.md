## [VULN-005] IDOR on Agent Sub-resources

| Field          | Value                              |
|----------------|------------------------------------|
| OWASP 2025     | A01 — Broken Access Control        |
| Severity       | HIGH                               |
| EPSS Score     | N/A                                |
| Module         | apps/api/src/application/agent     |
| Files          | apps/api/src/application/agent/workflow.handlers.ts, apps/api/src/application/agent/mcp-server.handlers.ts |
| Status         | ✅ Fixed                            |

### Attack Vector
An attacker with a standard operator account could read, update, or overwrite workflow definitions and add or test MCP server definitions belonging to agents of other operators/organizations. Since these sub-resource handler operations queried directly on ID fields (such as `agentId` or `mcpId`) without validating the operator's ownership of the parent agent, it created a severe IDOR (Insecure Direct Object Reference) boundary violation.

### Proof-of-Concept Test
```typescript
    it("should reject GetWorkflowHandler if operator does not own the agent", async () => {
      const handler = new GetWorkflowHandler(mockDb, mockAgentRepo);
      mockAgentRepo.findById.mockResolvedValue(null); // No agent found or wrong ownership

      await expect(
        handler.execute({ agentId: "agent-1", operatorId: "attacker-op" })
      ).rejects.toThrow(NotFoundError);
    });
```

### Clean Architecture Impact
The fix was placed strictly in the **Use Case / Handler** layer of Clean Architecture (`application/agent`), which is responsible for coordinating business and security rules. Placing ownership checks directly inside the application layer guarantees that no API adapter, REST route, or message worker can manipulate or read sub-resources without passing authorization constraints.

### Fix Applied
- Modified `GetWorkflowHandler`, `SaveWorkflowHandler`, `AddMCPServerHandler`, and `TestMCPServerHandler` to require an `AgentRepository` dependency and take `operatorId` as a parameter.
- Ensured that each handler fetches the target parent agent via `agentRepo.findById(agentId, operatorId, organizationId)` before performing any query or mutation on nested sub-resources.
- Enforced identical ownership/access control checks inside `/agents/:id/mcp-servers` GET route.

### Verification
Ran Sentinel security unit tests:
```bash
npx -w @agentepro/api vitest run --config vitest.sentinel.config.ts
```
All tests passed with zero regressions.

### Journal Trigger?
YES — added to `.sentinel/journal.md`.
