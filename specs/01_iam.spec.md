# SPEC-01: IAM — Identity & Access Management

> Fundação de segurança do sistema. Tudo depende disto funcionar corretamente.
> Versão: 2.0.0 | Fase: 0 | Bloqueante para todas as outras specs.

---

## Escopo

- Registro e autenticação do operador (usuário humano do painel)
- JWT RS256: emissão, verificação e revogação
- Refresh token rotativo com hash no banco
- Rate limiting de login (brute force prevention)
- Anti-enumeração e anti-timing em falhas de auth
- Audit log de todas as ações de autenticação

**Fora do escopo:**

- Multi-tenancy (um operador por instância no MVP)
- OAuth social (Google, GitHub) — v2
- MFA/2FA — v2
- RBAC granular (roles) — v2

---

## Modelo de Domínio

### Operator (Aggregate)

```typescript
// domain/operator/Operator.ts

interface OperatorProps {
  id: OperatorId;
  email: OperatorEmail; // Value Object validado
  passwordHash: PasswordHash; // Value Object — Argon2id
  name: OperatorName;
  telegramChatId?: string; // Para HITL via Telegram
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

class Operator extends AggregateRoot {
  // Factory — NÃO expor construtor diretamente
  static create(props: CreateOperatorProps): Operator {
    const hash = PasswordHash.create(props.password);
    const op = new Operator({
      id: OperatorId.create(),
      email: OperatorEmail.fromString(props.email),
      passwordHash: hash,
      name: OperatorName.fromString(props.name),
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    op.addEvent(createOperatorCreatedEvent(op));
    return op;
  }

  // Verificação — SEMPRE executa argon2.verify, mesmo se user null
  async verifyPassword(plaintext: string): Promise<boolean> {
    return this.passwordHash.verify(plaintext);
  }

  deactivate(): void {
    this.isActive = false;
    this.addEvent(createOperatorDeactivatedEvent(this));
  }

  updateTelegramChatId(chatId: string): void {
    this.telegramChatId = chatId;
  }
}
```

### Value Objects de Autenticação

```typescript
// domain/operator/OperatorEmail.ts
class OperatorEmail {
  private constructor(readonly value: string) {}

  static fromString(raw: string): OperatorEmail {
    const normalized = raw.toLowerCase().trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
      throw new ValidationError("Email inválido", "email");
    }
    return new OperatorEmail(normalized);
  }

  // NUNCA logar o valor — PII
  toSafeLog(): string {
    return `${this.value.slice(0, 3)}***`;
  }
}

// domain/operator/PasswordHash.ts
class PasswordHash {
  private constructor(readonly hash: string) {}

  static async create(plaintext: string): Promise<PasswordHash> {
    if (plaintext.length < 8) {
      throw new ValidationError(
        "Senha deve ter pelo menos 8 caracteres",
        "password",
      );
    }
    const hash = await argon2.hash(plaintext, ARGON2_CONFIG);
    return new PasswordHash(hash);
  }

  // Hash dummy — usado para timing constante quando user não existe
  static dummy(): PasswordHash {
    return new PasswordHash(
      "$argon2id$v=19$m=65536,t=3,p=4$c29tZXNhbHQ$RdescudvJCsgt3ub+b+dWRWJTmaaJObG",
    );
  }

  async verify(plaintext: string): Promise<boolean> {
    return argon2.verify(this.hash, plaintext, ARGON2_CONFIG);
  }
}

// Configuração Argon2id — NUNCA reduzir estes valores
const ARGON2_CONFIG = {
  type: argon2.argon2id,
  memoryCost: 2 ** 16, // 64 MB — mínimo aceitável
  timeCost: 3,
  parallelism: 4,
  hashLength: 32,
} as const;
```

### RefreshToken (Entity)

```typescript
// domain/operator/RefreshToken.ts

class RefreshToken {
  private constructor(
    readonly id: string,
    readonly operatorId: OperatorId,
    readonly tokenHash: string, // SHA-256 do token raw
    readonly expiresAt: Date,
    readonly revokedAt?: Date,
  ) {}

  static create(operatorId: OperatorId): {
    entity: RefreshToken;
    rawToken: string;
  } {
    const rawToken = randomBytes(32).toString("hex");
    const tokenHash = createHash("sha256").update(rawToken).digest("hex");
    const entity = new RefreshToken(
      randomUUID(),
      operatorId,
      tokenHash,
      new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 dias
    );
    return { entity, rawToken };
  }

  isExpired(): boolean {
    return new Date() > this.expiresAt;
  }
  isRevoked(): boolean {
    return !!this.revokedAt;
  }
  isValid(): boolean {
    return !this.isExpired() && !this.isRevoked();
  }

  revoke(): RefreshToken {
    return new RefreshToken(
      this.id,
      this.operatorId,
      this.tokenHash,
      this.expiresAt,
      new Date(),
    );
  }
}
```

---

## Use Cases

### LoginUseCase

```typescript
// application/auth/LoginUseCase.ts

interface LoginCommand {
  email: string;
  password: string;
  correlationId: string;
}

interface LoginResult {
  accessToken: string;
  refreshToken: string;
  expiresIn: 3600;
}

class LoginUseCase {
  async execute(cmd: LoginCommand): Promise<LoginResult> {
    // 1. Buscar operador por email
    const operator = await this.operatorRepo.findByEmail(
      OperatorEmail.fromString(cmd.email),
    );

    // 2. SEMPRE executar verify — mesmo se operator null (timing constante)
    const hashToVerify = operator?.passwordHash ?? PasswordHash.dummy();
    const isValid = await hashToVerify.verify(cmd.password);

    // 3. Falha genérica — NUNCA diferenciar "email não existe" de "senha errada"
    if (!operator || !isValid || !operator.isActive) {
      await this.auditLog.record("LOGIN_FAILED", {
        email: OperatorEmail.fromString(cmd.email).toSafeLog(),
        correlationId: cmd.correlationId,
        reason: "invalid_credentials", // genérico
      });
      throw new AuthenticationError(); // mensagem: 'Credenciais inválidas'
    }

    // 4. Gerar tokens
    const accessToken = await this.jwtService.sign(
      {
        sub: operator.id.value,
        email: operator.email.value,
      },
      { expiresIn: "1h" },
    );

    const { entity: refreshEntity, rawToken } = RefreshToken.create(
      operator.id,
    );
    await this.refreshTokenRepo.save(refreshEntity);

    // 5. Audit log — SEM o token raw, SEM a senha
    await this.auditLog.record("LOGIN_SUCCESS", {
      operatorId: operator.id.value,
      correlationId: cmd.correlationId,
    });

    return { accessToken, refreshToken: rawToken, expiresIn: 3600 };
  }
}
```

### RefreshTokenUseCase

```typescript
class RefreshTokenUseCase {
  async execute(cmd: {
    rawToken: string;
    correlationId: string;
  }): Promise<LoginResult> {
    // 1. Hash do token recebido
    const tokenHash = createHash("sha256").update(cmd.rawToken).digest("hex");

    // 2. Buscar por hash
    const stored = await this.refreshTokenRepo.findByHash(tokenHash);
    if (!stored || !stored.isValid()) {
      throw new AuthenticationError();
    }

    // 3. Revogar token atual (rotação obrigatória)
    await this.refreshTokenRepo.save(stored.revoke());

    // 4. Gerar novo par
    const operator = await this.operatorRepo.findById(stored.operatorId);
    if (!operator || !operator.isActive) throw new AuthenticationError();

    const accessToken = await this.jwtService.sign({ sub: operator.id.value });
    const { entity: newRefresh, rawToken: newRaw } = RefreshToken.create(
      operator.id,
    );
    await this.refreshTokenRepo.save(newRefresh);

    await this.auditLog.record("TOKEN_REFRESHED", {
      operatorId: operator.id.value,
    });

    return { accessToken, refreshToken: newRaw, expiresIn: 3600 };
  }
}
```

### LogoutUseCase

```typescript
class LogoutUseCase {
  async execute(cmd: { rawToken?: string; operatorId: string }): Promise<void> {
    if (cmd.rawToken) {
      const hash = createHash("sha256").update(cmd.rawToken).digest("hex");
      const token = await this.refreshTokenRepo.findByHash(hash);
      if (token) await this.refreshTokenRepo.save(token.revoke());
    }
    await this.auditLog.record("LOGOUT", { operatorId: cmd.operatorId });
  }
}
```

---

## JWT Service

```typescript
// infrastructure/auth/JWTService.ts

const JWT_CONFIG = {
  algorithm: "RS256" as const,
  accessTokenExpiry: "1h",
  issuer: process.env.API_PUBLIC_URL ?? "http://localhost:3001",
  audience: "hefesto-api",
} as const;

class JWTService {
  constructor(
    private readonly privateKey: KeyLike, // RSA private key (PEM)
    private readonly publicKey: KeyLike, // RSA public key (PEM)
  ) {}

  async sign(payload: Record<string, unknown>): Promise<string> {
    return new SignJWT(payload)
      .setProtectedHeader({ alg: "RS256" })
      .setIssuedAt()
      .setIssuer(JWT_CONFIG.issuer)
      .setAudience(JWT_CONFIG.audience)
      .setExpirationTime(JWT_CONFIG.accessTokenExpiry)
      .sign(this.privateKey);
  }

  async verify(token: string): Promise<JWTPayload> {
    const { payload } = await jwtVerify(token, this.publicKey, {
      issuer: JWT_CONFIG.issuer,
      audience: JWT_CONFIG.audience,
      algorithms: ["RS256"], // Rejeitar HS256 explicitamente
    });
    return payload;
  }

  // Como carregar as chaves (em main.ts)
  static async loadKeys(): Promise<{
    privateKey: KeyLike;
    publicKey: KeyLike;
  }> {
    const privateKey = await importPKCS8(env.JWT_PRIVATE_KEY, "RS256");
    const publicKey = await importSPKI(env.JWT_PUBLIC_KEY, "RS256");
    return { privateKey, publicKey };
  }
}
```

---

## Middleware de Autenticação

```typescript
// http/middleware/auth.middleware.ts

export const authMiddleware = async (
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> => {
  const authHeader = request.headers.authorization;

  if (!authHeader?.startsWith("Bearer ")) {
    return reply.status(401).send({
      errors: [
        {
          code: "UNAUTHORIZED",
          message: "Token não informado",
          requestId: request.id,
        },
      ],
    });
  }

  const token = authHeader.slice(7);

  try {
    const payload = await jwtService.verify(token);

    // Injetar no request — sem query adicional ao banco
    request.operator = {
      id: payload.sub as string,
      email: payload["email"] as string,
    };
  } catch (error) {
    if (error instanceof errors.JWTExpired) {
      return reply.status(401).send({
        errors: [
          {
            code: "TOKEN_EXPIRED",
            message: "Token expirado",
            requestId: request.id,
          },
        ],
      });
    }
    return reply.status(401).send({
      errors: [
        {
          code: "INVALID_TOKEN",
          message: "Token inválido",
          requestId: request.id,
        },
      ],
    });
  }
};

// Augment Fastify types
declare module "fastify" {
  interface FastifyRequest {
    operator: { id: string; email: string };
  }
}
```

---

## Rate Limiting de Login

```typescript
// Configuração no plugin Fastify
// Estratégia: sliding window por IP no Redis

const loginRateLimit = {
  max: 5,
  timeWindow: 15 * 60 * 1000, // 15 minutos
  keyGenerator: (request: FastifyRequest) => `rl:login:${request.ip}`,
  errorResponseBuilder: () => ({
    errors: [
      {
        code: "RATE_LIMIT",
        message: "Muitas tentativas. Tente novamente em 15 minutos.",
      },
    ],
  }),
};

// Headers de resposta no 429:
// X-RateLimit-Limit: 5
// X-RateLimit-Remaining: 0
// Retry-After: {segundos}
```

---

## HTTP Routes

### POST /api/v1/auth/login

```typescript
// Input Schema (Zod)
const LoginSchema = z.object({
  email:    z.string().email('Email inválido'),
  password: z.string().min(8, 'Senha deve ter ao menos 8 caracteres'),
});

// Response 200
{
  data: {
    accessToken:  string,   // JWT RS256, exp 1h
    refreshToken: string,   // opaque hex token, exp 7d
    expiresIn:    3600,
  }
}

// Response 400 (validação)
{ errors: [{ code: 'VALIDATION_ERROR', message: 'Email inválido', field: 'email' }] }

// Response 401 (credenciais)
{ errors: [{ code: 'AUTHENTICATION_ERROR', message: 'Credenciais inválidas' }] }

// Response 429 (rate limit)
{ errors: [{ code: 'RATE_LIMIT', message: 'Muitas tentativas...' }] }
```

### POST /api/v1/auth/refresh

```typescript
// Input
{
  refreshToken: string;
}

// Response 200 — novos tokens (token anterior revogado)
{
  data: {
    (accessToken, refreshToken, expiresIn);
  }
}

// Response 401 — token inválido, expirado ou revogado
{
  errors: [{ code: "AUTHENTICATION_ERROR", message: "Credenciais inválidas" }];
}
```

### DELETE /api/v1/auth/logout

```typescript
// Input (opcional)
{ refreshToken?: string }

// Response 204 — sem corpo
```

---

## Database Schema

```sql
-- Operadores
CREATE TABLE operators (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email            TEXT NOT NULL UNIQUE,
    password_hash    TEXT NOT NULL,
    name             TEXT NOT NULL CHECK (length(name) BETWEEN 2 AND 100),
    telegram_chat_id TEXT,
    is_active        BOOLEAN NOT NULL DEFAULT true,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Refresh tokens
CREATE TABLE refresh_tokens (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    operator_id  UUID NOT NULL REFERENCES operators(id) ON DELETE CASCADE,
    token_hash   TEXT NOT NULL UNIQUE,  -- SHA-256 do token raw
    expires_at   TIMESTAMPTZ NOT NULL,
    revoked_at   TIMESTAMPTZ,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX idx_refresh_tokens_hash ON refresh_tokens(token_hash);
CREATE INDEX idx_refresh_tokens_operator ON refresh_tokens(operator_id, revoked_at)
  WHERE revoked_at IS NULL;

-- Cleanup automático de tokens expirados (job BullMQ semanal)
-- DELETE FROM refresh_tokens WHERE expires_at < NOW() - INTERVAL '1 day';
```

---

## Testes Obrigatórios

### Unit Tests

```typescript
describe('Operator') {
  it('create() deve hashear a senha com Argon2id')
  it('create() deve emitir OperatorCreated event')
  it('verifyPassword() retorna true para senha correta')
  it('verifyPassword() retorna false para senha errada')
  it('create() lança ValidationError para senha < 8 chars')
}

describe('PasswordHash') {
  it('dummy() retorna hash válido para timing constante')
  it('create() lança ValidationError para senha < 8 chars')
  it('verify() retorna false para hash dummy com senha qualquer')
}

describe('RefreshToken') {
  it('create() gera rawToken de 64 chars hex')
  it('isExpired() retorna false antes de 7 dias')
  it('isExpired() retorna true após 7 dias')
  it('isRevoked() retorna false antes de revogar')
  it('revoke() retorna nova instância com revokedAt definido')
  it('isValid() retorna false se expirado ou revogado')
}

describe('LoginUseCase') {
  it('retorna tokens para credenciais válidas')
  it('lança AuthenticationError para email inexistente')
  it('lança AuthenticationError para senha errada')
  it('lança AuthenticationError para operador inativo')
  it('SEMPRE executa argon2.verify (mesmo para email inexistente)')
  it('registra LOGIN_SUCCESS no audit log')
  it('registra LOGIN_FAILED no audit log com email mascarado')
  it('NÃO expõe se o email existe ou não na mensagem de erro')
}

describe('JWTService') {
  it('sign() gera token RS256 válido')
  it('verify() valida token correto')
  it('verify() lança JWTExpired para token expirado')
  it('verify() lança erro para token HS256 (algoritmo errado)')
  it('verify() lança erro para token com issuer errado')
}
```

### Security Tests (BLOQUEANTES)

```typescript
describe('Security: Autenticação') {
  it('ANTI-ENUM: mensagem idêntica para email inexistente e senha errada', async () => {
    const [r1, r2] = await Promise.all([
      api.post('/auth/login', { email: 'fake@test.com', password: 'wrong' }),
      api.post('/auth/login', { email: 'real@test.com', password: 'wrong' }),
    ]);
    expect(r1.body.errors[0].message).toBe(r2.body.errors[0].message);
    expect(r1.body.errors[0].code).toBe(r2.body.errors[0].code);
  });

  it('ANTI-TIMING: diferença < 200ms entre email válido e inválido', async () => {
    const t1 = Date.now();
    await api.post('/auth/login', { email: 'fake@test.com', password: 'wrong' });
    const d1 = Date.now() - t1;

    const t2 = Date.now();
    await api.post('/auth/login', { email: 'real@test.com', password: 'wrong' });
    const d2 = Date.now() - t2;

    expect(Math.abs(d1 - d2)).toBeLessThan(200);
  });

  it('BRUTE-FORCE: 429 após 5 tentativas em 15 min', async () => {
    for (let i = 0; i < 5; i++) {
      await api.post('/auth/login', { email: 'test@test.com', password: 'wrong' });
    }
    const res = await api.post('/auth/login', { email: 'test@test.com', password: 'wrong' });
    expect(res.status).toBe(429);
    expect(res.headers['retry-after']).toBeDefined();
  });

  it('JWT-ALG: rejeitar token HS256', async () => {
    const fakeToken = sign({ sub: 'hacker' }, 'secret', { algorithm: 'HS256' });
    const res = await api.get('/leads').set('Authorization', `Bearer ${fakeToken}`);
    expect(res.status).toBe(401);
  });

  it('REFRESH-ROTATION: token anterior rejeitado após refresh', async () => {
    const { refreshToken: old } = await login();
    const { refreshToken: newToken } = await refresh(old);

    // Tentar usar o token antigo novamente
    const res = await api.post('/auth/refresh', { refreshToken: old });
    expect(res.status).toBe(401);

    // Token novo deve funcionar
    const res2 = await api.post('/auth/refresh', { refreshToken: newToken });
    expect(res2.status).toBe(200);
  });

  it('AUDIT-LOG: LOGIN_FAILED registrado com email mascarado (não completo)', async () => {
    await api.post('/auth/login', { email: 'real@test.com', password: 'wrong' });

    const logs = await auditLogRepo.findByAction('LOGIN_FAILED');
    expect(logs[0].payload.email).toMatch(/\*\*\*/);
    expect(logs[0].payload.email).not.toContain('real@test.com');
  });
}
```

---

## Critérios de Aceite Finais

- [ ] Login OK retorna 200 com accessToken (RS256) e refreshToken (hex)
- [ ] Login com email errado = 401, mensagem IDÊNTICA a senha errada
- [ ] Timing entre falhas: diferença < 200ms (5 medições consecutivas)
- [ ] 5 tentativas → 429 com Retry-After header
- [ ] Token HS256 → 401 INVALID_TOKEN
- [ ] Token expirado → 401 TOKEN_EXPIRED
- [ ] Refresh rotativo: token antigo rejeitado após uso
- [ ] Logout revoga o refresh token no banco
- [ ] LOGIN_FAILED no audit log com email mascarado (não exposto)
- [ ] PASSWORD_HASH nunca aparece em log nenhum
- [ ] Argon2id com memoryCost=65536, timeCost=3 (verificar no startup)
