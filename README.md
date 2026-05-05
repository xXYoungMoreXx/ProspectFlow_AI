# AgentePro (formerly ProspectFlow AI) 🚀

AgentePro is an enterprise-grade, event-driven platform for automated B2B prospecting, multi-agent AI orchestration (CrewAI), and website generation.

## 🏗 Architecture

The platform has been modernized into a Turborepo monorepo with a Hexagonal/Clean Architecture:

- **`apps/api`**: Fastify backend (Node.js/TypeScript) utilizing Drizzle ORM, BullMQ for background jobs, and robust security protocols (Zero Trust, RBAC, SSRF protection).
- **`apps/web`**: Next.js frontend with TailwindCSS, shadcn/ui, providing the CRM dashboard and HITL (Human-in-the-Loop) interfaces.
- **`apps/agent-runtime`**: Python microservice using CrewAI to orchestrate specialized AI agents (Hunter, Closer, Builder) with integration to LLMs (Gemini, Claude) and ChromaDB.
- **`packages/*`**: Shared configurations, TypeScript interfaces (`shared-types`), and database schemas (`database`).
- **`infra/`**: Docker Compose configurations for the local ecosystem (PostgreSQL, Redis, Evolution API, ChromaDB).

## 🚀 Quick Start (Local Environment)

### Prerequisites
- Node.js (v22+)
- Python (v3.12+)
- Docker & Docker Compose
- API Keys (OpenAI, Anthropic, Gemini, Google Places)

### 1. Bootstrap Infrastructure
Run the setup script to initialize Docker containers (DB, Redis, etc.) and run the initial Drizzle migrations:
```bash
./infra/scripts/setup.sh
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Run the Development Server
Use Turborepo to start the API, Web App, and background services simultaneously:
```bash
npm run dev
```

The services will be available at:
- **Web Dashboard**: http://localhost:3000
- **API Server**: http://localhost:3001
- **Agent Runtime**: http://localhost:8001

## 🛡 Security & Testing

AgentePro enforces strict security policies out-of-the-box:
- **Zero Trust File Uploads**: Magic byte validation blocks hidden executables, limited to 10MB per file.
- **SSRF Protection**: Prevents AI agents from accessing local network endpoints or cloud metadata.
- **Anti-Injection**: Drizzle ORM native parameterization and strict Zod validation on all inputs.
- **Identity & Access**: Argon2id hashing, RS256 JWTs with audience validation, and strict IDOR checks on all routes.

To run the full test suite (Unit, Integration, Security):
```bash
npm run test
```
To run specifically the security tests:
```bash
npm run test:security --workspace=apps/api
```

## 📜 Documentation
- PRD & Specifications: `docs/PRD_AgentePro.md`
- Security Policy: `SECURITY.md`
- Tracking: `task.md`

## ⚖️ License
Proprietary. See `LICENSE` for details.
