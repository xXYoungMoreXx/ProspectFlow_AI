## [VULN-007] Information Leakage via Unsanitized Error Messages

| Field          | Value                              |
|----------------|------------------------------------|
| OWASP 2025     | A10 — Exceptional Conditions        |
| Severity       | LOW                                |
| Module         | src/application/deal               |
| Files          | apps/api/src/application/deal/RecordContractAcceptanceHandler.ts |
| Status         | ✅ Fixed                            |

### Attack Vector
If an error occurred during contract acceptance recording (e.g., database failure or JWT validation error), the original error message was wrapped in a `ValidationError` and returned to the client. This could potentially leak internal stack traces, database schema details, or even parts of the sensitive input data (like the raw IP address or contract text) if they were included in the original error's message.

### Proof-of-Concept Test
Statically verified. The catch block used: `return err(new ValidationError(\`Failed to record acceptance: \${(e as Error).message}\`));`

### Clean Architecture Impact
The fix was applied at the **Application Layer** (Use Case). By sanitizing error messages before returning them to the Infrastructure layer, we ensure that the system fails securely and does not expose internal implementation details.

### Fix Applied
Updated the catch block in `RecordContractAcceptanceHandler.execute` to return a generic "Failed to record acceptance" message instead of passing through the internal error message.

### Verification
- Verified by manual code review and ensured the generic error is returned on failure.

### Journal Trigger?
NO — Standard secure coding practice.
