# Runbook: Iniciar o Sistema Hefesto

## Pré-requisitos

- Docker Desktop rodando
- Node.js 22 + Python 3.12 instalados
- `.env` preenchido com base em `.env.example`

## 1. Infraestrutura Local

```bash
docker compose -f infra/docker-compose.yml up -d
# Aguardar: PostgreSQL (5432), Redis (6379), ChromaDB (8000), Ollama (11434)
docker compose -f infra/docker-compose.yml ps
```

## 2. Database Migrations

```bash
npm run db:migrate -w @hefesto/api
```

## 3. Seed RAG (primeira vez)

```bash
cd apps/agent-runtime
pip install -e ".[dev]"
python scripts/seed_builder_rag.py
```

## 4. Iniciar API + Web

```bash
npm run dev   # Turbo: api (3333) + web (3000) em paralelo
```

## 5. Iniciar Agent Runtime

```bash
cd apps/agent-runtime
python -m src.main   # FastAPI em runtime_host:runtime_port (padrão 8001)
```

## Verificação

- API: `curl http://localhost:3333/api/v1/health`
- Web: Abrir `http://localhost:3000`
- Agent Runtime: `curl http://localhost:8001/health`

## Troubleshooting

| Sintoma                | Causa                 | Solução                                                   |
| ---------------------- | --------------------- | --------------------------------------------------------- |
| API falha na migration | PostgreSQL não pronto | `docker compose ps` → aguardar healthy                    |
| Agent Runtime crash    | Faltam env vars LLM   | Verificar `ANTHROPIC_API_KEY` ou `OPENAI_API_KEY` no .env |
| ChromaDB vazio         | Seed não rodou        | `python scripts/seed_builder_rag.py`                      |
