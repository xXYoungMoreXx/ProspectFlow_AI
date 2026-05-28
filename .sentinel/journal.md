## 2026-05-27 — Initial Security Audit
**Module:** apps/api/src/application/auth
**VULN-ID:** VULN-001, VULN-003, VULN-004
**Vulnerability:** Timing attacks in RefreshTokenHandler and ForgotPasswordHandler.
**Root Cause:** Linear search with slow hashing (Argon2) and early returns in auth flows.
**Architectural Impact:** Application layer (Handlers) leaking metadata via response timing.
**Learning:** Even with "anti-enumeration" comments, subtle timing differences in DB writes and email enqueuing can still leak information.
**Prevention:** Use dummy operations (hashing, DB-like delays) in failure paths to match success path latency.
