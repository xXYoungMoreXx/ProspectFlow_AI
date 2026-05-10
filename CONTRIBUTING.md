# Contributing to ProspectFlow AI (AgentePro)

First off, thank you for considering contributing to ProspectFlow AI! It's people like you that make this tool great.

## 🚀 Getting Started

### Prerequisites
- **Node.js**: v22+ (LTS)
- **pnpm**: v9+
- **Docker Desktop**: For infrastructure (Postgres, Redis, etc.)
- **Python**: v3.12+ (for Agent Runtime)

### Local Development Setup

1.  **Clone the repository**:
    ```bash
    git clone https://github.com/xXYoungMoreXx/ProspectFlow_AI.git
    cd ProspectFlow_AI
    ```

2.  **Install dependencies**:
    ```bash
    pnpm install
    ```

3.  **Start Infrastructure**:
    ```bash
    docker-compose -f infra/docker-compose.yml up -d
    ```

4.  **Database Migration**:
    ```bash
    pnpm --filter @agentepro/api db:migrate
    ```

5.  **Run Development Servers**:
    ```bash
    pnpm dev
    ```

## 🛠️ Monorepo Structure

- `apps/api`: Fastify backend (Node.js)
- `apps/web`: Next.js dashboard (Frontend)
- `apps/agent-runtime`: CrewAI/FastAPI runtime (Python)
- `packages/shared-types`: Shared TypeScript interfaces

## 🧪 Testing

- **Unit/Integration**: `pnpm test`
- **E2E (Playwright)**: `pnpm --filter @agentepro/web exec playwright test`

## 📜 Pull Request Guidelines

1.  **Branch Naming**: Use `feat/`, `fix/`, `chore/`, or `docs/`.
2.  **Linting**: Ensure `pnpm lint` passes.
3.  **Tests**: New features should include unit or E2E tests.
4.  **Commits**: Use [Conventional Commits](https://www.conventionalcommits.org/).

## 🛡️ Security

If you discover a security vulnerability, please check our [SECURITY.md](SECURITY.md).

---

Thank you for your contribution!
