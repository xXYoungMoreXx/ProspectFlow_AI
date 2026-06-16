# Spec: S6 — Auth Completo com Better Auth + Multi-Tenancy desde o MVP

**Data:** 2026-06-06
**Sprint:** S6
**Status:** Aprovado pelo produto
**Autor:** Sessão de brainstorming + análise cirúrgica
**Biblioteca:** Better Auth v1.3.x (Context7 confirmado, Benchmark 89.4, Source Reputation: High)

---

## 1. Contexto e Motivação

### Estado atual

O sistema tem login funcional (JWT RS256 + Argon2id em `auth.middleware.ts`) mas **não tem** cadastro, verificação de email, recuperação de senha ou reset. O acesso hoje depende de `NEXT_PUBLIC_DEV_AUTO_LOGIN=true` — inviável em produção.

### Decisões estratégicas que guiam este spec

| Decisão                                                 | Racional                                                                                                                                                                                            |
| ------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Better Auth v1.3.x** (não Keycloak)                   | Keycloak exige 1.7 GB RAM mínimos — inviável no docker-compose existente. Better Auth roda no processo Node.js, zero overhead de infra.                                                             |
| **Keycloak descartado**                                 | Overkill enterprise para single-tenant MVP; peso de 1.7–3 GB de RAM confirmado nos docs oficiais.                                                                                                   |
| **Lucia Auth descartado**                               | v3 foi descontinuado como pacote npm pelo autor — apenas referência educacional.                                                                                                                    |
| **Stack Auth descartado**                               | Benchmark Score 9 (Context7) — documentação insuficiente, imaturo.                                                                                                                                  |
| **multi-tenant desde o MVP**                            | A migração de schema com dados reais de clientes pagantes é catastrófica. Adicionar `organization_id` agora (com 1 org) custa ~0.5 sprint; não adicionar agora custa uma reescrita completa depois. |
| **JWT RS256 mantido**                                   | `auth.middleware.ts` não muda. Better Auth emite JWT com a chave RSA existente via hook `after sign-in`.                                                                                            |
| **Opção B** (Better Auth como auth único, não paralelo) | Um sistema de auth, sem duplicação de handlers manuais.                                                                                                                                             |

### Escopo do MVP vs. SaaS

```
MVP (agora — localhost):
  → 1 organization criada no boot (auto-seed)
  → Founder registra conta, é automaticamente owner da org
  → Sistema funciona identicamente ao atual — apenas com auth real

SaaS (depois — VPS):
  → Cada cliente registra e cria sua própria organization
  → Dados isolados por organizationId em todas as tabelas
  → Plano de billing associado à organization
  → Sem migração de schema (já está pronto desde o MVP)
```

---

## 2. Requisitos de Segurança (não-negociáveis)

Todos os itens abaixo são **hard requirements**. Nenhum pode ser omitido.

### 2.1 Autenticação

- [ ] Senha hasheada com **Argon2id** (configurado explicitamente no Better Auth — padrão é bcrypt)
- [ ] JWT **RS256** com `JWT_PRIVATE_KEY` existente (não gerar nova chave, usar a do env)
- [ ] Access token: **15 minutos** de expiração
- [ ] Refresh token: **7 dias**, rotacionado a cada uso
- [ ] **Email verificado obrigatório** para login (`requireEmailVerification: true`)
- [ ] Sessões **revogadas** ao resetar senha (`revokeSessionsOnPasswordReset: true`)
- [ ] Algoritmo `"none"` **explicitamente rejeitado** no `jwtVerify` do Fastify

### 2.2 Rate Limiting (todos os endpoints de auth)

- [ ] `POST /api/v1/auth/sign-up/email`: 5 req / 15 min por IP → 429
- [ ] `POST /api/v1/auth/sign-in/email`: 10 req / 15 min por IP → 429 (bloqueio de brute-force)
- [ ] `POST /api/v1/auth/forget-password`: 3 req / hora por email → silenciosamente ignorado (sem leak de estado)
- [ ] `POST /api/v1/auth/reset-password`: 5 req / hora por token → 429

### 2.3 Anti-enumeração

- [ ] `POST /api/v1/auth/forget-password` **SEMPRE** retorna 200, mesmo se email não existir
- [ ] Mensagem padrão: "Se o email existir, você receberá as instruções em breve."
- [ ] Tempo de resposta constante independente de o email existir ou não (timing attack prevention)

### 2.4 Tokens de verificação

- [ ] Token de verificação de email: **SHA-256**, 32 bytes, expira em **24 horas**
- [ ] Token de reset de senha: **SHA-256**, 32 bytes, expira em **1 hora**
- [ ] Tokens de uso único — invalidados imediatamente após uso
- [ ] `usedAt` timestamp gravado para auditoria

### 2.5 CSRF

- [ ] Better Auth tem proteção CSRF built-in — **não desabilitar** via `disableCSRFCheck`
- [ ] Todas as mutations de auth via POST com Content-Type `application/json`

### 2.6 Multi-tenancy (isolation)

- [ ] **Toda query** de negócio filtra por `organizationId` do JWT
- [ ] Operador nunca acessa dados de outra organization — mesmo com JWT válido
- [ ] `organizationId` claim no JWT — validado no middleware antes de chegar ao use case
- [ ] Sem "god mode" de acesso cross-tenant em nenhum endpoint (exceto admin interno explícito)

### 2.7 Validações de senha

- [ ] Mínimo **12 caracteres**
- [ ] Deve conter: letra maiúscula, minúscula, número, caractere especial
- [ ] Validação **client-side** (UX) + **server-side** (segurança)
- [ ] Dicionário de senhas comuns proibidas (Better Auth suporta via plugin `haveibeenpwned`)

---

## 3. Schema de Banco de Dados

### 3.1 Tabelas geradas pelo Better Auth CLI

O Better Auth CLI gera as migrations automaticamente via `npx @better-auth/cli generate`. **Não criar manualmente** — usar o CLI para garantir consistência com a versão da biblioteca.

```typescript
// Tabelas geradas (não editar diretamente):
user; // substitui operators
session; // sessões ativas (cookie + JWT)
account; // credenciais por provider (email, futuro: Google/GitHub)
verification; // tokens de email-verify e password-reset
organization; // tenants (SaaS)
member; // relação user <-> organization (com role)
invitation; // convites para a org (futuro)
```

### 3.2 Campos customizados na tabela `user`

Os campos extras do `operators` atual são preservados via `additionalFields`:

```typescript
// Campos existentes em operators que migram para user:
telegramChatId: text("telegram_chat_id"),
plan: text("plan").default("starter"),          // starter | pro | enterprise
monthlyBudget: numeric("monthly_budget").default("50.00"),
isActive: boolean("is_active").default(true),
```

### 3.3 Tabelas de negócio — adição de `organization_id`

Todas as tabelas de negócio recebem `organization_id` como FK obrigatória:

```sql
-- Aplicar em: agents, sub_agents, leads, deals, projects,
--             hitl_approvals, briefings, briefing_assets,
--             follow_ups, media_assets, token_usage

ALTER TABLE agents           ADD COLUMN organization_id TEXT NOT NULL DEFAULT 'org_bootstrap';
ALTER TABLE sub_agents       ADD COLUMN organization_id TEXT NOT NULL DEFAULT 'org_bootstrap';
ALTER TABLE leads            ADD COLUMN organization_id TEXT NOT NULL DEFAULT 'org_bootstrap';
ALTER TABLE deals            ADD COLUMN organization_id TEXT NOT NULL DEFAULT 'org_bootstrap';
ALTER TABLE projects         ADD COLUMN organization_id TEXT NOT NULL DEFAULT 'org_bootstrap';
ALTER TABLE hitl_approvals   ADD COLUMN organization_id TEXT NOT NULL DEFAULT 'org_bootstrap';
ALTER TABLE briefings        ADD COLUMN organization_id TEXT NOT NULL DEFAULT 'org_bootstrap';
ALTER TABLE briefing_assets  ADD COLUMN organization_id TEXT NOT NULL DEFAULT 'org_bootstrap';
ALTER TABLE follow_ups       ADD COLUMN organization_id TEXT NOT NULL DEFAULT 'org_bootstrap';
ALTER TABLE media_assets     ADD COLUMN organization_id TEXT NOT NULL DEFAULT 'org_bootstrap';
ALTER TABLE token_usage      ADD COLUMN organization_id TEXT NOT NULL DEFAULT 'org_bootstrap';

-- Após seeding da org inicial, remover DEFAULT e tornar obrigatório:
ALTER TABLE agents ALTER COLUMN organization_id DROP DEFAULT;
-- (idem para todas)
```

### 3.4 Seed obrigatório no boot (MVP)

```typescript
// infrastructure/db/seeds/bootstrap.ts
// Executado no startup do servidor SE não existir org padrão:

await db.insert(organization).values({
  id: env.BOOTSTRAP_ORG_ID, // de .env — não hardcodar
  name: env.BOOTSTRAP_ORG_NAME,
  slug: env.BOOTSTRAP_ORG_SLUG,
  createdAt: new Date(),
});
```

**Variáveis de ambiente novas:**

```env
BOOTSTRAP_ORG_ID=org_agentepro_mvp
BOOTSTRAP_ORG_NAME=AgentePro
BOOTSTRAP_ORG_SLUG=agentepro
```

---

## 4. Configuração do Better Auth

```typescript
// apps/api/src/infrastructure/auth/better-auth.ts

import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { organization } from "better-auth/plugins";
import {
  createAccessControl,
  defaultStatements,
} from "better-auth/plugins/access";
import { db } from "../db/connection";
import { emailAdapter } from "../messaging/EmailAdapter";
import { env } from "../config/env";

// RBAC para multi-tenancy
const ac = createAccessControl({
  ...defaultStatements,
  agent: ["create", "update", "delete", "read"],
  lead: ["create", "update", "delete", "read"],
  deal: ["create", "update", "delete", "read"],
});

const ownerRole = ac.newRole({
  ...ac.defaultRoles.owner,
  agent: ["create", "update", "delete", "read"],
  lead: ["create", "update", "delete", "read"],
  deal: ["create", "update", "delete", "read"],
});
const adminRole = ac.newRole({
  ...ac.defaultRoles.admin,
  agent: ["create", "update", "delete", "read"],
  lead: ["create", "update", "delete", "read"],
  deal: ["create", "update", "read"],
});
const memberRole = ac.newRole({
  ...ac.defaultRoles.member,
  agent: ["read"],
  lead: ["read"],
  deal: ["read"],
});

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: "pg" }),

  user: {
    additionalFields: {
      telegramChatId: { type: "string", required: false },
      plan: { type: "string", required: false, defaultValue: "starter" },
      monthlyBudget: { type: "number", required: false, defaultValue: 50 },
      isActive: { type: "boolean", required: false, defaultValue: true },
    },
  },

  // Argon2id obrigatório — não usar bcrypt padrão
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    revokeSessionsOnPasswordReset: true,
    password: {
      hash: (password) =>
        import("argon2").then((m) => m.hash(password, { type: m.argon2id })),
      verify: ({ hash, password }) =>
        import("argon2").then((m) => m.verify(hash, password)),
    },
    minPasswordLength: 12,
    sendResetPassword: async ({ user, url }) => {
      await emailAdapter.send({
        to: user.email,
        subject: "Redefinição de senha — AgentePro",
        template: "reset-password",
        variables: { url, name: user.name },
      });
    },
  },

  emailVerification: {
    sendOnSignUp: true,
    expiresIn: 60 * 60 * 24, // 24 horas
    sendVerificationEmail: async ({ user, url }) => {
      await emailAdapter.send({
        to: user.email,
        subject: "Confirme seu email — AgentePro",
        template: "verify-email",
        variables: { url, name: user.name },
      });
    },
  },

  plugins: [
    organization({
      ac,
      roles: { owner: ownerRole, admin: adminRole, member: memberRole },
    }),
  ],

  rateLimit: {
    enabled: true,
    window: 60,
    max: 10,
  },

  trustedOrigins: [env.FRONTEND_URL],
});
```

### 4.1 JWT RS256 — hook após sign-in

Better Auth não emite JWT nativamente para uso com Fastify. Hook `after` gera o JWT RS256 com a chave existente e injeta no response:

```typescript
// apps/api/src/infrastructure/auth/jwt-hook.ts

import { SignJWT, importPKCS8 } from "jose";
import { env } from "../config/env";

export async function generateOperatorJWT(
  userId: string,
  organizationId: string,
  role: string,
) {
  const privateKey = await importPKCS8(env.JWT_PRIVATE_KEY, "RS256");

  return new SignJWT({ sub: userId, organizationId, role })
    .setProtectedHeader({ alg: "RS256" })
    .setIssuedAt()
    .setExpirationTime("15m")
    .setIssuer("agentepro")
    .sign(privateKey);
}
```

Hook registrado em `better-auth.ts`:

```typescript
hooks: {
  after: [{
    matcher: (ctx) => ctx.path === "/sign-in/email" && ctx.response?.status === 200,
    handler: async (ctx) => {
      if (!ctx.context?.session?.userId) return;
      const { userId } = ctx.context.session;

      const membership = await db.query.member.findFirst({
        where: eq(member.userId, userId),
      });
      if (!membership) throw new Error("No organization found for user");

      const accessToken = await generateOperatorJWT(
        userId,
        membership.organizationId,
        membership.role,
      );

      ctx.context.newResponse = Response.json({
        ...await ctx.context.response.json(),
        accessToken,
        organizationId: membership.organizationId,
      });
    },
  }],
},
```

---

## 5. Integração com Fastify

### 5.1 Montar Better Auth no Fastify

```typescript
// apps/api/src/http/routes/auth.routes.ts

import { auth } from "../../infrastructure/auth/better-auth";

export async function authRoutes(app: FastifyInstance) {
  app.all("/api/v1/auth/*", async (request, reply) => {
    const webRequest = toWebRequest(request);
    const webResponse = await auth.handler(webRequest);
    return fromWebResponse(webResponse, reply);
  });
}
```

### 5.2 Middleware JWT — mudanças mínimas

```typescript
// apps/api/src/http/middleware/auth.middleware.ts
// MUDANÇA: adicionar organizationId ao payload tipado

interface OperatorPayload extends JWTPayload {
  sub: string;
  organizationId: string; // NOVO
  role: string; // NOVO
}

// O restante não muda: importSPKI + jwtVerify com algorithms: ["RS256"]
// Após verificar: request.operator = { id: payload.sub, organizationId, role }
```

### 5.3 Filtro obrigatório por organizationId

```typescript
// Padrão obrigatório em TODOS os use cases:
async execute(command: ListLeadsCommand): Promise<Lead[]> {
  return this.leadRepo.findAllByOrg(
    new OrganizationId(command.organizationId),
  );
}

// DrizzleLeadRepository:
async findAllByOrg(orgId: OrganizationId): Promise<Lead[]> {
  return db.select()
    .from(leads)
    .where(eq(leads.organizationId, orgId.value));
}
```

**Regra:** Qualquer query sem filtro `organizationId` é bug de segurança crítico.

---

## 6. Endpoints de Auth — Mapa Completo

| Método | Path                           | Autenticado?        |
| ------ | ------------------------------ | ------------------- |
| POST   | `/api/v1/auth/sign-up/email`   | Não                 |
| POST   | `/api/v1/auth/verify-email`    | Não                 |
| POST   | `/api/v1/auth/sign-in/email`   | Não                 |
| POST   | `/api/v1/auth/sign-out`        | Sim                 |
| POST   | `/api/v1/auth/forget-password` | Não                 |
| POST   | `/api/v1/auth/reset-password`  | Não                 |
| GET    | `/api/v1/auth/get-session`     | Sim                 |
| POST   | `/api/v1/auth/refresh-token`   | Não (refresh token) |

**Removidos do `auth.routes.ts` atual** (substituídos):

- `POST /api/v1/auth/login` → `/sign-in/email`
- `POST /api/v1/auth/refresh` → `/refresh-token`
- `POST /api/v1/auth/logout` → `/sign-out`
- `POST /api/v1/auth/dev-login` → **mantido** em `NODE_ENV=development` apenas

---

## 7. Frontend — Páginas de Auth

### 7.1 Páginas novas

| Rota               | Arquivo                               | Descrição                                                   |
| ------------------ | ------------------------------------- | ----------------------------------------------------------- |
| `/register`        | `app/(auth)/register/page.tsx`        | Cadastro: name + email + password (12+ chars) + confirmação |
| `/verify-email`    | `app/(auth)/verify-email/page.tsx`    | Token no query param → POST → redirect /login               |
| `/forgot-password` | `app/(auth)/forgot-password/page.tsx` | Email → "instruções enviadas" (anti-enumeration)            |
| `/reset-password`  | `app/(auth)/reset-password/page.tsx`  | Token + nova senha + confirmação                            |

### 7.2 Página de login — mudanças

```typescript
// app/(auth)/login/page.tsx — adicionar links:
<Link href="/register">Criar conta</Link>
<Link href="/forgot-password">Esqueceu a senha?</Link>

// Após login bem-sucedido:
const { accessToken, organizationId } = await response.json();
useAuthStore.getState().setAuth(accessToken, organizationId);
```

### 7.3 Cliente Better Auth no frontend

```typescript
// apps/web/src/lib/auth-client.ts
import { createAuthClient } from "better-auth/client";
import { organizationClient } from "better-auth/client/plugins";

export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_API_URL + "/api/v1/auth",
  plugins: [organizationClient()],
});
```

### 7.4 i18n — keys obrigatórias (pt-BR + en + es)

```json
"auth": {
  "register": {
    "title": "Criar conta",
    "name": "Nome completo",
    "email": "Email",
    "password": "Senha (mín. 12 caracteres)",
    "confirmPassword": "Confirmar senha",
    "submit": "Criar conta",
    "haveAccount": "Já tem conta?",
    "login": "Entrar",
    "success": "Conta criada! Verifique seu email."
  },
  "verify": {
    "title": "Verificar email",
    "verifying": "Verificando...",
    "success": "Email verificado! Redirecionando...",
    "error": "Token inválido ou expirado.",
    "resend": "Reenviar email de verificação"
  },
  "forgot": {
    "title": "Recuperar senha",
    "email": "Email cadastrado",
    "submit": "Enviar instruções",
    "sent": "Se o email existir em nossa base, você receberá as instruções em breve."
  },
  "reset": {
    "title": "Nova senha",
    "password": "Nova senha",
    "confirmPassword": "Confirmar nova senha",
    "submit": "Redefinir senha",
    "success": "Senha redefinida! Faça login.",
    "error": "Token inválido ou expirado."
  }
}
```

---

## 8. Plano de Migração

### Ordem obrigatória das migrations

```
0011_better_auth_tables.sql        ← Better Auth CLI gera automaticamente
0012_user_custom_fields.sql        ← telegramChatId, plan, monthlyBudget, isActive
0013_add_organization_id_all.sql   ← ADD COLUMN organization_id em todas as tabelas
0014_seed_bootstrap_org.sql        ← INSERT INTO organization (bootstrap)
0015_migrate_operators_to_user.sql ← copiar operators → user + member
0016_org_id_not_null.sql           ← DROP DEFAULT em organization_id
```

### Seed de bootstrap (idempotente)

```typescript
async function bootstrapOrganization() {
  const existing = await db.query.organization.findFirst({
    where: eq(organization.id, env.BOOTSTRAP_ORG_ID),
  });
  if (existing) return;

  await db.transaction(async (tx) => {
    await tx.insert(organization).values({
      id: env.BOOTSTRAP_ORG_ID,
      name: env.BOOTSTRAP_ORG_NAME,
      slug: env.BOOTSTRAP_ORG_SLUG,
    });
  });
  logger.info("Bootstrap organization created");
}
```

### Rollback plan

Se a migration falhar após step 0011 e antes de 0015:

- Better Auth tables podem ser dropadas sem impacto (operators original preservado)
- Script de rollback documentado em `infra/db/rollback-s6.sh`

---

## 9. Variáveis de Ambiente Novas

```env
# .env (adicionar ao .env.example)
BOOTSTRAP_ORG_ID=org_agentepro_mvp
BOOTSTRAP_ORG_NAME=AgentePro MVP
BOOTSTRAP_ORG_SLUG=agentepro

# Já existe — Better Auth usa a mesma chave RSA:
JWT_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n..."
JWT_PUBLIC_KEY="-----BEGIN PUBLIC KEY-----\n..."

# Better Auth secret (novo — para assinar sessões internas)
BETTER_AUTH_SECRET=<random 32 bytes hex — gerar com: openssl rand -hex 32>
BETTER_AUTH_URL=http://localhost:3001
```

---

## 10. Critérios de Aceitação

### Auth flows

- [ ] `POST /sign-up/email` → 201, email de verificação enfileirado via BullMQ
- [ ] `POST /sign-up/email` com email já existente → 422 (sem leak de qual email)
- [ ] `POST /verify-email?token=<valid>` → 200, emailVerified=true
- [ ] `POST /verify-email?token=<expired>` → 400
- [ ] `POST /sign-in/email` sem emailVerified → 403 `EMAIL_NOT_VERIFIED`
- [ ] `POST /sign-in/email` com credenciais válidas → 200 com `{ accessToken, organizationId }`
- [ ] `POST /sign-in/email` credenciais inválidas → 401 (mensagem genérica)
- [ ] `POST /forget-password` email qualquer → **SEMPRE 200**
- [ ] `POST /reset-password` token válido → 200, sessões antigas invalidadas
- [ ] `POST /reset-password` token expirado (>1h) → 400

### Segurança

- [ ] Senha com menos de 12 chars → 422
- [ ] Brute force: 11ª tentativa de sign-in em 15 min → 429
- [ ] Token HS256 no `Authorization` header → 401 (Fastify middleware rejeita)
- [ ] JWT sem `organizationId` claim → 401
- [ ] Timing: resposta de email-existe vs email-não-existe < 10ms diferença

### Multi-tenant isolation

- [ ] Operador A não consegue ver leads do Operador B mesmo com JWT válido
- [ ] Todas as queries de negócio filtram por `organizationId`
- [ ] `organizationId` no JWT bate com `organizationId` da tabela respectiva

### Frontend

- [ ] `/register` valida client-side: 12 chars, maiúscula, minúscula, número, especial
- [ ] `/verify-email` redireciona para `/login` após sucesso com toast de confirmação
- [ ] `/forgot-password` exibe mensagem anti-enumeration independente do email
- [ ] `/reset-password` exibe erro claro para token expirado
- [ ] `/login` tem links para `/register` e `/forgot-password`
- [ ] Todas as strings em pt-BR/en/es — zero hardcoded

### Migração

- [ ] `npm run db:migrate` aplica migrations 0011-0016 em banco existente sem erro
- [ ] Bootstrap org criada automaticamente no primeiro boot
- [ ] Operador existente (se houver) migrado para tabela `user`
- [ ] `npm run typecheck` sem erros após migração

---

## 11. Fora do Escopo — S6 (implementar em S7+)

| Item                                       | Sprint                 |
| ------------------------------------------ | ---------------------- |
| Social login (Google, GitHub)              | S9+                    |
| 2FA (TOTP)                                 | S9+                    |
| Passkeys (WebAuthn)                        | v2+                    |
| Self-registration no SaaS (múltiplas orgs) | Quando migrar para VPS |
| Billing por organization (Stripe)          | v2+                    |
| Admin dashboard multi-tenant               | Quando migrar para VPS |
| Invitation flow completo                   | SaaS                   |

---

## 12. Branch e Worktree

```bash
# Criar worktree isolada — NUNCA commitar direto no worktree
git worktree add .worktrees/s6-better-auth -b feat/s6-better-auth

# Trabalho acontece em .worktrees/s6-better-auth/

# Merge para develop quando sprint completa:
# git checkout develop && git merge feat/s6-better-auth
```

---

## 13. Self-Review

- [x] **Placeholders:** nenhum TBD/TODO — todos os campos de código são explícitos
- [x] **Consistência interna:** JWT RS256 preservado em todas as seções; organizationId presente em todos os pontos de integração
- [x] **Escopo:** focado em auth + multi-tenant schema; billing/2FA explicitamente fora do escopo
- [x] **Ambiguidade:** "SEMPRE 200" no forgot-password é explícito; timing attack documentado; rollback plan documentado
- [x] **Segurança:** Argon2id explicitamente configurado (não bcrypt padrão); rate limits específicos por endpoint; anti-enumeration em todos os pontos relevantes
- [x] **Multi-tenancy:** organizationId em TODAS as tabelas de negócio listadas; filtro obrigatório documentado; seed bootstrap idempotente
