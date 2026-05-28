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

## 📜 Regras de Contribuição e Pull Requests (OBRIGATÓRIO)

**É TERMINANTEMENTE PROIBIDO fazer *git push* direto para a branch `main`.**

O fluxo de contribuição segue um padrão estrito:
1. **Branches**: Todos os commits e pushes devem ser feitos para a branch `develop` ou para uma branch própria isolada criada por você (ex: `feat/minha-feature`, `fix/meu-bug`).
2. **Pull Requests (PRs)**: Se você deseja que sua atualização chegue à `main`, você **deve abrir um Pull Request direcionado exclusivamente para a branch `beta`**.
3. **Padrão da PR**: A descrição do seu PR deve ser detalhada, padronizada e explicar cirurgicamente qual problema ela resolve ou o que ela traz na atualização.
4. **Validação**: A sua PR deve obrigatoriamente passar por todos os *checks* do GitHub Actions.
5. **Revisão Manual**: Se os *checks* passarem, a PR será avaliada **manualmente** por mim. Eu irei aprovar ou rejeitar a PR. Em caso de rejeição, deixarei uma justificativa clara do motivo.

## 🛡️ Contato e Segurança

Se você descobrir uma vulnerabilidade ou precisar entrar em contato para discutir alguma alteração vital, a **única forma de contato oficial** é através de:
- **E-mail pessoal**: morekaik27@gmail.com
- **Discord**: youngmore / YoungMore#1752

Por favor, veja também nosso [SECURITY.md](SECURITY.md).

## ⚖️ Aviso Legal (Disclaimer)

**Deixo bem claro e de forma legal que não me responsabilizo pela forma como este sistema será utilizado, tampouco pelos resultados gerados ou prejuízos advindos da sua utilização.** O AgentePro é fornecido "como está" (as-is), cabendo única e exclusivamente ao usuário a responsabilidade sobre suas implantações e integrações.

---

Thank you for your contribution!
