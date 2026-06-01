# ENV.md — Referência Completa de Variáveis de Ambiente

> Toda variável deve estar documentada aqui.
> O app NÃO sobe se uma variável obrigatória estiver ausente (fail fast via Zod).
> Versão: 2.0.0 | Atualizado: 2026-05-29

---

## Como Funciona o Carregamento

```typescript
// infrastructure/config/env.ts — validado no startup

import { z } from "zod";

const EnvSchema = z
  .object({
    // Obrigatórias — app crasha se ausentes
    NODE_ENV: z.enum(["development", "test", "production"]),
    DATABASE_URL: z.string().url(),
    REDIS_URL: z.string().url(),
    JWT_PRIVATE_KEY: z.string().min(100), // RS256 private key PEM
    JWT_PUBLIC_KEY: z.string().min(100), // RS256 public key PEM

    // Opcionais com defaults
    API_PORT: z.coerce.number().default(3001),
    LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
  })
  .passthrough(); // Permite variáveis extras sem rejeitar

export const env = EnvSchema.parse(process.env);
// Se inválido → z.ZodError detalhado → processo termina com exit(1)
```

---

## Catálogo Completo

### 🔴 CRÍTICAS — App não sobe sem elas

---

#### `NODE_ENV`

| Campo                  | Valor                                                           |
| ---------------------- | --------------------------------------------------------------- |
| **Tipo**               | `'development' \| 'test' \| 'production'`                       |
| **Default**            | Nenhum — obrigatório                                            |
| **Impacto se ausente** | Crash no startup                                                |
| **Usado em**           | Logger (nível), Error handler (expor stack ou não), Cache (TTL) |
| **Dev**                | `development`                                                   |
| **Prod**               | `production`                                                    |

---

#### `DATABASE_URL`

| Campo                  | Valor                                                                      |
| ---------------------- | -------------------------------------------------------------------------- |
| **Tipo**               | PostgreSQL connection string                                               |
| **Formato**            | `postgresql://user:password@host:port/database?sslmode=require`            |
| **Validação**          | Zod URL + ping na inicialização (SELECT 1)                                 |
| **Impacto se ausente** | Crash no startup                                                           |
| **Usado em**           | DrizzleORM, BullMQ (para persistência de jobs)                             |
| **Dev**                | `postgresql://agentepro:dev123@localhost:5432/agentepro`                   |
| **Prod**               | `postgresql://agentepro:${SECRET}@postgres:5432/agentepro?sslmode=require` |
| **Nota**               | Em produção SEMPRE com `?sslmode=require`                                  |

---

#### `REDIS_URL`

| Campo                  | Valor                                                               |
| ---------------------- | ------------------------------------------------------------------- |
| **Tipo**               | Redis connection string                                             |
| **Formato**            | `redis://:password@host:port/db`                                    |
| **Validação**          | Zod URL + PING na inicialização                                     |
| **Impacto se ausente** | Crash no startup                                                    |
| **Usado em**           | BullMQ (filas), CacheService (Maps, CNPJ, RAG), Rate limiter        |
| **Dev**                | `redis://:dev123@localhost:6379/0`                                  |
| **Prod**               | `redis://:${SECRET}@redis:6379/0`                                   |
| **Nota**               | DB 0 = app geral, DB 1 = WhatsApp (Evolution), DB 2 = Agent Runtime |

---

#### `JWT_PRIVATE_KEY`

| Campo                  | Valor                                                                 |
| ---------------------- | --------------------------------------------------------------------- |
| **Tipo**               | RSA private key PEM (RS256)                                           |
| **Formato**            | `-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----` |
| **Como gerar**         | `openssl genrsa -out private.pem 2048`                                |
| **Impacto se ausente** | Crash no startup                                                      |
| **Usado em**           | `jose` para assinar JWT de acesso e refresh                           |
| **Dev**                | Gerar localmente e colocar no `.env.local`                            |
| **Prod**               | Infisical Vault — ref: `secrets/jwt_private_key`                      |
| **NUNCA**              | Commitar no git. Verificar com `git log -p --all -- '*.pem'`          |

---

#### `JWT_PUBLIC_KEY`

| Campo                  | Valor                                                       |
| ---------------------- | ----------------------------------------------------------- |
| **Tipo**               | RSA public key PEM                                          |
| **Formato**            | `-----BEGIN PUBLIC KEY-----\n...\n-----END PUBLIC KEY-----` |
| **Como gerar**         | `openssl rsa -in private.pem -pubout -out public.pem`       |
| **Impacto se ausente** | Crash no startup                                            |
| **Usado em**           | `jose` para verificar JWT em todos os requests              |

---

### 🟡 IMPORTANTES — Features críticas indisponíveis sem elas

---

#### `ANTHROPIC_API_KEY`

| Campo                  | Valor                                                                                  |
| ---------------------- | -------------------------------------------------------------------------------------- |
| **Tipo**               | `string` (começa com `sk-ant-`)                                                        |
| **Regex de validação** | `/^sk-ant-/`                                                                           |
| **Impacto se ausente** | Agentes CLOSER, BUILDER, QA, DELIVERY indisponíveis                                    |
| **Modelos usados**     | `claude-opus-4-8`, `claude-opus-4-7`, `claude-sonnet-4-6`, `claude-haiku-4-5-20251001` |
| **Tier relevante**     | Tier 2, 3, 4a, 4b do LLM routing                                                       |
| **Cost alert**         | Configurar billing alert em $50 na Anthropic Console                                   |
| **Prod**               | Infisical ref: `secrets/anthropic_key`                                                 |

---

#### `GEMINI_API_KEY`

| Campo                  | Valor                                                                         |
| ---------------------- | ----------------------------------------------------------------------------- |
| **Tipo**               | `string`                                                                      |
| **Impacto se ausente** | PROSPECTOR (Hunter) usa SearXNG apenas; Nano Banana Pro indisponível          |
| **Modelos usados**     | `gemini/gemini-3.5-flash`, `gemini/gemini-3.1-pro`, `imagen-3.0-generate-001` |
| **Tier relevante**     | Tier 1 (prospecção) e Tier 5 (imagens)                                        |
| **Quota**              | Gemini Flash: 1M tokens/dia free; Imagen: pay-per-use                         |
| **Prod**               | Infisical ref: `secrets/gemini_key`                                           |

---

#### `GOOGLE_MAPS_API_KEY`

| Campo                  | Valor                                                      |
| ---------------------- | ---------------------------------------------------------- |
| **Tipo**               | `string`                                                   |
| **Impacto se ausente** | Hunter usa SearXNG apenas — prospecção 80% menos eficiente |
| **Quota free**         | 2.500 requisições/dia (Places API New)                     |
| **Cache**              | 24h por busca (categoria + região) — minimiza consumo      |
| **Alert**              | Alertar quando remaining < 200                             |
| **Restrição**          | Restringir a IP do VPS no Google Cloud Console             |
| **Prod**               | Infisical ref: `secrets/google_maps_key`                   |

---

#### `EVOLUTION_API_URL`

| Campo                  | Valor                                                  |
| ---------------------- | ------------------------------------------------------ |
| **Tipo**               | URL interna do Docker                                  |
| **Formato**            | `http://evolution-api:8082`                            |
| **Impacto se ausente** | WhatsApp indisponível — usar Telegram/Email como canal |
| **Dev**                | `http://localhost:8082`                                |
| **Prod**               | `http://evolution-api:8082` (interno Docker)           |

---

#### `EVOLUTION_API_KEY`

| Campo                  | Valor                                             |
| ---------------------- | ------------------------------------------------- |
| **Tipo**               | `string` — chave de autenticação da Evolution API |
| **Geração**            | Definido no docker-compose ao subir a Evolution   |
| **Impacto se ausente** | Evolution API rejeita todos os requests com 401   |
| **Prod**               | Infisical ref: `secrets/evolution_api_key`        |

---

#### `WPP_INSTANCE`

| Campo        | Valor                                                                     |
| ------------ | ------------------------------------------------------------------------- |
| **Tipo**     | `string` — nome da instância WhatsApp                                     |
| **Exemplo**  | `agentepro_prod`                                                          |
| **Usado em** | Todos os endpoints da Evolution API (`/message/sendText/${WPP_INSTANCE}`) |

---

#### `TELEGRAM_HITL_BOT_TOKEN`

| Campo                  | Valor                                                       |
| ---------------------- | ----------------------------------------------------------- |
| **Tipo**               | `string` (formato `123456:ABC-DEF1234...`)                  |
| **Propósito**          | Bot 1 — notificações HITL com botões inline para o operador |
| **Como criar**         | Conversar com @BotFather no Telegram                        |
| **Impacto se ausente** | HITL via e-mail apenas (sem aprovação inline)               |
| **Prod**               | Infisical ref: `secrets/telegram_hitl_bot_token`            |

---

#### `TELEGRAM_SALES_BOT_TOKEN`

| Campo                  | Valor                                             |
| ---------------------- | ------------------------------------------------- |
| **Tipo**               | `string`                                          |
| **Propósito**          | Bot 2 — canal de vendas com leads via Telegram    |
| **Impacto se ausente** | Canal Telegram para leads indisponível            |
| **Prod**               | Infisical ref: `secrets/telegram_sales_bot_token` |

---

#### `TELEGRAM_OPERATOR_CHAT_ID`

| Campo                  | Valor                                                            |
| ---------------------- | ---------------------------------------------------------------- |
| **Tipo**               | `string` (ID numérico do chat do operador)                       |
| **Como obter**         | Enviar `/start` para o Bot HITL e verificar o chat_id no webhook |
| **Impacto se ausente** | Bot HITL não sabe para onde enviar notificações                  |
| **Alternativa**        | `TELEGRAM_OPERATOR_GROUP_ID` para grupos de operadores           |

---

### 🟢 OPCIONAIS — Features específicas

---

#### `OPENAI_API_KEY`

| Campo                  | Valor                                                          |
| ---------------------- | -------------------------------------------------------------- |
| **Tipo**               | `string` (começa com `sk-`)                                    |
| **Propósito**          | DALL-E 3 como fallback de imagens quando Nano Banana Pro falha |
| **Impacto se ausente** | Fallback de imagens vai para Ollama (qualidade menor)          |
| **Modelos usados**     | `dall-e-3` apenas                                              |
| **Prod**               | Infisical ref: `secrets/openai_key`                            |

---

#### `GROQ_API_KEY`

| Campo                  | Valor                                                       |
| ---------------------- | ----------------------------------------------------------- |
| **Tipo**               | `string`                                                    |
| **Propósito**          | Llama 3.3 70B via Groq para velocidade máxima em prospecção |
| **Impacto se ausente** | Groq não disponível — LiteLLM usa Gemini Flash              |
| **Prod**               | Infisical ref: `secrets/groq_key`                           |

---

#### `OLLAMA_BASE_URL`

| Campo                  | Valor                                                               |
| ---------------------- | ------------------------------------------------------------------- |
| **Tipo**               | URL                                                                 |
| **Default**            | `http://ollama:11434`                                               |
| **Impacto se ausente** | Tier 0 (roteamento gratuito) indisponível — usa Haiku como fallback |
| **Dev**                | `http://localhost:11434`                                            |
| **Modelos esperados**  | `llama3.2:3b`, `nomic-embed-text`, `llava`                          |

---

#### `HEYGEN_API_KEY`

| Campo                  | Valor                                                     |
| ---------------------- | --------------------------------------------------------- |
| **Tipo**               | `string`                                                  |
| **Propósito**          | Geração de tutoriais em vídeo na entrega                  |
| **Impacto se ausente** | Tutorial em vídeo omitido — PDF de entrega ainda é gerado |
| **Cost**               | ~$0.50 por vídeo de 2 min                                 |
| **Prod**               | Infisical ref: `secrets/heygen_key`                       |

---

#### `HEYGEN_AVATAR_ID`

| Campo          | Valor                                               |
| -------------- | --------------------------------------------------- |
| **Tipo**       | `string` — ID do avatar configurado na conta HeyGen |
| **Como obter** | Acessar HeyGen → Avatars → copiar ID                |
| **Default**    | Se ausente, usar avatar padrão da conta             |

---

#### `CAL_BASE_URL`

| Campo         | Valor                                               |
| ------------- | --------------------------------------------------- |
| **Tipo**      | URL                                                 |
| **Default**   | `http://cal-com:3000` (self-hosted)                 |
| **Propósito** | API do Cal.com para criação de links de agendamento |
| **Dev**       | `http://localhost:3100`                             |

---

#### `CAL_API_KEY`

| Campo                  | Valor                                                        |
| ---------------------- | ------------------------------------------------------------ |
| **Tipo**               | `string`                                                     |
| **Como obter**         | Cal.com → Settings → API Keys → New Key                      |
| **Impacto se ausente** | Agendamento indisponível — Closer não envia links de reunião |

---

#### `MCP_BRASIL_URL`

| Campo                  | Valor                                                         |
| ---------------------- | ------------------------------------------------------------- |
| **Tipo**               | URL                                                           |
| **Default**            | `http://mcp-brasil:8000`                                      |
| **Propósito**          | API do MCP Brasil para consulta de CNPJ/CEP                   |
| **Dev**                | `http://localhost:8003`                                       |
| **Impacto se ausente** | Enriquecimento de CNPJ indisponível — score sem bônus de CNPJ |

---

#### `CHROMA_URL`

| Campo         | Valor                         |
| ------------- | ----------------------------- |
| **Tipo**      | URL                           |
| **Default**   | `http://chromadb:8000`        |
| **Propósito** | ChromaDB para RAG dos agentes |
| **Dev**       | `http://localhost:8001`       |

---

#### `CHROMA_AUTH_TOKEN`

| Campo         | Valor                                      |
| ------------- | ------------------------------------------ |
| **Tipo**      | `string`                                   |
| **Propósito** | Autenticação no ChromaDB                   |
| **Prod**      | Infisical ref: `secrets/chroma_auth_token` |

---

#### `N8N_BASE_URL`

| Campo         | Valor                               |
| ------------- | ----------------------------------- |
| **Tipo**      | URL                                 |
| **Default**   | `http://n8n:5678`                   |
| **Propósito** | Trigger de workflows via API do n8n |

---

#### `N8N_API_KEY`

| Campo          | Valor                                 |
| -------------- | ------------------------------------- |
| **Tipo**       | `string`                              |
| **Como obter** | n8n → Settings → API → Create API Key |
| **Prod**       | Infisical ref: `secrets/n8n_api_key`  |

---

#### `AGENT_RUNTIME_URL`

| Campo         | Valor                                  |
| ------------- | -------------------------------------- |
| **Tipo**      | URL                                    |
| **Default**   | `http://agent-runtime:8000`            |
| **Propósito** | API interna do runtime Python (CrewAI) |
| **Dev**       | `http://localhost:8000`                |

---

#### `INFISICAL_URL`

| Campo        | Valor                                               |
| ------------ | --------------------------------------------------- |
| **Tipo**     | URL                                                 |
| **Default**  | `http://infisical:8080` (self-hosted)               |
| **Usado em** | `InfisicalAdapter` para buscar segredos em produção |

---

#### `INFISICAL_TOKEN`

| Campo          | Valor                                               |
| -------------- | --------------------------------------------------- |
| **Tipo**       | `string`                                            |
| **Como obter** | Infisical → Project → Service Tokens → New Token    |
| **Prod**       | Única variável que pode estar no `.env` de produção |
| **Nota**       | Todas as outras secrets vêm via este token          |

---

#### `INFISICAL_PROJECT_ID`

| Campo          | Valor                                       |
| -------------- | ------------------------------------------- |
| **Tipo**       | `string` (UUID)                             |
| **Como obter** | Infisical → Project → Settings → Project ID |

---

#### `BREVO_API_KEY`

| Campo                  | Valor                                                |
| ---------------------- | ---------------------------------------------------- |
| **Tipo**               | `string`                                             |
| **Propósito**          | Envio de e-mails via Brevo (300/dia free)            |
| **Impacto se ausente** | E-mails não enviados — usar Telegram/WhatsApp apenas |
| **Prod**               | Infisical ref: `secrets/brevo_api_key`               |

---

#### `VERCEL_TOKEN`

| Campo                  | Valor                                              |
| ---------------------- | -------------------------------------------------- |
| **Tipo**               | `string`                                           |
| **Propósito**          | Deploy de sites dos clientes na Vercel             |
| **Impacto se ausente** | Deploy Vercel indisponível — usar Cloudflare Pages |
| **Prod**               | Infisical ref: `secrets/vercel_token`              |

---

#### `CLOUDFLARE_PAGES_TOKEN`

| Campo         | Valor                                                   |
| ------------- | ------------------------------------------------------- |
| **Tipo**      | `string`                                                |
| **Propósito** | Deploy na Cloudflare Pages (fallback primário gratuito) |
| **Prod**      | Infisical ref: `secrets/cloudflare_pages_token`         |

---

#### `RENDER_API_KEY`

| Campo         | Valor                                   |
| ------------- | --------------------------------------- |
| **Tipo**      | `string`                                |
| **Propósito** | Deploy estático no Render (gratuito)    |
| **Prod**      | Infisical ref: `secrets/render_api_key` |

---

#### `HOSTINGER_API_KEY`

| Campo                  | Valor                                               |
| ---------------------- | --------------------------------------------------- |
| **Tipo**               | `string`                                            |
| **Propósito**          | Deploy para clientes que já têm conta Hostinger     |
| **Impacto se ausente** | Opção Hostinger indisponível — usar Vercel/CF Pages |

---

### ⚙️ CONFIGURAÇÃO GERAL

---

#### `API_PORT`

| Campo        | Valor            |
| ------------ | ---------------- |
| **Tipo**     | `number`         |
| **Default**  | `3001`           |
| **Usado em** | Fastify listen() |

---

#### `FRONTEND_URL`

| Campo         | Valor                                                 |
| ------------- | ----------------------------------------------------- |
| **Tipo**      | URL                                                   |
| **Propósito** | CORS origin; links em e-mails e notificações Telegram |
| **Dev**       | `http://localhost:3000`                               |
| **Prod**      | `https://painel.seudominio.com`                       |

---

#### `API_PUBLIC_URL`

| Campo         | Valor                                              |
| ------------- | -------------------------------------------------- |
| **Tipo**      | URL pública                                        |
| **Propósito** | Webhooks de retorno (Evolution, Cal.com, Telegram) |
| **Dev**       | ngrok URL (para receber webhooks localmente)       |
| **Prod**      | `https://api.seudominio.com`                       |

---

#### `LOG_LEVEL`

| Campo       | Valor                                    |
| ----------- | ---------------------------------------- |
| **Tipo**    | `'debug' \| 'info' \| 'warn' \| 'error'` |
| **Default** | `'info'`                                 |
| **Dev**     | `'debug'` para ver todos os logs         |
| **Prod**    | `'info'` — debug seria muito ruidoso     |

---

#### `OPERATOR_NAME`

| Campo         | Valor                                             |
| ------------- | ------------------------------------------------- |
| **Tipo**      | `string`                                          |
| **Propósito** | Nome exibido nas mensagens enviadas pelos agentes |
| **Exemplo**   | `"João Silva — AgênciaPro"`                       |

---

#### `OPERATOR_EMAIL`

| Campo         | Valor                                                   |
| ------------- | ------------------------------------------------------- |
| **Tipo**      | `string` (email válido)                                 |
| **Propósito** | Remetente de e-mails, link de suporte no PDF de entrega |

---

#### `TRANSPARENCIA_API_KEY`

| Campo         | Valor                                                        |
| ------------- | ------------------------------------------------------------ |
| **Tipo**      | `string` (opcional)                                          |
| **Propósito** | API do Portal da Transparência via MCP Brasil                |
| **Default**   | Vazio — 66 outras APIs do MCP Brasil são gratuitas sem chave |

---

## Template `.env.example`

```bash
# ============================================================
# AgentePro v2 — .env.example
# Copie para .env e preencha os valores
# NUNCA commitar .env no git
# ============================================================

# --- OBRIGATÓRIAS ---
NODE_ENV=development
DATABASE_URL=postgresql://agentepro:dev123@localhost:5432/agentepro
REDIS_URL=redis://:dev123@localhost:6379/0
JWT_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----"
JWT_PUBLIC_KEY="-----BEGIN PUBLIC KEY-----\n...\n-----END PUBLIC KEY-----"

# --- LLM APIs ---
ANTHROPIC_API_KEY=sk-ant-...
GEMINI_API_KEY=AI...
OPENAI_API_KEY=sk-...           # Opcional — fallback imagens
GROQ_API_KEY=gsk_...            # Opcional — velocidade

# --- MENSAGERIA ---
EVOLUTION_API_URL=http://localhost:8082
EVOLUTION_API_KEY=your-evolution-key
WPP_INSTANCE=agentepro_dev
TELEGRAM_HITL_BOT_TOKEN=123456:ABC-DEF1234...
TELEGRAM_SALES_BOT_TOKEN=654321:XYZ-ABC5678...
TELEGRAM_OPERATOR_CHAT_ID=123456789
BREVO_API_KEY=xkeysib-...

# --- PROSPECÇÃO ---
GOOGLE_MAPS_API_KEY=AIza...
MCP_BRASIL_URL=http://localhost:8003
TRANSPARENCIA_API_KEY=          # Opcional

# --- SERVIÇOS INTERNOS ---
CHROMA_URL=http://localhost:8001
CHROMA_AUTH_TOKEN=chroma-dev-token
OLLAMA_BASE_URL=http://localhost:11434
N8N_BASE_URL=http://localhost:5678
N8N_API_KEY=your-n8n-api-key
AGENT_RUNTIME_URL=http://localhost:8000

# --- AGENDAMENTO ---
CAL_BASE_URL=http://localhost:3100
CAL_API_KEY=cal_...

# --- GERAÇÃO DE IMAGENS (S2-01 — NanaBanana→DALL-E→Ollama fallback) ---
NANABANANA_API_KEY=...          # Primário (opcional)
# OPENAI_API_KEY já definido acima (DALL-E 3 como fallback)
# OLLAMA_BASE_URL já definido acima (OllamaVision como 3° fallback)

# --- AGENDAMENTO REUNIÕES (S1-06 — Cal.com) ---
CALCOM_API_KEY=...              # Cal.com v2 API (settings hub key = CALCOM_API_KEY)

# --- WEBHOOKS MENSAGERIA (S1-08/09) ---
WHATSAPP_WEBHOOK_SECRET=...     # X-Evolution-Secret-Token do Evolution API
TELEGRAM_SALES_WEBHOOK_SECRET=...  # Bot de sales separado do bot HITL

# --- DEPLOY DE SITES (S2-05 — Vercel→CF Pages→Render) ---
VERCEL_TOKEN=...
CLOUDFLARE_PAGES_TOKEN=...
CLOUDFLARE_ACCOUNT_ID=...       # Required para CF Pages Direct Upload API
RENDER_API_KEY=...
RENDER_DEPLOY_HOOK=https://api.render.com/deploy/...  # Hook do service específico
HOSTINGER_API_KEY=              # Opcional

# --- ENTREGA (S2-02 — HeyGen) ---
HEYGEN_API_KEY=...              # Opcional — tutorial em vídeo para o cliente
HEYGEN_AVATAR_ID=...            # Default: avatar pt-BR do HeyGen

# --- SECRETS (PROD) ---
INFISICAL_URL=http://localhost:8004
INFISICAL_TOKEN=               # Prod: única var externa ao Infisical
INFISICAL_PROJECT_ID=

# --- APP ---
API_PORT=3001
FRONTEND_URL=http://localhost:3000
API_PUBLIC_URL=http://localhost:3001  # Dev: usar ngrok para webhooks
LOG_LEVEL=debug
OPERATOR_NAME="Seu Nome — Sua Agência"
OPERATOR_EMAIL=voce@email.com
```
