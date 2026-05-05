# Security Policy

At AgentePro, security is a fundamental pillar of our architecture. We employ a Zero Trust model, strict SSRF protections, advanced payload validations, and AI-specific safeguards.

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.0.x   | :white_check_mark: |
| 0.1.x   | :white_check_mark: |

## Reporting a Vulnerability

If you discover a security vulnerability within AgentePro, please send an e-mail to our security team at `morekaik27@gmail.com`. All security vulnerabilities will be promptly addressed.

Please include the following information in your report:

- Type of vulnerability (e.g., SSRF, XSS, Prompt Injection, IDOR).
- Step-by-step instructions to reproduce the issue.
- Potential impact and risk assessment.
- Proof of Concept (PoC) code or screenshots.

### AI and Agentic Security

Vulnerabilities involving the Agent Runtime (e.g., LLM Jailbreaking, Prompt Injection bypassing our filters, or SSRF evasion in the Python CrewAI skills) are treated with critical severity. Please report them immediately.

We appreciate your effort in making AgentePro safer!
