# ADR-006: Estratégia de segurança — Security First transversal

**Status:** Aceito  
**Data:** 2026-05-09  
**Deciders:** Arquiteto  
**Tags:** segurança, owasp, argon2, jwt, ssrf, zero-trust

---

## Contexto

O AgentePro lida com:
- Dados pessoais de leads (nome, telefone, email, empresa) — escopo LGPD
- Credenciais de terceiros (API keys de LLMs, WhatsApp, Mercado Pago)
- Budget financeiro de clientes (campanhas de tráfego pago)
- Código gerado e deployado em infraestrutura de clientes
- Agentes de IA que executam ações externas de forma (semi-)autônoma

O vetor de risco mais crítico **não é um atacante externo** — é o próprio agente de IA
tomando ações indevidas por prompt injection, configuração incorreta ou bug no fluxo.
A segurança precisa ser aplicada em duas direções: de fora para dentro (ataques externos)
e de dentro para fora (ações indevidas dos agentes).

---

## Decisão

**Security First como princípio transversal: cada camada da arquitetura implementa
controles de segurança independentes, sem confiar nas camadas acima.**

### 1. Autenticação — Argon2id + JWT RS256

```typescript
// Argon2id — parâmetros mínimos obrigatórios
const ARGON2_CONFIG = {
  type: argon2.argon2id,
  memoryCost: 2 ** 16,  // 64 MB — resistente a GPU
  timeCost: 3,
  parallelism: 4,
  hashLength: 32,
} as const

// JWT — RS256 com chave assimétrica (privada no vault, pública verificável)
// Nunca HS256 com segredo simétrico — vulnerável se segredo vazar
const JWT_CONFIG = {
  algorithm: 'RS256',
  accessTokenExpiry: '1h',
  refreshTokenExpiry: '7d',
  issuer: 'agentepro.dominio.com',
} as const
```

### 2. Anti-enumeração (OWASP A07)

Falhas de autenticação **sempre** retornam a mesma mensagem genérica, independente
de e-mail inexistente ou senha incorreta. O hash comparison é executado em ambos os
casos para prevenir timing attacks.

```typescript
async function login(email: string, password: string) {
  const user = await userRepo.findByEmail(email)
  const dummyHash = await getSystemDummyHash() // pré-computado no boot
  const hashToCompare = user?.passwordHash ?? dummyHash
  const valid = await argon2.verify(hashToCompare, password)
  
  if (!user || !valid) {
    throw new AuthError('Credenciais inválidas') // mensagem idêntica sempre
  }
  return generateTokens(user)
}
```

### 3. Zero Trust no Backend — validação independente por camada

```typescript
// Middleware pipeline obrigatório — toda rota passa por todos os checks
app.use(requestIdMiddleware)      // Correlation ID para tracing
app.use(bodySizeLimiter(512_000)) // 512 KB máximo — antes do parsing JSON
app.use(rateLimiter(config))      // Por IP + por usuário autenticado
app.use(authMiddleware)           // JWT verification independente
app.use(inputValidator(schema))   // Zod schema — nunca confiar no frontend
```

### 4. Validação de uploads — Magic Bytes obrigatório

```typescript
// Verificação de tipo real do arquivo — extensão e Content-Type são ignorados
async function validateFile(buffer: Buffer, declaredMime: string) {
  const detected = await fileTypeFromBuffer(buffer.slice(0, 12))
  
  const ALLOWLIST = [
    'image/jpeg', 'image/png', 'image/webp',
    'application/pdf', 'text/plain', 'text/markdown'
  ]
  
  if (!detected || !ALLOWLIST.includes(detected.mime)) {
    throw new SecurityError('Tipo de arquivo não permitido')
  }
  // detected.mime é a fonte de verdade — não declaredMime
}
```

### 5. Prevenção SSRF — validação de URLs externas

Todo URL fornecido por agente ou usuário (links, endpoints de MCP, imagens) é validado
contra ranges de IP privados após resolução DNS.

```typescript
const PRIVATE_RANGES = [
  /^127\./, /^10\./, /^192\.168\./,
  /^172\.(1[6-9]|2[0-9]|3[01])\./,
  /^169\.254\./, /^::1$/, /^localhost$/i,
  /^0\.0\.0\.0$/,
]

async function validateExternalUrl(url: string): Promise<void> {
  const parsed = new URL(url)
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new SecurityError('Protocolo não permitido')
  }
  const { address } = await dns.promises.lookup(parsed.hostname)
  if (PRIVATE_RANGES.some(r => r.test(address))) {
    throw new SecurityError('URL aponta para endereço privado')
  }
}
```

### 6. Operações atômicas — prevenção de Race Conditions

Contadores, budgets de tokens e operações financeiras **sempre** via `SELECT FOR UPDATE`
dentro de transação. Nunca read-then-write sem lock.

```sql
BEGIN;
  SELECT token_budget_remaining FROM agents
    WHERE id = $1 FOR UPDATE;     -- lock da linha
  -- lógica de verificação em runtime
  UPDATE agents
    SET token_budget_remaining = token_budget_remaining - $2
    WHERE id = $1;
  INSERT INTO token_usage_logs ...;
COMMIT;
```

### 7. Security headers em todos os sites entregues

Todos os templates do Builder incluem headers de segurança pré-configurados como
requisito de qualidade (verificado pelo QA Agent antes do deploy):

```
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
Content-Security-Policy: default-src 'self'; frame-ancestors 'none'
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=()
```

### 8. Gestão de segredos — zero no repositório

```
Hierarquia:
  Dev local:  .env.local (gitignored) — valores manuais
  Produção:   Claude Managed Agents Credential Vaults (ADR-001)
              OU Infisical self-hosted (fallback self-hosted)
  
Regra absoluta: process.env nunca acessado diretamente em domain/application.
Sempre injetado via interface SecretsProvider no container DI.
```

### 9. Audit log imutável (append-only)

Tabela `audit_log` com RLS no PostgreSQL: política permite apenas INSERT.
UPDATE e DELETE bloqueados implicitamente pela ausência de policy.
PII mascarado antes do log. Retenção: 2 anos.

### 10. Testes de segurança automatizados no CI

Suite de testes obrigatória que bloqueia o CI se falhar:
- Anti-enumeração (timing test entre e-mail inexistente e senha errada)
- Rate limiting (5 tentativas → 429)
- JWT algorithm confusion (alg: none → 401)
- Magic bytes (EXE renomeado para JPG → 400)
- SSRF (URL localhost → 400)
- SQL injection em inputs de texto
- XSS em campos de texto armazenado

---

## Consequências

### Positivas
- Defesa em profundidade: falha em uma camada não compromete o sistema inteiro
- Testes de segurança automatizados capturam regressões antes do deploy
- Audit log defensável juridicamente em disputas com clientes
- Zero segredos no repositório elimina o vetor de ataque mais comum em projetos solo

### Negativas
- Overhead de desenvolvimento: cada feature precisa de testes de segurança adicionais
- Magic bytes validation adiciona latência em uploads
- SELECT FOR UPDATE pode criar contenção em cargas altas — aceitável no MVP

---

## Referências

- OWASP Top 10 2025
- OWASP ASVS v4.0
- RFC 9110 (HTTP Semantics)
- Argon2 RFC 9106
- LGPD — Lei 13.709/2018
