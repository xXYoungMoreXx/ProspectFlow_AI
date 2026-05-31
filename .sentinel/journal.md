## 2025-05-22 — Idempotency in Clickwrap Flows
**Module:** src/application/deal
**VULN-ID:** VULN-004
**Vulnerability:** Deal Acceptance Replay
**Root Cause:** The system followed an append-only philosophy for the `contract_acceptances` table but failed to enforce business-level idempotency in the application layer. It assumed frontend validation or "once-sent-once-signed" logic without server-side enforcement.
**Architectural Impact:** Application (Use Case) layer.
**Learning:** Append-only tables are great for audit logs, but the Use Case that writes to them must often implement its own idempotency check against the aggregate's state or the existence of a previous record to prevent business logic replay.
**Prevention:** Always check if a terminal state (like "ACCEPTED") has already been reached before performing the write operation in public or sensitive use cases.
