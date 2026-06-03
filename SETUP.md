# Guia Completo de Configuração — AgentePro

> Leia este arquivo antes do README. Aqui você encontra instruções passo a passo
> para configurar **tudo** que o sistema precisa para funcionar, incluindo as
> integrações externas opcionais.

---

## O que você vai precisar

| O que                                    | Por que                                 | Obrigatório?        |
| ---------------------------------------- | --------------------------------------- | ------------------- |
| Conta na Anthropic, OpenAI **ou** Google | O sistema usa IA para operar            | ✅ Sim (ao menos 1) |
| Docker Desktop                           | Banco de dados, Redis e outros serviços | ✅ Sim              |
| Node.js 22                               | Rodar a API e o painel web              | ✅ Sim              |
| Python 3.12                              | Rodar os agentes de IA                  | ✅ Sim              |
| Conta Telegram                           | Receber aprovações e alertas            | ⚡ Recomendado      |
| Número WhatsApp (via Evolution API)      | Canal de contato com leads              | 🔵 Opcional         |
| Conta Google Cloud                       | Prospectar via Google Maps              | 🔵 Opcional         |

---

## Passo 1 — Clonar e instalar

```bash
git clone <url-do-repositorio>
cd ProspectFlow_AI
npm install
```

---

## Passo 2 — Criar seu arquivo `.env`

```bash
# Windows (PowerShell)
Copy-Item .env.example .env

# Linux / macOS
cp .env.example .env
```

Abra o `.env` em qualquer editor de texto e preencha as seções abaixo.

---

## Passo 3 — Gerar as chaves JWT (segurança da API)

As chaves JWT protegem o login dos operadores. Gere-as uma vez.

### Windows (Git Bash ou WSL)

```bash
openssl genpkey -algorithm RSA -out jwt.key -pkeyopt rsa_keygen_bits:2048
openssl rsa -in jwt.key -pubout -out jwt.pub
cat jwt.key   # copie o resultado
cat jwt.pub   # copie o resultado
```

> **Não tem openssl?** Instale o Git for Windows em https://gitforwindows.org — ele inclui o openssl.

### Linux / macOS

```bash
openssl genpkey -algorithm RSA -out jwt.key -pkeyopt rsa_keygen_bits:2048
openssl rsa -in jwt.key -pubout -out jwt.pub
cat jwt.key && cat jwt.pub
```

**Como colocar no `.env`:** Copie o conteúdo completo de cada chave (incluindo `-----BEGIN...-----` e `-----END...-----`) e substitua quebras de linha por `\n`:

```dotenv
JWT_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvgIBADA...\n-----END PRIVATE KEY-----"
JWT_PUBLIC_KEY="-----BEGIN PUBLIC KEY-----\nMIIBIjANBg...\n-----END PUBLIC KEY-----"
```

> ⚠️ Guarde os arquivos `jwt.key` e `jwt.pub` em local seguro. Não os commite no git (já estão no `.gitignore`).

---

## Passo 4 — Configurar pelo menos 1 provedor de IA (obrigatório)

### Opção A — Anthropic Claude (recomendado)

1. Acesse https://console.anthropic.com → crie conta
2. Vá em **API Keys** → **Create Key**
3. Copie a chave (começa com `sk-ant-`)

```dotenv
ANTHROPIC_API_KEY=sk-ant-api03-xxxxxxxxxxxx
```

### Opção B — OpenAI GPT

1. Acesse https://platform.openai.com → crie conta
2. Vá em **API Keys** → **Create new secret key**
3. Copie a chave (começa com `sk-`)

```dotenv
OPENAI_API_KEY=sk-xxxxxxxxxxxxxxxx
```

### Opção C — Google Gemini

1. Acesse https://aistudio.google.com → crie conta
2. Clique em **Get API key** → **Create API key**
3. Copie a chave (começa com `AIza`)

```dotenv
GEMINI_API_KEY=AIzaSyxxxxxxxxxxxxxxx
```

> Você pode configurar múltiplos provedores. O sistema escolhe automaticamente o modelo certo para cada sub-agente.

---

## Passo 5 — Verificar e iniciar

```bash
# Verificar pré-requisitos (sem iniciar nada)
npm run check

# Se tudo der [✔], iniciar o sistema:
npm run init
```

Quando aparecer `💻  Web Dashboard → http://localhost:3000`, está pronto!

---

## Integrações opcionais

### Telegram — Aprovações pelo celular (altamente recomendado)

O Telegram é o canal de controle do operador. Você recebe notificações e aprova ações dos agentes com um toque.

**Criar o bot:**

1. Abra o Telegram → pesquise `@BotFather`
2. Envie `/newbot`
3. Escolha um nome e username para o bot (username deve terminar em `bot`)
4. O BotFather envia o **token**: `1234567890:ABCDefgh...`

```dotenv
TELEGRAM_BOT_TOKEN=1234567890:ABCDefghijklmnopqrstuvwxyz
```

**Obter seu Chat ID:**

1. Inicie uma conversa com seu bot no Telegram
2. Acesse no navegador: `https://api.telegram.org/bot<SEU_TOKEN>/getUpdates`
3. Copie o valor de `chat.id` da resposta

```dotenv
TELEGRAM_OPERATOR_CHAT_ID=123456789
```

---

### WhatsApp via Evolution API

O Evolution API conecta o AgentePro a um número de WhatsApp real.

O Evolution API já está incluído no Docker Compose. Após `npm run init`, acesse:

```
http://localhost:8080
```

1. Crie uma instância com o nome `agentepro`
2. Clique em **Connect** → aparece um QR Code
3. No WhatsApp do celular: **Configurações → Dispositivos Conectados → Conectar dispositivo**
4. Escaneie o QR Code

```dotenv
EVOLUTION_API_URL=http://localhost:8080
EVOLUTION_API_KEY=sua-chave-do-painel-evolution
EVOLUTION_INSTANCE_NAME=agentepro
```

> A chave de API aparece nas configurações do painel Evolution API.

---

### Google Maps — Prospecção automática de leads

Encontra negócios na sua cidade que não têm site.

1. Acesse https://console.cloud.google.com → crie projeto
2. **APIs & Services** → **Library** → ative **Places API (New)**
3. **Credentials** → **Create Credentials** → **API Key**

```dotenv
GOOGLE_MAPS_API_KEY=AIzaSyxxxxxxxxxxxxxxx
```

> Google Maps tem cota gratuita de ~$200/mês — para prospecção moderada o custo é zero.

---

### Cal.com — Agendamento de reuniões

Permite que o Closer ofereça horários de reunião ao lead diretamente.

1. Crie conta em https://cal.com
2. Configure um tipo de evento (ex: "Demo — 30 minutos")
3. **Settings** → **Developer** → **API Keys** → **Add**

```dotenv
CALCOM_API_KEY=cal_live_xxxxxxxxxxxx
CALCOM_DEFAULT_EVENT_SLUG=demo-30min
```

> O slug é o identificador da URL do evento (ex: para `cal.com/usuario/demo-30min`, o slug é `demo-30min`).

---

### HeyGen — Tutoriais em vídeo para clientes

Gera um vídeo tutorial personalizado quando o site é entregue.

1. Crie conta em https://www.heygen.com
2. **Settings** → **API** → **Generate API Token**
3. Note o **Avatar ID** do avatar que vai usar

```dotenv
HEYGEN_API_KEY=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
HEYGEN_AVATAR_ID=seu-avatar-id
```

---

### Criptografia de credenciais (altamente recomendado)

Criptografa as chaves de API salvas pelo painel web no banco de dados.

```bash
# Gerar chave AES-256:
node -e "console.log(require('node:crypto').randomBytes(32).toString('base64'))"
```

```dotenv
SETTINGS_ENCRYPTION_KEY=base64_da_chave_aqui
```

---

## GitHub Actions — Secrets para E2E em CI

Adicione em: **GitHub → Settings → Secrets → Actions → New repository secret**

| Secret               | Valor                                  |
| -------------------- | -------------------------------------- |
| `CI_JWT_PRIVATE_KEY` | Conteúdo completo do arquivo `jwt.key` |
| `CI_JWT_PUBLIC_KEY`  | Conteúdo completo do arquivo `jwt.pub` |

---

## Referência rápida do `.env`

```dotenv
# ── Obrigatórias ──────────────────────────────────────────────────────
PORT=3001
HOST=0.0.0.0
NODE_ENV=development
DATABASE_URL=postgresql://agentepro:agentepro_dev@localhost:5432/agentepro
REDIS_URL=redis://localhost:6379
JWT_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"
JWT_PUBLIC_KEY="-----BEGIN PUBLIC KEY-----\n...\n-----END PUBLIC KEY-----"
AGENT_RUNTIME_URL=http://localhost:8001

# ── Pelo menos 1 LLM ─────────────────────────────────────────────────
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
GEMINI_API_KEY=AIza...

# ── Telegram ──────────────────────────────────────────────────────────
TELEGRAM_BOT_TOKEN=
TELEGRAM_OPERATOR_CHAT_ID=

# ── WhatsApp ──────────────────────────────────────────────────────────
EVOLUTION_API_URL=http://localhost:8080
EVOLUTION_API_KEY=
EVOLUTION_INSTANCE_NAME=agentepro

# ── Google Maps ───────────────────────────────────────────────────────
GOOGLE_MAPS_API_KEY=

# ── Cal.com ───────────────────────────────────────────────────────────
CALCOM_API_KEY=
CALCOM_DEFAULT_EVENT_SLUG=demo-30min

# ── HeyGen ───────────────────────────────────────────────────────────
HEYGEN_API_KEY=
HEYGEN_AVATAR_ID=

# ── Segurança ─────────────────────────────────────────────────────────
SETTINGS_ENCRYPTION_KEY=
```

---

## Solução de problemas

| Erro                              | Causa provável         | Solução                                                            |
| --------------------------------- | ---------------------- | ------------------------------------------------------------------ |
| "Docker não está rodando"         | Docker Desktop fechado | Abra o Docker Desktop e aguarde o ícone verde                      |
| "JWT_PRIVATE_KEY inválida"        | Chave mal formatada    | Verifique se copiou o texto completo com `\n`                      |
| "PostgreSQL não respondeu em 60s" | Porta 5432 em uso      | `docker logs agentepro-postgres` para detalhes                     |
| "Nenhum LLM configurado"          | Chave não preenchida   | Preencha `ANTHROPIC_API_KEY`, `OPENAI_API_KEY` ou `GEMINI_API_KEY` |
| Agentes não enviam WhatsApp       | Sessão expirada        | Reescaneie o QR Code em `http://localhost:8080`                    |
| E2E falha no GitHub               | Secrets ausentes       | Adicione `CI_JWT_PRIVATE_KEY` e `CI_JWT_PUBLIC_KEY` no GitHub      |

---

## Próximos passos

1. `npm run check` — confirme que tudo está OK
2. `npm run init` — inicie o sistema
3. Acesse http://localhost:3000 e crie sua conta de operador
4. Configure os agentes em **Agentes** → escolha modelos e regras
5. Em **Prospecting** → configure categoria e região para o Hunter
6. Aguarde os primeiros leads e aprove pelo Telegram
