# TEST_STRATEGY.md — Estratégia de Testes do AgentePro

> TDD é obrigatório. O teste vem antes do código, sempre.
> Última atualização: 2026-05-29 | Versão: 2.0.0

---

## 1. Pirâmide de Testes

```
                      /\
                     /  \
                    / E2E \          Playwright — 10–15 fluxos críticos
                   /------\
                  /        \
                 / Integration\      Supertest + Testcontainers — ~80 testes
                /--------------\
               /                \
              /    Unit Tests     \  Vitest — >300 testes
             /--------------------\
            /   Security Tests     \ Custom + OWASP ZAP — BLOQUEANTE no CI
           /--------------------------\
```

**Distribuição alvo:**
- Unit: 70% do total de testes
- Integration: 20%
- E2E: 7%
- Security: 3% (mas 100% obrigatório no CI)

---

## 2. Ferramentas por Tipo

| Tipo | Ferramenta | Config |
|---|---|---|
| Unit (TS) | Vitest | `vitest.config.ts` |
| Unit (Python) | pytest + pytest-asyncio | `pyproject.toml` |
| Integration (TS) | Vitest + Supertest + Testcontainers | `vitest.integration.config.ts` |
| E2E | Playwright | `playwright.config.ts` |
| Security | Custom + ZAP | `.github/workflows/security.yml` |
| Coverage | V8 (via Vitest) | threshold: 80% |

---

## 3. O que mockar vs. usar real

### SEMPRE mockar (nunca chamar APIs reais nos testes)
```
✅ Google Maps API           → MockGoogleMapsAdapter
✅ Anthropic / LLM APIs      → MockLLMAdapter (respostas fixas)
✅ Gemini / Nano Banana Pro  → MockMediaGenerationAdapter
✅ Evolution API (WhatsApp)  → MockWhatsAppAdapter
✅ Telegram Bot API          → MockTelegramAdapter
✅ HeyGen API                → MockVideoGenerationAdapter
✅ Cal.com API               → MockSchedulingAdapter
✅ Brevo / SMTP              → MockEmailAdapter
✅ Infisical / Vault         → MockSecretsProvider (usa env vars de teste)
```

### SEMPRE usar containers reais (Testcontainers)
```
✅ PostgreSQL 16-alpine      → real DB com migrations
✅ Redis 7-alpine            → real cache e BullMQ
✅ ChromaDB                  → real para testes de RAG
```

---

## 4. Configuração dos Testcontainers

```typescript
// tests/integration/setup.ts

import { PostgreSqlContainer } from '@testcontainers/postgresql';
import { RedisContainer }       from '@testcontainers/redis';
import { GenericContainer }     from 'testcontainers';

let pgContainer: StartedPostgreSqlContainer;
let redisContainer: StartedRedisContainer;
let chromaContainer: StartedTestContainer;

// Rodar uma vez por suite de integração (beforeAll global)
export async function startContainers() {
  [pgContainer, redisContainer, chromaContainer] = await Promise.all([
    new PostgreSqlContainer('postgres:16-alpine')
      .withDatabase('agentepro_test')
      .withUsername('test')
      .withPassword('test')
      .start(),

    new RedisContainer('redis:7-alpine').start(),

    new GenericContainer('chromadb/chroma:latest')
      .withExposedPorts(8000)
      .start(),
  ]);

  process.env.DATABASE_URL = pgContainer.getConnectionUri();
  process.env.REDIS_URL    = `redis://${redisContainer.getHost()}:${redisContainer.getFirstMappedPort()}`;
  process.env.CHROMA_URL   = `http://${chromaContainer.getHost()}:${chromaContainer.getMappedPort(8000)}`;

  await runMigrations(process.env.DATABASE_URL);
}

export async function stopContainers() {
  await Promise.all([
    pgContainer?.stop(),
    redisContainer?.stop(),
    chromaContainer?.stop(),
  ]);
}

// Limpar dados entre testes (não entre suites — seria lento)
export async function clearDatabase(db: DrizzleDb) {
  await db.execute(sql`
    TRUNCATE TABLE leads, deals, briefings, projects, messages,
      hitl_approvals, audit_log, token_usage_log,
      sub_agents, agent_skills, agent_rules CASCADE
  `);
}
```

---

## 5. Factories de Dados — Obrigatórias

```typescript
// tests/factories/index.ts — exportar todos

export * from './operator.factory';
export * from './agent.factory';
export * from './sub-agent.factory';
export * from './lead.factory';
export * from './deal.factory';
export * from './briefing.factory';
export * from './project.factory';
export * from './hitl.factory';
export * from './enrichment-data.factory';
```

```typescript
// tests/factories/lead.factory.ts

export class LeadFactory {
  static create(overrides: Partial<LeadCreateProps> = {}): Lead {
    return Lead.create({
      id: new LeadId(randomUUID()),
      contactName: 'João Silva',
      businessName: 'Bella Napoli Pizzaria',
      contactPhone: '+5571999990000',
      source: 'GOOGLE_MAPS',
      status: 'NEW',
      preferredChannel: 'WHATSAPP',
      enrichmentData: EnrichmentDataFactory.createActive(),
      qualificationScore: null,
      followUpSchedule: FollowUpSchedule.default(),
      ...overrides,
    });
  }

  static createQualified(score = 75): Lead {
    const lead = LeadFactory.create();
    lead.qualify(new QualificationScore(score));
    return lead;
  }

  static createConverted(): Lead {
    const lead = LeadFactory.createQualified();
    const deal = DealFactory.create({ leadId: lead.id });
    lead.convert(deal);
    return lead;
  }

  static createWithSuspendedCNPJ(): Lead {
    return LeadFactory.create({
      enrichmentData: EnrichmentDataFactory.createSuspended(),
    });
  }

  static createWithoutWebsite(): Lead {
    return LeadFactory.create({
      enrichmentData: EnrichmentDataFactory.createNoWebsite(),
    });
  }
}

// tests/factories/enrichment-data.factory.ts

export class EnrichmentDataFactory {
  static createActive(): EnrichmentData {
    return new EnrichmentData({
      cnpj: '12.345.678/0001-90',
      cnpjStatus: 'ATIVA',
      yearsInBusiness: 4,
      googleMapsPlaceId: 'ChIJtest123',
      googleRating: 4.8,
      googleReviewsCount: 234,
      hasWebsite: false,
      neighborhood: 'Barra',
      city: 'Salvador',
      state: 'BA',
    });
  }

  static createSuspended(): EnrichmentData {
    return new EnrichmentData({
      cnpjStatus: 'SUSPENSA',
      hasWebsite: false,
      googleRating: 4.2,
      googleReviewsCount: 50,
    });
  }

  static createNoWebsite(): EnrichmentData {
    return new EnrichmentData({
      cnpjStatus: 'ATIVA',
      hasWebsite: false,
      googleRating: 4.5,
      googleReviewsCount: 120,
    });
  }

  static createWithWebsite(): EnrichmentData {
    return new EnrichmentData({
      cnpjStatus: 'ATIVA',
      hasWebsite: true,
      websiteQualityHint: 'outdated',
      googleRating: 3.8,
      googleReviewsCount: 30,
    });
  }
}
```

---

## 6. Nomenclatura de Testes

```typescript
// Padrão obrigatório — 3 níveis:

describe('[Entidade/UseCase/Adapter]', () => {
  describe('[método/comportamento]', () => {
    it('deve [resultado esperado] quando [condição/contexto]', () => { ... });
    it('deve lançar [Erro] quando [condição inválida]',         () => { ... });
    it('deve emitir [Evento] quando [estado muda]',            () => { ... });
    it('deve retornar null quando [entidade não existe]',       () => { ... });
  });
});

// Exemplos corretos:
it('deve qualificar lead quando score >= 40')
it('deve bloquear lead quando CNPJ está suspenso')
it('deve lançar HITLRequiredError quando mensagem enviada sem aprovação')
it('deve emitir LeadQualified quando qualificação bem-sucedida')
it('deve retornar null quando lead não encontrado pelo ID')
it('deve incrementar follow_up_count após envio de follow-up')

// Exemplos INCORRETOS:
it('test 1')                          // ❌ sem descrição
it('funciona')                        // ❌ vago
it('deve criar lead')                 // ❌ sem condição
it('Lead deve ser qualificado se...')  // ❌ sujeito errado (usar 'deve')
```

---

## 7. Testes por Camada

### 7.1 Domain (Unit Tests)

```typescript
// Foco: invariantes, value objects, domain events
// Sem mocks — tudo é código puro TypeScript
// Cobertura alvo: 90%

describe('QualificationScore', () => {
  it('deve aceitar valores entre 0 e 100')
  it('deve lançar ValidationError para valor negativo')
  it('deve lançar ValidationError para valor acima de 100')
  it('deve retornar true para isQualified() quando >= 40')
  it('deve retornar false para isQualified() quando < 40')
});

describe('LLMConfiguration', () => {
  it('deve retornar custo correto para claude-sonnet-4-6')
  it('deve retornar custo 0 para ollama provider')
  it('deve lançar ValidationError quando model vazio')
  it('deve mascarar apiKeyRef em toSafeLog()')
});

describe('EnrichmentData', () => {
  it('deve retornar qualificationBonus = 20 para CNPJ ativo')
  it('deve retornar qualificationBonus = 0 para CNPJ suspenso')
  it('deve somar bônus corretamente para lead ideal')
});

describe('Lead.qualify()', () => {
  it('deve qualificar lead quando score >= 40')
  it('deve emitir LeadQualified com score correto')
  it('deve lançar DomainError quando lead já convertido')
  it('deve atualizar status para QUALIFIED')
  it('deve lançar ValidationError para score inválido')
});

describe('Lead.scheduleFollowUp()', () => {
  it('deve criar schedule com cadência [3, 7, 14]')
  it('deve calcular nextFollowUpAt corretamente')
  it('deve emitir FollowUpScheduled')
  it('deve retornar isExhausted() = true após maxAttempts')
});
```

### 7.2 Application (Unit Tests com mocks)

```typescript
// Foco: orquestração do use case, erros, eventos
// Mocks: repositories, external ports, event bus
// Cobertura alvo: 85%

describe('QualifyLeadUseCase', () => {
  let useCase: QualifyLeadUseCase;
  let leadRepoMock: jest.Mocked<LeadRepository>;
  let mcpMock: jest.Mocked<MCPBrasilPort>;
  let eventBusMock: jest.Mocked<EventBus>;

  beforeEach(() => {
    leadRepoMock = createMockLeadRepository();
    mcpMock      = createMockMCPBrasil();
    eventBusMock = createMockEventBus();
    useCase = new QualifyLeadUseCase(leadRepoMock, mcpMock,
                                     scoringService, eventBusMock, logger);
  });

  it('deve qualificar lead e salvar quando CNPJ ativo', async () => {
    const lead = LeadFactory.createWithoutWebsite();
    leadRepoMock.findById.mockResolvedValue(lead);
    mcpMock.consultarCNPJ.mockResolvedValue(EnrichmentDataFactory.createActive());

    const result = await useCase.execute({
      leadId: lead.id.value,
      operatorId: 'op-123',
      correlationId: 'corr-123',
    });

    expect(leadRepoMock.save).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'QUALIFIED' })
    );
    expect(eventBusMock.publishAll).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ eventType: 'LeadQualified' })
      ])
    );
    expect(result.score).toBeGreaterThanOrEqual(40);
  });

  it('deve lançar NotFoundError quando lead não existe', async () => {
    leadRepoMock.findById.mockResolvedValue(null);

    await expect(useCase.execute({ leadId: 'nao-existe', operatorId: 'op', correlationId: 'c' }))
      .rejects.toThrow(NotFoundError);

    expect(leadRepoMock.save).not.toHaveBeenCalled();
    expect(eventBusMock.publishAll).not.toHaveBeenCalled();
  });

  it('deve bloquear lead quando CNPJ suspenso', async () => {
    const lead = LeadFactory.create();
    leadRepoMock.findById.mockResolvedValue(lead);
    mcpMock.consultarCNPJ.mockResolvedValue(EnrichmentDataFactory.createSuspended());

    const result = await useCase.execute({ leadId: lead.id.value, operatorId: 'op', correlationId: 'c' });

    expect(result.blocked).toBe(true);
    expect(result.blockReason).toBe('block_suspended_cnpj');
    expect(leadRepoMock.save).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'LOST' })
    );
  });
});
```

### 7.3 Infrastructure (Integration Tests)

```typescript
// Foco: repositórios, queries SQL, cache, queue
// Real: PostgreSQL + Redis (Testcontainers)
// Mocks: APIs externas

describe('DrizzleLeadRepository', () => {
  it('deve criar lead e retornar com ID gerado')
  it('deve encontrar lead por ID')
  it('deve retornar null para ID inexistente')
  it('deve listar leads paginados por cursor')
  it('deve filtrar leads por status')
  it('deve filtrar leads com next_follow_up_at no passado')
  it('deve atualizar enrichment_data com JSONB')
  it('deve incrementar follow_up_count atomicamente')
  it('deve deduplicar por maps_place_id nos últimos 30 dias')
  it('deve salvar domain events no audit_log via trigger')
});

describe('CacheService', () => {
  it('deve armazenar e recuperar objeto JSON')
  it('deve expirar após TTL configurado')
  it('deve retornar null após expiração')
  it('deve invalidar por padrão de chave (pattern)')
  it('deve gerar chave de Maps com data atual')
});
```

### 7.4 HTTP (Integration Tests)

```typescript
// Foco: validação de input, auth, rate limit, resposta correta
// Real: Fastify + Supertest + PostgreSQL

describe('POST /api/v1/auth/login', () => {
  it('deve retornar 200 com tokens para credenciais válidas')
  it('deve retornar 401 com mensagem genérica para senha errada')
  it('deve retornar 401 com mensagem genérica para email inexistente')
  it('deve retornar 400 para email com formato inválido')
  it('deve retornar 429 após 5 tentativas em 15 minutos')
  it('deve ter timing similar entre email válido e inválido (< 200ms)')
});

describe('POST /api/v1/leads', () => {
  it('deve criar lead e retornar 201 com dados')
  it('deve retornar 401 sem token de autenticação')
  it('deve retornar 400 para payload inválido')
  it('deve retornar 400 sem telefone e sem email')
  it('deve incluir requestId no header de resposta')
  it('deve respeitar rate limit de 100 req/min')
});

describe('POST /api/v1/hitl/:id/approve', () => {
  it('deve aprovar HITL e retornar 200')
  it('deve retornar 404 para HITL inexistente')
  it('deve retornar 409 para HITL já decidido')
  it('deve retornar 410 para HITL expirado')
  it('deve registrar no audit log após aprovação')
  it('deve retornar 403 sem token')
});
```

---

## 8. Testes de Segurança (BLOQUEANTES no CI)

```typescript
// tests/security/auth.security.test.ts

describe('Security: Autenticação', () => {
  it('ANTI-ENUM: mensagem idêntica para email inexistente e senha errada', async () => {
    const [r1, r2] = await Promise.all([
      req.post('/api/v1/auth/login').send({ email: 'naoexiste@test.com', password: 'wrong' }),
      req.post('/api/v1/auth/login').send({ email: 'existe@test.com', password: 'wrong' }),
    ]);
    expect(r1.body.errors[0].message).toBe(r2.body.errors[0].message);
  });

  it('ANTI-TIMING: diferença < 200ms entre email válido e inválido', async () => {
    const t1 = Date.now(); await req.post('/api/v1/auth/login')
      .send({ email: 'naoexiste@test.com', password: 'wrong' });
    const d1 = Date.now() - t1;

    const t2 = Date.now(); await req.post('/api/v1/auth/login')
      .send({ email: 'existe@test.com', password: 'wrong' });
    const d2 = Date.now() - t2;

    expect(Math.abs(d1 - d2)).toBeLessThan(200);
  });

  it('BRUTE-FORCE: bloquear após 5 tentativas em 15 minutos', async () => {
    for (let i = 0; i < 5; i++) {
      await req.post('/api/v1/auth/login').send({ email: 'test@test.com', password: 'wrong' });
    }
    const res = await req.post('/api/v1/auth/login').send({ email: 'test@test.com', password: 'wrong' });
    expect(res.status).toBe(429);
  });

  it('JWT-ALG: rejeitar token HS256 (aceitar apenas RS256)', async () => {
    const hs256Token = sign({ sub: 'test' }, 'secret', { algorithm: 'HS256' });
    const res = await req.get('/api/v1/leads').set('Authorization', `Bearer ${hs256Token}`);
    expect(res.status).toBe(401);
  });
});

// tests/security/upload.security.test.ts

describe('Security: Magic Bytes em Uploads', () => {
  it('deve rejeitar EXE disfarçado de JPEG', async () => {
    const fakeJpeg = Buffer.concat([
      Buffer.from('MZ'),                 // EXE magic bytes
      Buffer.from('x'.repeat(1000)),
    ]);
    const res = await req.post('/api/v1/briefings/:id/assets')
      .attach('file', fakeJpeg, { filename: 'logo.jpg', contentType: 'image/jpeg' });
    expect(res.status).toBe(400);
    expect(res.body.errors[0].code).toBe('INVALID_FILE_TYPE');
  });

  it('deve rejeitar arquivo com script embutido nos primeiros bytes', async () => {
    const polyglot = Buffer.from('<script>alert(1)</script>' + '\xff\xd8\xff');
    const res = await req.post('/api/v1/briefings/:id/assets')
      .attach('file', polyglot, { filename: 'image.jpg', contentType: 'image/jpeg' });
    expect(res.status).toBe(400);
  });

  it('deve rejeitar imagem gerada por IA com magic bytes inválidos', async () => {
    const fakeAiImage = Buffer.from('NOT-AN-IMAGE-BYTES');
    const validateMagicBytes = container.resolve(MagicBytesValidator);
    await expect(validateMagicBytes.validate(fakeAiImage))
      .rejects.toThrow(SecurityError);
  });

  it('deve aceitar JPEG real', async () => {
    const realJpeg = readFileSync('tests/fixtures/valid_photo.jpg');
    const res = await req.post('/api/v1/briefings/:id/assets')
      .attach('file', realJpeg, { filename: 'photo.jpg', contentType: 'image/jpeg' });
    expect(res.status).toBe(201);
  });
});

// tests/security/ssrf.security.test.ts

describe('Security: SSRF Prevention', () => {
  const INTERNAL_URLS = [
    'http://localhost:8080/internal',
    'http://127.0.0.1:5432',
    'http://10.0.0.1/secret',
    'http://192.168.1.1/admin',
    'http://172.16.0.1/metadata',
    'http://169.254.169.254/latest/meta-data',  // AWS metadata
  ];

  INTERNAL_URLS.forEach(url => {
    it(`deve bloquear URL interna: ${url}`, async () => {
      const validateUrl = container.resolve(SSRFValidator);
      expect(() => validateUrl.validate(url)).toThrow(SecurityError);
    });
  });
});

// tests/security/hitl.security.test.ts

describe('Security: HITL Obrigatório', () => {
  it('deve retornar 403 HITL_REQUIRED ao tentar enviar WhatsApp sem aprovação', async () => {
    const agent = await createActiveAgent({ persona: 'CLOSER' });
    const res = await req.post(`/api/v1/agents/${agent.id}/execute`)
      .set('Authorization', `Bearer ${token}`)
      .send({ task: 'SEND_WHATSAPP', to: '+5511999999999', message: 'Olá!' });

    expect(res.status).toBe(403);
    expect(res.body.errors[0].code).toBe('HITL_REQUIRED');
  });

  it('deve retornar 403 HITL_REQUIRED ao tentar deploy sem aprovação staging', async () => {
    // ... similar
  });
});
```

---

## 9. Testes E2E (Playwright)

```typescript
// tests/e2e/auth.spec.ts

test('operador faz login e acessa painel', async ({ page }) => {
  await page.goto('/login');
  await page.fill('[name=email]', 'admin@test.com');
  await page.fill('[name=password]', 'secure-password-123');
  await page.click('[type=submit]');

  await expect(page).toHaveURL('/dashboard');
  await expect(page.locator('[data-testid=hitl-badge]')).toBeVisible();
});

// tests/e2e/hitl.spec.ts

test('operador aprova HITL via painel e ação é executada', async ({ page, request }) => {
  // Criar HITL de teste via API
  const hitl = await request.post('/api/v1/hitl/test', { data: testHITLPayload });

  await page.goto('/hitl');
  await expect(page.locator(`[data-hitl-id="${hitl.id}"]`)).toBeVisible();

  // Aprovar pelo painel
  await page.click(`[data-hitl-id="${hitl.id}"] [data-action=approve]`);
  await expect(page.locator('[data-testid=hitl-success-toast]')).toBeVisible();

  // Verificar que HITL foi marcado como aprovado
  const updated = await request.get(`/api/v1/hitl/${hitl.id}`);
  expect(updated.json().data.status).toBe('APPROVED');
});
```

---

## 10. CI — Configuração do Pipeline de Testes

```yaml
# .github/workflows/ci.yml

name: CI — Tests & Security

on: [push, pull_request]

jobs:
  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '22' }
      - run: npm ci
      - run: npm run test:unit
      - run: npm run test:coverage
      - name: Assert coverage threshold
        run: |
          COVERAGE=$(cat coverage/coverage-summary.json | jq '.total.statements.pct')
          if (( $(echo "$COVERAGE < 80" | bc -l) )); then
            echo "Coverage $COVERAGE% below threshold 80%"; exit 1
          fi

  security-tests:
    runs-on: ubuntu-latest
    # Security tests SEMPRE rodam — nunca pular mesmo em hotfix
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - run: npm run test:security
      # Falha aqui = PR bloqueado, sem exceção

  integration-tests:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16-alpine
        env: { POSTGRES_DB: test, POSTGRES_USER: test, POSTGRES_PASSWORD: test }
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - run: npm run test:integration

  e2e-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: docker-compose -f docker-compose.test.yml up -d
      - run: npx playwright install chromium
      - run: npm run test:e2e
      - uses: actions/upload-artifact@v4
        if: failure()
        with:
          name: playwright-screenshots
          path: tests/e2e/screenshots/

  python-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with: { python-version: '3.12' }
      - run: pip install -e "apps/agent-runtime[test]"
      - run: pytest apps/agent-runtime/tests/ -v --cov=src --cov-fail-under=75
```

---

## 11. Coverage Mínimo por Módulo

| Módulo | Statements | Branches | Nota |
|---|---|---|---|
| `domain/` | 90% | 85% | Lógica crítica de negócio |
| `application/` | 85% | 80% | Use cases orquestram tudo |
| `infrastructure/db/` | 80% | 75% | Repos testados com Testcontainers |
| `infrastructure/adapters/` | 70% | 65% | APIs externas sempre mockadas |
| `http/routes/` | 80% | 75% | Testados via Supertest |
| `security/` | 100% | 100% | SEM EXCEÇÃO |
| `agent-runtime/` | 75% | 70% | Python com pytest |

---

## 12. Fixtures de Teste (arquivos estáticos)

```
tests/fixtures/
  valid_photo.jpg          ← JPEG real (magic bytes corretos)
  valid_logo.png           ← PNG real
  valid_logo.webp          ← WebP real
  valid_document.pdf       ← PDF real
  fake_exe_as_jpg.jpg      ← EXE com extensão .jpg (para security test)
  polyglot_html_jpg.jpg    ← HTML + JPEG polyglot (para security test)
  script_embedded.png      ← PNG com <script> nos primeiros bytes
  large_file_11mb.jpg      ← Arquivo > 10MB (para testar limite)
```

**Como gerar as fixtures:**
```bash
# Gerar fake EXE com extensão jpg
echo -n 'MZ' > tests/fixtures/fake_exe_as_jpg.jpg
python3 -c "print('x'*10000, end='')" >> tests/fixtures/fake_exe_as_jpg.jpg

# Gerar arquivo grande para testar limite
dd if=/dev/zero bs=1M count=11 | \
  python3 -c "import sys; sys.stdout.buffer.write(b'\xff\xd8\xff' + sys.stdin.buffer.read())" \
  > tests/fixtures/large_file_11mb.jpg
```
