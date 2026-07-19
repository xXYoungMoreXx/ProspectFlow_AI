## [VULN-006] SSRF on Custom LLM Base URL

| Field          | Value                              |
|----------------|------------------------------------|
| OWASP 2025     | A01 — Broken Access Control / SSRF |
| Severity       | HIGH                               |
| EPSS Score     | N/A                                |
| Module         | apps/api/src/application/agent     |
| Files          | apps/api/src/application/agent/agent.handlers.ts |
| Status         | ✅ Fixed                            |

### Attack Vector
An attacker with operator privileges could configure custom agent settings with a malicious `llmBaseUrl` (e.g., `http://169.254.169.254/latest/meta-data/` or internal ports like Redis or databases). When the system later attempts connectivity verification or workflow execution using that LLM base URL over the network, it acts as an internal proxy, leading to Server-Side Request Forgery (SSRF) and leakage of internal credentials or system metadata.

### Proof-of-Concept Test
```typescript
    it("should reject CreateAgentHandler with local/private LLM Base URL", async () => {
      const handler = new CreateAgentHandler(mockAgentRepo);

      const result = await handler.execute("operator-123", {
        name: "Malicious Agent",
        persona: "HUNTER",
        llmProvider: "OLLAMA",
        llmModel: "llama3",
        llmBaseUrl: "http://127.0.0.1:8545/evil",
      });

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error).toBeInstanceOf(SecurityError);
      }
    });
```

### Clean Architecture Impact
The validation logic is applied in the **Use Case / Handler** layer, validating configuration data securely before persisting it to the database. This prevents poisoned/malicious URLs from being stored, protecting subsequent outbound HTTP clients (infrastructure adapters/runtimes) from SSRF.

### Fix Applied
- Extracted and implemented robust, reusable URL validation matching standard RFC1918 blocklists.
- Hardened loopback/link-local validation specifically to block cloud metadata addresses (`169.254.x.x`).
- Added strict `isValidLlmBaseUrl` validation during Create and Update Agent executions, rejecting private, loopback, or link-local LLM base URLs with a `SecurityError`.

### Verification
Ran Sentinel security unit tests:
```bash
npx -w @agentepro/api vitest run --config vitest.sentinel.config.ts
```
All tests passed with zero regressions.

### Journal Trigger?
YES — added to `.sentinel/journal.md`.
