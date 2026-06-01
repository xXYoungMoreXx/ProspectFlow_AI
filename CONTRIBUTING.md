# Contribuindo para o ProspectFlow AI (AgentePro)

Antes de tudo, muito obrigado por considerar contribuir para o ProspectFlow AI! São pessoas como você que tornam esta ferramenta incrível.

## 🚀 Começando

### Pré-requisitos

- **Node.js** v22+ LTS — [nodejs.org](https://nodejs.org)
- **npm** 10+ (incluso no Node)
- **Docker Desktop** — Postgres 16, Redis 7, ChromaDB, Ollama, n8n, stack de observabilidade
- **Python** 3.12+ — [python.org](https://www.python.org)
- **Git** 2.9+ (para os hooks)

### Configuração do Ambiente Local

```bash
# 1. Clone
git clone https://github.com/xXYoungMoreXx/ProspectFlow_AI.git
cd ProspectFlow_AI

# 2. Instale dependências Node + ativa hooks git automaticamente
npm install
# O script `prepare` instala o Husky. Os hooks ficam em .husky/

# 3. Suba a infraestrutura local
docker compose -f infra/docker-compose.yml up -d

# 4. Configure variáveis de ambiente
cp .env.example .env
# Edite .env com suas credenciais locais (ver ENV.md para referência completa)

# 5. Aplique migrations do banco
npm run db:migrate -w @agentepro/api

# 6. (Opcional) Agent Runtime Python
cd apps/agent-runtime && pip install -e ".[dev]"

# 7. Suba tudo
npm run dev
```

> **Alternativa express:** `npm run init` executa os passos 3–6 automaticamente.

### Git Hooks (automático)

`npm install` ativa o Husky. Os seguintes hooks rodam automaticamente:

| Hook | Quando | O que faz |
|---|---|---|
| `pre-commit` | `git commit` | lint-staged (ESLint + Prettier + Ruff), bloqueia arquivos >1MB, detecta secrets hardcoded, bloqueia `console.log` em produção |
| `commit-msg` | `git commit` | Valida Conventional Commits (`feat(api): add ...`) — ver padrão abaixo |
| `pre-push` | `git push` | Bloqueia push direto a `main`, valida nome do branch, roda typecheck + unit tests |
| `post-merge` | `git pull/merge` | Auto-executa `npm install` se `package-lock.json` mudou, avisa sobre migrations novas |
| `post-checkout` | `git checkout/switch` | Idem ao `post-merge` ao trocar de branch |

Para **pular um hook em emergências** (documente o motivo no PR):
```bash
git push --no-verify   # bypassa pre-push
git commit --no-verify # bypassa pre-commit e commit-msg
```

### Formato de Commit (obrigatório)

Seguimos [Conventional Commits](https://conventionalcommits.org) conforme `CLAUDE.md §17`:

```
<tipo>(<escopo>): <descrição curta>

[corpo opcional — explique o POR QUÊ, não o QUÊ]
```

**Tipos permitidos:** `feat` · `fix` · `test` · `refactor` · `docs` · `chore` · `security` · `perf` · `ci`

**Exemplos:**
```
feat(hunter): add GoogleMapsAdapter with rate limiting and cache
fix(hitl): prevent duplicate HITL creation on retry
security(upload): add magic bytes validation for AI-generated images
chore(deps): bump drizzle-orm from 0.45.0 to 0.45.2
```

## 🛠️ Estrutura do Monorepo

| Diretório | Runtime | Descrição |
|---|---|---|
| `apps/api` | Node.js 22 + Fastify 5 | API pública, regras de negócio, BullMQ workers |
| `apps/web` | Next.js 16 + React 19 | Frontend CRM + Settings Hub |
| `apps/agent-runtime` | Python 3.12 + CrewAI | Motor de agentes IA |
| `packages/shared-types` | TypeScript | Tipos/eventos compartilhados |

Leia `CLAUDE.md` (seções 0-A e 0-B) para comandos completos e arquitetura detalhada.

## 🧪 Testes

```bash
npm run test                                  # todos os workspaces
npm run test:unit -w @agentepro/api           # só domain (rápido, sem Docker)
npm run test:integration -w @agentepro/api    # requer Docker (Testcontainers)
npx playwright test                           # E2E (dentro de apps/web)
```

Leia `TEST_STRATEGY.md` para a estratégia completa e critérios de cobertura.

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

Obrigado por contribuir!
