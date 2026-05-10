# OWASP Top 10 Summary for Builder

When generating Next.js code, ensure the following OWASP Top 10 principles are applied:

1. **A01:2021-Broken Access Control**: All APIs must authenticate requests. Use `getServerSession` or Next.js Middleware.
2. **A02:2021-Cryptographic Failures**: Never expose secrets. Use HTTPS only. Don't hardcode API keys in the frontend.
3. **A03:2021-Injection**: Always use parameterized queries for databases (e.g. Prisma or Drizzle). Do not use `dangerouslySetInnerHTML` in React unless absolutely necessary and sanitized.
4. **A04:2021-Insecure Design**: Validate all user input using Zod before processing.
5. **A05:2021-Security Misconfiguration**: Include security headers (CSP, HSTS) in `next.config.ts`.
6. **A06:2021-Vulnerable and Outdated Components**: Rely on modern, maintained libraries.
7. **A07:2021-Identification and Authentication Failures**: Use established providers (e.g., NextAuth/Auth.js).
8. **A08:2021-Software and Data Integrity Failures**: Use strict lockfiles.
9. **A09:2021-Security Logging and Failures**: Log important business actions (like HITL).
10. **A10:2021-Server-Side Request Forgery (SSRF)**: Validate any URLs provided by users before making internal server requests.
