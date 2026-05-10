# Auth Refactor — Sign-Up + Verificação Segura

## Goal

Estender o auth existente (JWT RS256 + Argon2id) com: **cadastro**, **verificação de email**, **esqueceu/resetar senha** — reutilizando a infra já disponível (Brevo + BullMQ email worker + Drizzle schema).

> **DECISÃO ESTRATÉGICA:** NÃO usar auth provider externo (Auth0, Supabase Auth, Clerk).
> O backend já possui auth robusto com Argon2id + RS256 + rate limiting + anti-enumeration.
> Adicionar provider externo = reescrever todo o auth + dependência externa + custo.
> Abordagem: **estender o que já funciona** com os mesmos padrões de segurança.

---

## Mapa Arquitetural

```
Frontend (Next.js 16)                    Backend (Fastify 5)
┌──────────────────────┐                 ┌────────────────────────────┐
│ /login ──→ Link ──→  │                 │ POST /register             │
│ /register            │─── POST ──────→ │   → RegisterHandler        │
│ /login ──→ Link ──→  │                 │   → Argon2id hash          │
│ /forgot-password     │─── POST ──────→ │   → SHA-256 verify token   │
│                      │                 │   → BullMQ email queue     │
│ /verify-email?token= │─── POST ──────→ │ POST /verify-email         │
│ /reset-password?tok= │─── POST ──────→ │ POST /reset-password       │
└──────────────────────┘                 └──────┬─────────────────────┘
                                                │
                                         ┌──────▼─────────────────────┐
                                         │ EmailWorker (BullMQ)       │
                                         │   → EmailAdapter (Brevo)   │
                                         └────────────────────────────┘
```

---

## FASE 1 — Schema & Infra

- [ ] **1.1** Adicionar `emailVerified` à tabela `operators` em `schema.ts` (L38-46)
  ```diff
   isActive: boolean('is_active').notNull().default(true),
  +emailVerified: boolean('email_verified').notNull().default(false),
   createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  ```
  → Verify: `npm run typecheck` sem erros

- [ ] **1.2** Criar enum `verification_type` + tabela `email_verifications` em schema.ts
  ```typescript
  export const verificationTypeEnum = pgEnum('verification_type', [
    'EMAIL_VERIFICATION',
    'PASSWORD_RESET',
  ]);

  export const emailVerifications = pgTable('email_verifications', {
    id: uuid('id').primaryKey().defaultRandom(),
    operatorId: uuid('operator_id').notNull()
      .references(() => operators.id, { onDelete: 'cascade' }),
    tokenHash: text('token_hash').notNull(), // SHA-256 do token raw
    type: verificationTypeEnum('type').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    usedAt: timestamp('used_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  }, (table) => [
    index('idx_email_verifications_operator_type')
      .on(table.operatorId, table.type),
  ]);
  ```
  → Verify: Sem erros de tipo

- [ ] **1.3** Gerar + aplicar migration Drizzle
  ```bash
  cd apps/api && npm run db:generate && npm run db:migrate
  ```
  → Verify: Migration aplicada com sucesso

- [ ] **1.4** Adicionar `FRONTEND_URL` ao `config.ts`
  ```diff
  +FRONTEND_URL: z.string().default('http://localhost:3000'),
  ```
  E ao `.env` + `.env.example`:
  ```
  FRONTEND_URL=http://localhost:3000
  ```
  → Verify: `config.FRONTEND_URL` acessível

- [ ] **1.5** Criar `AuthEmailService` em `src/application/auth/auth-email.service.ts`
  - Método `sendVerificationEmail(email, name, token)` → enfileira via BullMQ
  - Método `sendPasswordResetEmail(email, name, token)` → enfileira via BullMQ
  - HTML templates inline com branding AgentePro
  - Links: `${FRONTEND_URL}/verify-email?token=${token}` / `${FRONTEND_URL}/reset-password?token=${token}`
  → Verify: Service instanciável sem erros

---

## FASE 2 — Handlers & Routes

- [ ] **2.1** Criar novos Zod schemas em `auth.schemas.ts`
  ```typescript
  export const RegisterSchema = z.object({
    name: z.string().trim().min(2).max(100),
    email: z.string().email().max(254),
    password: z.string()
      .min(8).max(128)
      .regex(/[a-z]/, 'Must contain lowercase')
      .regex(/[A-Z]/, 'Must contain uppercase')
      .regex(/[0-9]/, 'Must contain number')
      .regex(/[^a-zA-Z0-9]/, 'Must contain special character'),
    confirmPassword: z.string(),
  }).refine(d => d.password === d.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

  export const VerifyEmailSchema = z.object({
    token: z.string().length(64), // 32 bytes hex
  });

  export const ForgotPasswordSchema = z.object({
    email: z.string().email().max(254),
  });

  export const ResetPasswordSchema = z.object({
    token: z.string().length(64),
    password: z.string().min(8).max(128)
      .regex(/[a-z]/).regex(/[A-Z]/).regex(/[0-9]/).regex(/[^a-zA-Z0-9]/),
    confirmPassword: z.string(),
  }).refine(d => d.password === d.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

  export const ResendVerificationSchema = z.object({
    email: z.string().email().max(254),
  });
  ```
  → Verify: Schemas parse corretamente

- [ ] **2.2** Criar `RegisterHandler` em `auth.handlers.ts`
  - Recebe: name, email, password
  - Verifica se email já existe (se sim, retorna OK genérico — anti-enumeration)
  - Hash senha com Argon2id (mesmo config existente)
  - Cria operator com `isActive: false`, `emailVerified: false`
  - Gera token: `crypto.randomBytes(32).toString('hex')` (64 chars hex)
  - Salva SHA-256 hash do token na tabela `email_verifications`
  - Expiry: 24 horas
  - Enfileira email de verificação via BullMQ
  - Retorna: `{ message: "If the email is valid, a verification link was sent" }`
  → Verify: Unit test passando

- [ ] **2.3** Criar `VerifyEmailHandler`
  - Recebe: token (raw)
  - Calcula SHA-256 do token
  - Busca na tabela `email_verifications` onde `type = EMAIL_VERIFICATION`, `usedAt IS NULL`
  - Timing-safe comparison via `crypto.timingSafeEqual`
  - Verifica expiração
  - Atualiza operator: `emailVerified: true`, `isActive: true`
  - Marca token como `usedAt: new Date()`
  → Verify: Integration test passando

- [ ] **2.4** Criar `ForgotPasswordHandler`
  - Recebe: email
  - SEMPRE retorna 200 (anti-enumeration)
  - Se email existe e está verificado: gera reset token, salva hash, envia email
  - Token expiry: 1 hora
  → Verify: Anti-enumeration verificado

- [ ] **2.5** Criar `ResetPasswordHandler`
  - Recebe: token, newPassword
  - Valida token (SHA-256 + timing-safe)
  - Verifica expiração
  - Hash nova senha com Argon2id
  - Atualiza operator `passwordHash`
  - Revoga TODOS os refresh tokens ativos do operator
  - Marca reset token como usado
  → Verify: Integration test + refresh tokens revogados

- [ ] **2.6** Criar `ResendVerificationHandler`
  - Recebe: email
  - SEMPRE retorna 200 (anti-enumeration)
  - Se operator existe e NÃO está verificado: gera novo token, invalida anteriores, envia email
  - Rate limit rigoroso
  → Verify: Não permite flood

- [ ] **2.7** Atualizar `LoginHandler` em `auth.handlers.ts` (L42-93)
  - Após verificar credentials, checar `emailVerified`
  - Se `!emailVerified`: retornar erro específico `EMAIL_NOT_VERIFIED`
  - Frontend usa esse código para mostrar opção de reenviar verificação
  → Verify: Login rejeita conta não verificada

- [ ] **2.8** Registrar novas rotas em `auth.routes.ts`

  | Route | Method | Rate Limit | Auth |
  |-------|--------|-----------|------|
  | `/register` | POST | 3/15min | ❌ |
  | `/verify-email` | POST | 10/15min | ❌ |
  | `/forgot-password` | POST | 3/15min | ❌ |
  | `/reset-password` | POST | 5/15min | ❌ |
  | `/resend-verification` | POST | 2/15min | ❌ |

  → Verify: Todas as rotas respondendo

---

## FASE 3 — Testes Backend

- [ ] **3.1** Integration tests para `/register`
  - ✅ Cadastro com dados válidos → 201
  - ✅ Email duplicado → 201 (anti-enumeration, mas NÃO cria duplicata)
  - ✅ Senha fraca → 400 (validation)
  - ✅ Dados faltando → 400
  - ✅ Rate limiting → 429 após 3 tentativas

- [ ] **3.2** Integration tests para `/verify-email`
  - ✅ Token válido → 200 + conta ativada
  - ✅ Token expirado → 400
  - ✅ Token já usado → 400
  - ✅ Token inválido → 400

- [ ] **3.3** Integration tests para `/forgot-password` + `/reset-password`
  - ✅ Email existente → 200 (email enfileirado)
  - ✅ Email inexistente → 200 (anti-enumeration, nenhum email)
  - ✅ Reset com token válido → 200 + senha atualizada
  - ✅ Reset com token expirado → 400
  - ✅ Reset invalida refresh tokens anteriores

- [ ] **3.4** Security tests
  - ✅ Anti-enumeration: respostas idênticas para emails existentes/inexistentes
  - ✅ Rate limiting em todas as novas rotas
  - ✅ Login rejeita conta não verificada
  - ✅ Token brute-force: 64 chars hex = 2^128 espaço

  → Verify: `npm run test:integration && npm run test:security` green

---

## FASE 4 — Frontend Pages

- [ ] **4.1** Atualizar `api.ts` com novos endpoints
  ```typescript
  auth: {
    login: (...),
    refresh: (...),
    register: (name, email, password, confirmPassword) =>
      request<{ data: { message: string } }>('/auth/register', {
        method: 'POST',
        body: JSON.stringify({ name, email, password, confirmPassword }),
      }),
    verifyEmail: (token) =>
      request<{ data: { message: string } }>('/auth/verify-email', {
        method: 'POST',
        body: JSON.stringify({ token }),
      }),
    forgotPassword: (email) =>
      request<{ data: { message: string } }>('/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email }),
      }),
    resetPassword: (token, password, confirmPassword) =>
      request<{ data: { message: string } }>('/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ token, password, confirmPassword }),
      }),
    resendVerification: (email) =>
      request<{ data: { message: string } }>('/auth/resend-verification', {
        method: 'POST',
        body: JSON.stringify({ email }),
      }),
  },
  ```

- [ ] **4.2** Criar shared auth layout em `(auth)/layout.tsx`
  - Background consistente (gradient orbs do login atual)
  - Branding AgentePro centralizado
  - Container responsivo

- [ ] **4.3** Criar `/register` page — `(auth)/register/page.tsx`
  - Campos: Name, Email, Password (com strength meter), Confirm Password
  - React Hook Form + Zod (schema espelhado do backend)
  - Password strength indicator visual
  - Link "Já tem conta? Faça login"
  - Após submit: tela de "Verifique seu email"
  - Componentes Shadcn: Card, Input, Label, Button

- [ ] **4.4** Criar `/verify-email` page — `(auth)/verify-email/page.tsx`
  - Lê `?token=` da URL via `useSearchParams()`
  - Auto-submit ao carregar (POST /verify-email)
  - Estados: loading → success → error
  - Success: "Email verificado! Redirecionando para login..." (auto-redirect 3s)
  - Error: "Token inválido ou expirado" + link para reenviar

- [ ] **4.5** Criar `/forgot-password` page — `(auth)/forgot-password/page.tsx`
  - Campo: Email
  - Após submit: "Se o email estiver cadastrado, enviamos um link de redefinição"
  - Link "Voltar para login"

- [ ] **4.6** Criar `/reset-password` page — `(auth)/reset-password/page.tsx`
  - Lê `?token=` da URL
  - Campos: New Password, Confirm Password
  - Password strength meter
  - Após submit: "Senha alterada! Redirecionando para login..."

- [ ] **4.7** Atualizar `login/page.tsx`
  - Adicionar link "Criar conta" → /register
  - Adicionar link "Esqueceu a senha?" → /forgot-password
  - Tratar erro `EMAIL_NOT_VERIFIED` com opção de reenviar verificação

  → Verify: `npm run dev` → navegar entre todas as telas

---

## FASE 5 — E2E & Polish

- [ ] **5.1** Expandir `auth.spec.ts` com E2E tests
  - Fluxo completo: register → verificar email → login
  - Forgot password → reset → login com nova senha
  - Validações visuais (error messages, success states)

- [ ] **5.2** Responsividade mobile em todas as telas auth
  → Verify: Browser devtools em 375px

- [ ] **5.3** Acessibilidade
  - aria-labels em todos os inputs
  - Keyboard navigation (Tab order)
  - Focus management em erros
  → Verify: `scripts/accessibility_checker.py`

- [ ] **5.4** Review de segurança final
  → Verify: `scripts/security_scan.py`

---

## Arquivos Impactados

### Backend (`apps/api`)

| Arquivo | Ação |
|---------|------|
| `src/infrastructure/db/schema.ts` | ✏️ Adicionar `emailVerified` + tabela `email_verifications` |
| `src/application/auth/auth.handlers.ts` | ✏️ Adicionar 5 novos handlers + modificar LoginHandler |
| `src/application/auth/auth-email.service.ts` | 🆕 Criar (templates + enfileiramento) |
| `src/http/schemas/auth.schemas.ts` | ✏️ Adicionar 5 novos schemas |
| `src/http/routes/auth.routes.ts` | ✏️ Adicionar 5 novas rotas |
| `src/config.ts` | ✏️ Adicionar `FRONTEND_URL` |
| `src/container.ts` | ✏️ Registrar `AuthEmailService` |
| `tests/integration/auth.test.ts` | ✏️ Expandir (12+ novos testes) |
| `tests/security/api.security.test.ts` | ✏️ Expandir (4+ novos testes) |

### Frontend (`apps/web`)

| Arquivo | Ação |
|---------|------|
| `src/lib/api.ts` | ✏️ Adicionar 5 novos métodos auth |
| `src/app/(auth)/layout.tsx` | ✏️ Shared auth layout |
| `src/app/(auth)/login/page.tsx` | ✏️ Links + tratamento EMAIL_NOT_VERIFIED |
| `src/app/(auth)/register/page.tsx` | 🆕 Criar |
| `src/app/(auth)/verify-email/page.tsx` | 🆕 Criar |
| `src/app/(auth)/forgot-password/page.tsx` | 🆕 Criar |
| `src/app/(auth)/reset-password/page.tsx` | 🆕 Criar |
| `tests/e2e/auth.spec.ts` | ✏️ Expandir |

### Infra

| Arquivo | Ação |
|---------|------|
| `.env` / `.env.example` | ✏️ Adicionar `FRONTEND_URL` |
| Drizzle migration | 🆕 Auto-gerada |

---

## Done When

- [ ] Cadastro de novo operador funciona end-to-end
- [ ] Email de verificação é enviado via Brevo/BullMQ
- [ ] Conta só é acessível após verificação de email
- [ ] Reset de senha funciona end-to-end
- [ ] Anti-enumeration em TODAS as rotas públicas
- [ ] Rate limiting em TODAS as novas rotas
- [ ] Testes de integração + segurança passando
- [ ] E2E tests passando
- [ ] Nenhuma dependência externa nova (apenas infra existente)

---

## Decisões de Segurança

| Aspecto | Decisão | Justificativa |
|---------|---------|---------------|
| Token format | `crypto.randomBytes(32).hex` | 128 bits de entropia → impossível brute-force |
| Token storage | SHA-256 hash no DB | Se DB vazado, tokens não são utilizáveis |
| Token comparison | `crypto.timingSafeEqual` | Previne timing attacks |
| Password hashing | Argon2id (64MB, t=3, p=4) | Já existente, industry standard 2025+ |
| Anti-enumeration | Respostas genéricas idênticas | Atacante não consegue mapear emails válidos |
| Rate limiting | 2-5 req/15min por rota | Previne brute-force e abuse |
| Email delivery | BullMQ async queue | Não bloqueia response + retry automático |
| Refresh token revogation | Em reset password | Previne sessões comprometidas |

---

## Notes

- **Brevo free tier**: 300 emails/dia — suficiente para desenvolvimento e MVP
- **BullMQ retry**: 3 tentativas com backoff exponencial (já configurado no EmailWorker)
- **Migration backward-compatible**: `emailVerified` default `false` não quebra operadores existentes
- Para operadores existentes (seeded): rodar script SQL `UPDATE operators SET email_verified = true WHERE is_active = true`
