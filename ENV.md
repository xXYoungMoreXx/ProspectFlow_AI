# ENV.md â€” ReferÃªncia Completa de VariÃ¡veis de Ambiente

> Toda variÃ¡vel deve estar documentada aqui.
> O app NÃƒO sobe se uma variÃ¡vel obrigatÃ³ria estiver ausente (fail fast via Zod).
> VersÃ£o: 2.0.0 | Atualizado: 2026-05-29

---

## Como Funciona o Carregamento

```typescript
// infrastructure/config/env.ts â€” validado no startup

import { z } from "zod";

const EnvSchema = z
  .object({
    // ObrigatÃ³rias â€” app crasha se ausentes
    NODE_ENV: z.enum(["development", "test", "production"]),
    DATABASE_URL: z.string().url(),
    REDIS_URL: z.string().url(),
    JWT_PRIVATE_KEY: z.string().min(100), // RS256 private key PEM
    JWT_PUBLIC_KEY: z.string().min(100), // RS256 public key PEM

    // Opcionais com defaults
    API_PORT: z.coerce.number().default(3001),
    LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
  })
  .passthrough(); // Permite variÃ¡veis extras sem rejeitar

export const env = EnvSchema.parse(process.env);
// Se invÃ¡lido â†’ z.ZodError detalhado â†’ processo termina com exit(1)
```

---

## CatÃ¡logo Completo

### ðŸ”´ CRÃTICAS â€” App nÃ£o sobe sem elas

---

#### `NODE_ENV`

| Campo                  | Valor                                                             |
| ---------------------- | ----------------------------------------------------------------- |
| **Tipo**               | `'development' \| 'test' \| 'production'`                         |
| **Default**            | Nenhum â€” obrigatÃ³rio                                           |
| **Impacto se ausente** | Crash no startup                                                  |
| **Usado em**           | Logger (nÃ­vel), Error handler (expor stack ou nÃ£o), Cache (TTL) |
| **Dev**                | `development`                                                     |
| **Prod**               | `production`                                                      |

---

#### `DATABASE_URL`

| Campo                  | Valor                                                                  |
| ---------------------- | ---------------------------------------------------------------------- |
| **Tipo**               | PostgreSQL connection string                                           |
| **Formato**            | `postgresql://user:password@host:port/database?sslmode=require`        |
| **ValidaÃ§Ã£o**        | Zod URL + ping na inicializaÃ§Ã£o (SELECT 1)                           |
| **Impacto se ausente** | Crash no startup                                                       |
| **Usado em**           | DrizzleORM, BullMQ (para persistÃªncia de jobs)                        |
| **Dev**                | `postgresql://hefesto:dev123@localhost:5432/hefesto`                   |
| **Prod**               | `postgresql://hefesto:${SECRET}@postgres:5432/hefesto?sslmode=require` |
| **Nota**               | Em produÃ§Ã£o SEMPRE com `?sslmode=require`                            |

---

#### `REDIS_URL`

| Campo                  | Valor                                                               |
| ---------------------- | ------------------------------------------------------------------- |
| **Tipo**               | Redis connection string                                             |
| **Formato**            | `redis://:password@host:port/db`                                    |
| **ValidaÃ§Ã£o**        | Zod URL + PING na inicializaÃ§Ã£o                                   |
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
| **Prod**               | Infisical Vault â€” ref: `secrets/jwt_private_key`                    |
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

### ðŸŸ¡ IMPORTANTES â€” Features crÃ­ticas indisponÃ­veis sem elas

---

#### `ANTHROPIC_API_KEY`

| Campo                    | Valor                                                                                  |
| ------------------------ | -------------------------------------------------------------------------------------- |
| **Tipo**                 | `string` (comeÃ§a com `sk-ant-`)                                                       |
| **Regex de validaÃ§Ã£o** | `/^sk-ant-/`                                                                           |
| **Impacto se ausente**   | Agentes CLOSER, BUILDER, QA, DELIVERY indisponÃ­veis                                   |
| **Modelos usados**       | `claude-opus-4-8`, `claude-opus-4-7`, `claude-sonnet-4-6`, `claude-haiku-4-5-20251001` |
| **Tier relevante**       | Tier 2, 3, 4a, 4b do LLM routing                                                       |
| **Cost alert**           | Configurar billing alert em $50 na Anthropic Console                                   |
| **Prod**                 | Infisical ref: `secrets/anthropic_key`                                                 |

---

#### `GEMINI_API_KEY`

| Campo                  | Valor                                                                         |
| ---------------------- | ----------------------------------------------------------------------------- |
| **Tipo**               | `string`                                                                      |
| **Impacto se ausente** | PROSPECTOR (Hunter) usa SearXNG apenas; Nano Banana Pro indisponÃ­vel         |
| **Modelos usados**     | `gemini/gemini-3.5-flash`, `gemini/gemini-3.1-pro`, `imagen-3.0-generate-001` |
| **Tier relevante**     | Tier 1 (prospecÃ§Ã£o) e Tier 5 (imagens)                                      |
| **Quota**              | Gemini Flash: 1M tokens/dia free; Imagen: pay-per-use                         |
| **Prod**               | Infisical ref: `secrets/gemini_key`                                           |

---

#### `GOOGLE_MAPS_API_KEY`

| Campo                  | Valor                                                          |
| ---------------------- | -------------------------------------------------------------- |
| **Tipo**               | `string`                                                       |
| **Impacto se ausente** | Hunter usa SearXNG apenas â€” prospecÃ§Ã£o 80% menos eficiente |
| **Quota free**         | 2.500 requisiÃ§Ãµes/dia (Places API New)                       |
| **Cache**              | 24h por busca (categoria + regiÃ£o) â€” minimiza consumo       |
| **Alert**              | Alertar quando remaining < 200                                 |
| **RestriÃ§Ã£o**        | Restringir a IP do VPS no Google Cloud Console                 |
| **Prod**               | Infisical ref: `secrets/google_maps_key`                       |

---

#### `EVOLUTION_API_URL`

| Campo                  | Valor                                                     |
| ---------------------- | --------------------------------------------------------- |
| **Tipo**               | URL interna do Docker                                     |
| **Formato**            | `http://evolution-api:8082`                               |
| **Impacto se ausente** | WhatsApp indisponÃ­vel â€” usar Telegram/Email como canal |
| **Dev**                | `http://localhost:8082`                                   |
| **Prod**               | `http://evolution-api:8082` (interno Docker)              |

---

#### `EVOLUTION_API_KEY`

| Campo                  | Valor                                                 |
| ---------------------- | ----------------------------------------------------- |
| **Tipo**               | `string` â€” chave de autenticaÃ§Ã£o da Evolution API |
| **GeraÃ§Ã£o**          | Definido no docker-compose ao subir a Evolution       |
| **Impacto se ausente** | Evolution API rejeita todos os requests com 401       |
| **Prod**               | Infisical ref: `secrets/evolution_api_key`            |

---

#### `WPP_INSTANCE`

| Campo        | Valor                                                                     |
| ------------ | ------------------------------------------------------------------------- |
| **Tipo**     | `string` â€” nome da instÃ¢ncia WhatsApp                                  |
| **Exemplo**  | `hefesto_prod`                                                            |
| **Usado em** | Todos os endpoints da Evolution API (`/message/sendText/${WPP_INSTANCE}`) |

---

#### `TELEGRAM_HITL_BOT_TOKEN`

| Campo                  | Valor                                                            |
| ---------------------- | ---------------------------------------------------------------- |
| **Tipo**               | `string` (formato `123456:ABC-DEF1234...`)                       |
| **PropÃ³sito**         | Bot 1 â€” notificaÃ§Ãµes HITL com botÃµes inline para o operador |
| **Como criar**         | Conversar com @BotFather no Telegram                             |
| **Impacto se ausente** | HITL via e-mail apenas (sem aprovaÃ§Ã£o inline)                  |
| **Prod**               | Infisical ref: `secrets/telegram_hitl_bot_token`                 |

---

#### `TELEGRAM_SALES_BOT_TOKEN`

| Campo                  | Valor                                             |
| ---------------------- | ------------------------------------------------- |
| **Tipo**               | `string`                                          |
| **PropÃ³sito**         | Bot 2 â€” canal de vendas com leads via Telegram  |
| **Impacto se ausente** | Canal Telegram para leads indisponÃ­vel           |
| **Prod**               | Infisical ref: `secrets/telegram_sales_bot_token` |

---

#### `TELEGRAM_CHAT_ID`

| Campo                  | Valor                                                            |
| ---------------------- | ---------------------------------------------------------------- |
| **Tipo**               | `string` (ID numÃ©rico do chat do operador)                      |
| **Como obter**         | Enviar `/start` para o Bot HITL e verificar o chat_id no webhook |
| **Impacto se ausente** | Bot HITL nÃ£o sabe para onde enviar notificaÃ§Ãµes               |
| **Alternativa**        | `TELEGRAM_OPERATOR_GROUP_ID` para grupos de operadores           |

---

### ðŸŸ¢ OPCIONAIS â€” Features especÃ­ficas

---

#### `OPENAI_API_KEY`

| Campo                  | Valor                                                          |
| ---------------------- | -------------------------------------------------------------- |
| **Tipo**               | `string` (comeÃ§a com `sk-`)                                   |
| **PropÃ³sito**         | DALL-E 3 como fallback de imagens quando Nano Banana Pro falha |
| **Impacto se ausente** | Fallback de imagens vai para Ollama (qualidade menor)          |
| **Modelos usados**     | `dall-e-3` apenas                                              |
| **Prod**               | Infisical ref: `secrets/openai_key`                            |

---

#### `GROQ_API_KEY`

| Campo                  | Valor                                                          |
| ---------------------- | -------------------------------------------------------------- |
| **Tipo**               | `string`                                                       |
| **PropÃ³sito**         | Llama 3.3 70B via Groq para velocidade mÃ¡xima em prospecÃ§Ã£o |
| **Impacto se ausente** | Groq nÃ£o disponÃ­vel â€” LiteLLM usa Gemini Flash             |
| **Prod**               | Infisical ref: `secrets/groq_key`                              |

---

#### `OLLAMA_BASE_URL`

| Campo                  | Valor                                                                  |
| ---------------------- | ---------------------------------------------------------------------- |
| **Tipo**               | URL                                                                    |
| **Default**            | `http://ollama:11434`                                                  |
| **Impacto se ausente** | Tier 0 (roteamento gratuito) indisponÃ­vel â€” usa Haiku como fallback |
| **Dev**                | `http://localhost:11434`                                               |
| **Modelos esperados**  | `llama3.2:3b`, `nomic-embed-text`, `llava`                             |

---

#### `HEYGEN_API_KEY`

| Campo                  | Valor                                                         |
| ---------------------- | ------------------------------------------------------------- |
| **Tipo**               | `string`                                                      |
| **PropÃ³sito**         | GeraÃ§Ã£o de tutoriais em vÃ­deo na entrega                   |
| **Impacto se ausente** | Tutorial em vÃ­deo omitido â€” PDF de entrega ainda Ã© gerado |
| **Cost**               | ~$0.50 por vÃ­deo de 2 min                                    |
| **Prod**               | Infisical ref: `secrets/heygen_key`                           |

---

#### `HEYGEN_AVATAR_ID`

| Campo          | Valor                                                 |
| -------------- | ----------------------------------------------------- |
| **Tipo**       | `string` â€” ID do avatar configurado na conta HeyGen |
| **Como obter** | Acessar HeyGen â†’ Avatars â†’ copiar ID              |
| **Default**    | Se ausente, usar avatar padrÃ£o da conta              |

---

#### `CAL_BASE_URL`

| Campo          | Valor                                                 |
| -------------- | ----------------------------------------------------- |
| **Tipo**       | URL                                                   |
| **Default**    | `http://cal-com:3000` (self-hosted)                   |
| **PropÃ³sito** | API do Cal.com para criaÃ§Ã£o de links de agendamento |
| **Dev**        | `http://localhost:3100`                               |

---

#### `CAL_API_KEY`

| Campo                  | Valor                                                             |
| ---------------------- | ----------------------------------------------------------------- |
| **Tipo**               | `string`                                                          |
| **Como obter**         | Cal.com â†’ Settings â†’ API Keys â†’ New Key                     |
| **Impacto se ausente** | Agendamento indisponÃ­vel â€” Closer nÃ£o envia links de reuniÃ£o |

---

#### `MCP_BRASIL_URL`

| Campo                  | Valor                                                             |
| ---------------------- | ----------------------------------------------------------------- |
| **Tipo**               | URL                                                               |
| **Default**            | `http://mcp-brasil:8000`                                          |
| **PropÃ³sito**         | API do MCP Brasil para consulta de CNPJ/CEP                       |
| **Dev**                | `http://localhost:8003`                                           |
| **Impacto se ausente** | Enriquecimento de CNPJ indisponÃ­vel â€” score sem bÃ´nus de CNPJ |

---

#### `CHROMA_URL`

| Campo          | Valor                         |
| -------------- | ----------------------------- |
| **Tipo**       | URL                           |
| **Default**    | `http://chromadb:8000`        |
| **PropÃ³sito** | ChromaDB para RAG dos agentes |
| **Dev**        | `http://localhost:8001`       |

---

#### `CHROMA_AUTH_TOKEN`

| Campo          | Valor                                      |
| -------------- | ------------------------------------------ |
| **Tipo**       | `string`                                   |
| **PropÃ³sito** | AutenticaÃ§Ã£o no ChromaDB                 |
| **Prod**       | Infisical ref: `secrets/chroma_auth_token` |

---

#### `N8N_BASE_URL`

| Campo          | Valor                               |
| -------------- | ----------------------------------- |
| **Tipo**       | URL                                 |
| **Default**    | `http://n8n:5678`                   |
| **PropÃ³sito** | Trigger de workflows via API do n8n |

---

#### `N8N_API_KEY`

| Campo          | Valor                                       |
| -------------- | ------------------------------------------- |
| **Tipo**       | `string`                                    |
| **Como obter** | n8n â†’ Settings â†’ API â†’ Create API Key |
| **Prod**       | Infisical ref: `secrets/n8n_api_key`        |

---

#### `AGENT_RUNTIME_URL`

| Campo          | Valor                                  |
| -------------- | -------------------------------------- |
| **Tipo**       | URL                                    |
| **Default**    | `http://agent-runtime:8000`            |
| **PropÃ³sito** | API interna do runtime Python (CrewAI) |
| **Dev**        | `http://localhost:8000`                |

---

#### `INFISICAL_URL`

| Campo        | Valor                                                 |
| ------------ | ----------------------------------------------------- |
| **Tipo**     | URL                                                   |
| **Default**  | `http://infisical:8080` (self-hosted)                 |
| **Usado em** | `InfisicalAdapter` para buscar segredos em produÃ§Ã£o |

---

#### `INFISICAL_TOKEN`

| Campo          | Valor                                                   |
| -------------- | ------------------------------------------------------- |
| **Tipo**       | `string`                                                |
| **Como obter** | Infisical â†’ Project â†’ Service Tokens â†’ New Token  |
| **Prod**       | Ãšnica variÃ¡vel que pode estar no `.env` de produÃ§Ã£o |
| **Nota**       | Todas as outras secrets vÃªm via este token             |

---

#### `INFISICAL_PROJECT_ID`

| Campo          | Valor                                             |
| -------------- | ------------------------------------------------- |
| **Tipo**       | `string` (UUID)                                   |
| **Como obter** | Infisical â†’ Project â†’ Settings â†’ Project ID |

---

#### `BREVO_API_KEY`

| Campo                  | Valor                                                   |
| ---------------------- | ------------------------------------------------------- |
| **Tipo**               | `string`                                                |
| **PropÃ³sito**         | Envio de e-mails via Brevo (300/dia free)               |
| **Impacto se ausente** | E-mails nÃ£o enviados â€” usar Telegram/WhatsApp apenas |
| **Prod**               | Infisical ref: `secrets/brevo_api_key`                  |

---

#### `VERCEL_TOKEN`

| Campo                  | Valor                                                 |
| ---------------------- | ----------------------------------------------------- |
| **Tipo**               | `string`                                              |
| **PropÃ³sito**         | Deploy de sites dos clientes na Vercel                |
| **Impacto se ausente** | Deploy Vercel indisponÃ­vel â€” usar Cloudflare Pages |
| **Prod**               | Infisical ref: `secrets/vercel_token`                 |

---

#### `CLOUDFLARE_PAGES_TOKEN`

| Campo          | Valor                                                    |
| -------------- | -------------------------------------------------------- |
| **Tipo**       | `string`                                                 |
| **PropÃ³sito** | Deploy na Cloudflare Pages (fallback primÃ¡rio gratuito) |
| **Prod**       | Infisical ref: `secrets/cloudflare_pages_token`          |

---

#### `RENDER_API_KEY`

| Campo          | Valor                                   |
| -------------- | --------------------------------------- |
| **Tipo**       | `string`                                |
| **PropÃ³sito** | Deploy estÃ¡tico no Render (gratuito)   |
| **Prod**       | Infisical ref: `secrets/render_api_key` |

---

#### `HOSTINGER_API_KEY`

| Campo                  | Valor                                                    |
| ---------------------- | -------------------------------------------------------- |
| **Tipo**               | `string`                                                 |
| **PropÃ³sito**         | Deploy para clientes que jÃ¡ tÃªm conta Hostinger        |
| **Impacto se ausente** | OpÃ§Ã£o Hostinger indisponÃ­vel â€” usar Vercel/CF Pages |

---

### âš™ï¸ CONFIGURAÃ‡ÃƒO GERAL

---

#### `API_PORT`

| Campo        | Valor            |
| ------------ | ---------------- |
| **Tipo**     | `number`         |
| **Default**  | `3001`           |
| **Usado em** | Fastify listen() |

---

#### `FRONTEND_URL`

| Campo          | Valor                                                   |
| -------------- | ------------------------------------------------------- |
| **Tipo**       | URL                                                     |
| **PropÃ³sito** | CORS origin; links em e-mails e notificaÃ§Ãµes Telegram |
| **Dev**        | `http://localhost:3000`                                 |
| **Prod**       | `https://painel.seudominio.com`                         |

---

#### `API_PUBLIC_URL`

| Campo          | Valor                                              |
| -------------- | -------------------------------------------------- |
| **Tipo**       | URL pÃºblica                                       |
| **PropÃ³sito** | Webhooks de retorno (Evolution, Cal.com, Telegram) |
| **Dev**        | ngrok URL (para receber webhooks localmente)       |
| **Prod**       | `https://api.seudominio.com`                       |

---

#### `LOG_LEVEL`

| Campo       | Valor                                    |
| ----------- | ---------------------------------------- |
| **Tipo**    | `'debug' \| 'info' \| 'warn' \| 'error'` |
| **Default** | `'info'`                                 |
| **Dev**     | `'debug'` para ver todos os logs         |
| **Prod**    | `'info'` â€” debug seria muito ruidoso   |

---

#### `OPERATOR_NAME`

| Campo          | Valor                                             |
| -------------- | ------------------------------------------------- |
| **Tipo**       | `string`                                          |
| **PropÃ³sito** | Nome exibido nas mensagens enviadas pelos agentes |
| **Exemplo**    | `"JoÃ£o Silva â€” AgÃªnciaPro"`                   |

---

#### `OPERATOR_EMAIL`

| Campo          | Valor                                                   |
| -------------- | ------------------------------------------------------- |
| **Tipo**       | `string` (email vÃ¡lido)                                |
| **PropÃ³sito** | Remetente de e-mails, link de suporte no PDF de entrega |

---

#### `TRANSPARENCIA_API_KEY`

| Campo          | Valor                                                           |
| -------------- | --------------------------------------------------------------- |
| **Tipo**       | `string` (opcional)                                             |
| **PropÃ³sito** | API do Portal da TransparÃªncia via MCP Brasil                  |
| **Default**    | Vazio â€” 66 outras APIs do MCP Brasil sÃ£o gratuitas sem chave |

---

## Template `.env.example`

```bash
# ============================================================
# Hefesto v2 â€” .env.example
# Copie para .env e preencha os valores
# NUNCA commitar .env no git
# ============================================================

# --- OBRIGATÃ“RIAS ---
NODE_ENV=development
DATABASE_URL=postgresql://hefesto:dev123@localhost:5432/hefesto
REDIS_URL=redis://:dev123@localhost:6379/0
JWT_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----"
JWT_PUBLIC_KEY="-----BEGIN PUBLIC KEY-----\n...\n-----END PUBLIC KEY-----"

# --- LLM APIs ---
ANTHROPIC_API_KEY=sk-ant-...
GEMINI_API_KEY=AI...
OPENAI_API_KEY=sk-...           # Opcional â€” fallback imagens
GROQ_API_KEY=gsk_...            # Opcional â€” velocidade

# --- MENSAGERIA ---
EVOLUTION_API_URL=http://localhost:8082
EVOLUTION_API_KEY=your-evolution-key
WPP_INSTANCE=hefesto_dev
TELEGRAM_HITL_BOT_TOKEN=123456:ABC-DEF1234...
TELEGRAM_SALES_BOT_TOKEN=654321:XYZ-ABC5678...
TELEGRAM_CHAT_ID=123456789
BREVO_API_KEY=xkeysib-...

# --- PROSPECÃ‡ÃƒO ---
GOOGLE_MAPS_API_KEY=AIza...
MCP_BRASIL_URL=http://localhost:8003
TRANSPARENCIA_API_KEY=          # Opcional

# --- SERVIÃ‡OS INTERNOS ---
CHROMA_URL=http://localhost:8001
CHROMA_AUTH_TOKEN=chroma-dev-token
OLLAMA_BASE_URL=http://localhost:11434
N8N_BASE_URL=http://localhost:5678
N8N_API_KEY=your-n8n-api-key
AGENT_RUNTIME_URL=http://localhost:8000

# --- AGENDAMENTO ---
CAL_BASE_URL=http://localhost:3100
CAL_API_KEY=cal_...

# --- GERAÃ‡ÃƒO DE IMAGENS (S2-01 â€” NanaBananaâ†’DALL-Eâ†’Ollama fallback) ---
NANABANANA_API_KEY=...          # PrimÃ¡rio (opcional)
# OPENAI_API_KEY jÃ¡ definido acima (DALL-E 3 como fallback)
# OLLAMA_BASE_URL jÃ¡ definido acima (OllamaVision como 3Â° fallback)

# --- AGENDAMENTO REUNIÃ•ES (S1-06 â€” Cal.com) ---
CALCOM_API_KEY=...              # Cal.com v2 API (settings hub key = CALCOM_API_KEY)

# --- WEBHOOKS MENSAGERIA (S1-08/09) ---
WHATSAPP_WEBHOOK_SECRET=...     # X-Evolution-Secret-Token do Evolution API
TELEGRAM_SALES_WEBHOOK_SECRET=...  # Bot de sales separado do bot HITL

# --- DEPLOY DE SITES (S2-05 â€” Vercelâ†’CF Pagesâ†’Render) ---
VERCEL_TOKEN=...
CLOUDFLARE_PAGES_TOKEN=...
CLOUDFLARE_ACCOUNT_ID=...       # Required para CF Pages Direct Upload API
RENDER_API_KEY=...
RENDER_DEPLOY_HOOK=https://api.render.com/deploy/...  # Hook do service especÃ­fico
HOSTINGER_API_KEY=              # Opcional

# --- ENTREGA (S2-02 â€” HeyGen) ---
HEYGEN_API_KEY=...              # Opcional â€” tutorial em vÃ­deo para o cliente
HEYGEN_AVATAR_ID=...            # Default: avatar pt-BR do HeyGen

# --- SECRETS (PROD) ---
INFISICAL_URL=http://localhost:8004
INFISICAL_TOKEN=               # Prod: Ãºnica var externa ao Infisical
INFISICAL_PROJECT_ID=

# --- APP ---
API_PORT=3001
FRONTEND_URL=http://localhost:3000
API_PUBLIC_URL=http://localhost:3001  # Dev: usar ngrok para webhooks
LOG_LEVEL=debug
OPERATOR_NAME="Seu Nome â€” Sua AgÃªncia"
OPERATOR_EMAIL=voce@email.com
```

## Internal bridge + deploy real (2026-06-12)

Adicionados na correcao B1/B2/B5 do pipeline E2E:

```bash
# Node (apps/api) â€” secret das rotas /api/v1/internal/* (messages + heygen)
INTERNAL_API_TOKEN=<random-64-hex>

# Python (apps/agent-runtime/.env) â€” DEVE ser identico ao INTERNAL_API_TOKEN
API_TOKEN=<mesmo valor>
API_URL=http://localhost:3001

# Hunter (places_search.py le via os.getenv no processo do runtime)
GOOGLE_MAPS_API_KEY=

# Deploy fallback chain (Vercel -> CF Pages -> Render -> Netlify)
VERCEL_TOKEN=                 # primario â€” deploy REAL via API v13
CF_ACCOUNT_ID=                # CF Pages: desabilitado ate upload flow (err honesto)
CF_API_TOKEN=
NETLIFY_TOKEN=                # deploy REAL via file-digest API
RENDER_API_KEY=

# QA Lighthouse (PageSpeed Insights v5)
PAGESPEED_API_KEY=
```
