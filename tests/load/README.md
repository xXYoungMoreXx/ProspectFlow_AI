# Load Tests — Hefesto

k6 load tests para identificar breaking points antes do deploy em VPS.

## Pré-requisitos

```bash
# Instalar k6 (Windows)
winget install k6 --source winget
# ou
choco install k6

# macOS
brew install k6
```

## Stack local obrigatória

```bash
docker compose -f infra/docker-compose.yml up -d
npm run dev
```

API deve estar acessível em `http://localhost:3001/api/v1`.

## Executar cenários individuais

```bash
# Leads CRUD (50 VUs, ~2.5min)
k6 run tests/load/scenarios/leads.js

# HITL approve flow (20 VUs, ~2.5min)
k6 run tests/load/scenarios/hitl-approve.js

# Agent activate — CUIDADO: resource intensive (10 VUs, ~3min)
k6 run tests/load/scenarios/agent-activate.js
```

## Executar todos juntos

```bash
k6 run tests/load/run-all.js
```

## Variáveis de ambiente

| Variável             | Padrão                         | Descrição                                        |
| -------------------- | ------------------------------ | ------------------------------------------------ |
| `BASE_URL`           | `http://localhost:3001/api/v1` | URL base da API                                  |
| `TEST_EMAIL`         | `admin@hefesto.local`          | Email do usuário de teste                        |
| `TEST_PASSWORD`      | `Admin@123456`                 | Senha do usuário de teste                        |
| `LOAD_TEST_AGENT_ID` | (auto-detectado)               | ID de agente específico para o teste de activate |

```bash
k6 run \
  --env BASE_URL=http://localhost:3001/api/v1 \
  --env TEST_EMAIL=admin@hefesto.local \
  --env TEST_PASSWORD=Admin@123456 \
  tests/load/run-all.js
```

## Thresholds

| Cenário            | p95      | Error rate |
| ------------------ | -------- | ---------- |
| `/leads` CRUD      | < 200ms  | < 1%       |
| `/agents/activate` | < 5000ms | < 5%       |
| `/hitl` approve    | < 500ms  | < 1%       |

## Interpretando resultados

- `http_req_duration` p95 acima do threshold → gargalo no endpoint
- `http_req_failed` acima do threshold → erros de aplicação ou DB overwhelm
- `agent-activate` lento: verificar fila BullMQ + agent-runtime load

## Saída de exemplo esperada

```
✓ GET /leads 200 .........: 100.00%
✓ POST /leads 201 ........: 99.85%
✓ PATCH /leads/:id 200 ..: 99.90%

http_req_duration..........: avg=45ms  p(90)=120ms  p(95)=180ms
http_req_failed............: 0.05%
```
