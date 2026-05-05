# ProspectFlow AI — Makefile
.PHONY: help up down logs shell db-migrate db-upgrade test prospect

help: ## Mostra este help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

# ── Docker ────────────────────────────────────────────────────────────────────
up: ## Sobe todos os serviços
	docker compose up -d --build
	@echo "✅ ProspectFlow AI rodando em http://localhost:8000"

down: ## Para todos os serviços
	docker compose down

logs: ## Mostra logs em tempo real
	docker compose logs -f app worker-convagent worker-leadhunter worker-sitebuilder

shell: ## Abre shell no container da app
	docker compose exec app bash

restart: ## Reinicia apenas a app (sem recriar banco)
	docker compose restart app worker-convagent worker-leadhunter worker-sitebuilder

# ── Banco de dados ────────────────────────────────────────────────────────────
db-migrate: ## Cria nova migration (uso: make db-migrate msg="descricao")
	docker compose exec app alembic revision --autogenerate -m "$(msg)"

db-upgrade: ## Aplica migrations pendentes
	docker compose exec app alembic upgrade head

db-downgrade: ## Reverte última migration
	docker compose exec app alembic downgrade -1

db-shell: ## Abre psql no container do postgres
	docker compose exec postgres psql -U pf_user -d prospectflow

# ── Desenvolvimento ───────────────────────────────────────────────────────────
dev: ## Roda em modo desenvolvimento (hot reload)
	uvicorn api.main:app --reload --host 0.0.0.0 --port 8000

test: ## Roda os testes
	docker compose exec app pytest tests/ -v --tb=short

test-security: ## Roda apenas testes de segurança
	docker compose exec app pytest tests/test_security.py -v

# ── Prospecção ────────────────────────────────────────────────────────────────
prospect: ## Dispara job de prospecção (uso: make prospect cat="salão de beleza" city="Salvador BA")
	@curl -s -X POST http://localhost:8000/jobs/prospect \
		-H "Content-Type: application/json" \
		-H "X-Api-Key: $$(grep SECRET_KEY .env | cut -d= -f2)" \
		-d '{"category":"$(cat)","city":"$(city)"}' | python3 -m json.tool

# ── Monitoramento ─────────────────────────────────────────────────────────────
metrics: ## Mostra métricas do sistema
	@curl -s http://localhost:8000/metrics \
		-H "X-Api-Key: $$(grep SECRET_KEY .env | cut -d= -f2)" | python3 -m json.tool

health: ## Health check
	@curl -s http://localhost:8000/health | python3 -m json.tool

leads: ## Lista leads (uso: make leads status=new)
	@curl -s "http://localhost:8000/leads?status=$(status)&limit=20" \
		-H "X-Api-Key: $$(grep SECRET_KEY .env | cut -d= -f2)" | python3 -m json.tool

# ── Setup inicial ─────────────────────────────────────────────────────────────
setup: ## Configura o ambiente pela primeira vez
	@cp -n .env.example .env || true
	@echo ""
	@echo "⚠️  Edite o arquivo .env com suas credenciais antes de continuar"
	@echo ""
	@echo "Passos:"
	@echo "  1. nano .env         (preencha as API keys)"
	@echo "  2. make up           (sobe os containers)"
	@echo "  3. make db-upgrade   (cria as tabelas)"
	@echo "  4. make health       (verifica se tudo está ok)"
	@echo "  5. make prospect cat='salão de beleza' city='Salvador BA'"
