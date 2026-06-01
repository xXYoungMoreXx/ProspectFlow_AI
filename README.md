# AgentePro (ex-ProspectFlow AI) 🚀

> **Status:** 4 sprints concluídas (S0–S3). MVP funcional em localhost. CD desativado — deploy via `docker compose` por enquanto.
> **Branch de integração:** `develop` → `main` via PR com CI obrigatório.

> **"E se o seu melhor vendedor nunca dormisse, falasse todos os idiomas e qualificasse mil leads antes do seu café da manhã?"** ☕🤖

O **AgentePro** nasceu de uma dor real: o "grind" insuportável da prospecção manual. Enquanto times comerciais perdiam horas filtrando planilhas, nós decidimos construir um ecossistema onde a Inteligência Artificial não apenas ajuda, mas **lidera** o processo.

Abaixo, você encontrará a jornada de como transformamos esse desafio em uma plataforma _Event-Driven_ de ultra-alta performance.

---

## 🏛️ Manifesto: Por que o AgentePro?

Vender é humano, mas prospectar é, muitas vezes, mecânico. O AgentePro é o nosso compromisso com a eficiência radical:

- **Zero Ruído**: Agentes que qualificam leads com base em dados reais, não apenas palavras-chave.
- **Negociação com Alma**: IA que entende contexto, gerencia objeções e avança o funil.
- **Escala Infinita**: De 10 a 10.000 leads sem aumentar o seu overhead.

---

## 🎯 O Que É e Como Funciona

O fluxo do AgentePro é construído para eliminar o trabalho manual de uma agência ou time comercial na busca por novos clientes:

1. **Hunter (Busca e Qualificação)**: O agente busca estabelecimentos na web (ex: "clínicas odontológicas em São Paulo") através da API do Google Places. Ele aplica regras de pontuação (score) baseadas em metadados reais (número de avaliações, existência de um site próprio, nota geral) para qualificar o prospect.
2. **Closer (Contato e Negociação)**: Um agente treinado em negociação de 6 etapas interage com o prospect pelo WhatsApp. Todo o funil de vendas é gerido automaticamente.
3. **Builder (Entrega de Valor)**: Quando o prospect avança no funil de negociação, o agente gera dinamicamente um site utilizando os templates curados e realiza um deploy automatizado.
4. **QA (Qualidade e Segurança)**: Agente auditor que garante o cumprimento de OWASP Top 10, Core Web Vitals (Lighthouse ≥ 85) e WCAG 2.1 antes de liberar o deploy.
5. **Supervisão Humana (HITL)**: A plataforma conta com um CRM Next.js. O operador humano pode intervir nas conversas ou aprovar/rejeitar ações críticas dos agentes (Human-In-The-Loop) via aprovação baseada em tiers.

---

## 🏗 Arquitetura e Escalabilidade

O sistema abandonou o monólito legado em favor de uma **Arquitetura Hexagonal (Ports and Adapters)** implementada como um **Turborepo** (Monorepo), permitindo forte tipagem fim-a-fim, reuso de código e altíssima escalabilidade.

### Estrutura do Monorepo

- **`apps/api` (Backend Node.js/Fastify)**: API de ultra-alta performance. Cuida de toda a persistência de dados utilizando o **Drizzle ORM** (PostgreSQL) e o sistema de filas robusto **BullMQ** (via Redis) para processar webhooks e envios de background (mensagens, e-mails, execuções de agentes).
- **`apps/web` (Frontend Next.js)**: Painel CRM interativo, implementado utilizando **TailwindCSS** e **shadcn/ui**, permitindo acompanhamento do Pipeline (Kanban) e gestão de aprovações em tempo real.
- **`apps/agent-runtime` (Serviço Python/CrewAI)**: Um microserviço dedicado que orquestra os cérebros de IA. Utiliza **CrewAI**, LiteLLM, ChromaDB (para RAG contextual) e integra-se com APIs externas de múltiplos provedores (Anthropic, OpenAI, Google, Ollama local) de forma totalmente tipada através do `pydantic`. A porta `LLMRouter` permite desacoplamento total por agente.
- **`packages/*`**: Repositórios compartilhados de tipos TS (`shared-types`), schemas (`database`) e configurações de linting/build, garantindo consistência em toda a base de código.

A infraestrutura foi pensada para rodar de forma descentralizada. Os _Workers_ do BullMQ garantem que milhares de requisições de mensagens ou acionamentos de agentes escalem de modo seguro na nuvem, sem bloquear o _Event Loop_ principal da API.

---

## 🛡️ Segurança: Abordagem "Zero Trust"

A segurança é nativa por design (Security-First) e passou por extensivos testes de invasão e auditoria de ameaças (Threat Modeling STRIDE):

- **Prevenção contra SSRF (Server-Side Request Forgery)**: O sistema proíbe ativamente tentativas de agentes consultarem IPs internos (`127.0.0.1`, `10.x.x.x`, infraestruturas AWS/GCP internal metadata) através das ferramentas de web search.
- **Proteção de Uploads (Magic Bytes)**: Não acreditamos em extensões de arquivo. Todos os uploads validados na API (ex: documentos de referência) passam por checagem profunda de "Magic Bytes" de cabeçalho. Arquivos `.exe` escondidos sob o disfarce de `.jpg` recebem hard-block (`400 Bad Request`). Há também limitação estrita de 10MB por arquivo para mitigar vetores DoS.
- **Autenticação Inquebrável (JWT & Argon2id)**: Senhas com Hash de última geração (Argon2id) resistentes a ASICs. Todo token JWT possui verificação rigorosa de assinatura, expiração temporal curta, rotação de `Refresh Token` e validação severa de propriedades (`aud`, `iss`), negando explicitamente ataques do tipo _algorithm: "none"_.
- **Anti-Injection e RBAC/IDOR**: Prevenção total nativa via parâmetros parametrizados do Drizzle contra SQL Injection. As rotas são validadas individualmente para evitar IDOR (Acesso Direto a Objeto Inseguro), bloqueando que Operador A veja dados do Operador B.

---

## 📊 Observabilidade Completa

Todo o ciclo de vida do Agente e da API possui rastreio (Tracing) transparente e profundo, facilitando o diagnóstico em produção:

- **Logging Estruturado (Pino)**: Logs de alto desempenho em formato JSON compatível com agregadores modernos (ELK/Datadog).
- **Métricas Node.js & Prometheus**: Todas as instâncias Fastify expõem uma rota `/api/v1/metrics` coletando dados vitais como uso do Event Loop, Active Handles, Memory Heap e RPS.
- **OpenTelemetry (OTel)**: Geração de Distributed Traces detalhados permitindo visualizar (via **Jaeger** ou **Grafana**) precisamente onde uma requisição de disparo no WhatsApp gargalou – se foi no acesso ao DB, na Fila Redis ou no LLM.
- **Grafana Loki v3 (Logs Centralizados)**: Agregação unificada de logs de todos os containers estruturados via Promtail, usando schema `tsdb` para buscas eficientes, indexados e consultáveis diretamente no Grafana.

---

## 📝 Prompt-as-Code (Docs/Agents)

Nossos agentes evoluem através de código. Todos os comportamentos, regras de HITL, checklists de segurança (ex: OWASP, WCAG) e tons de voz estão versionados no diretório `docs/agents/prompts/`. Cada atualização (como a versão robusta do `qa-v1.md`) é documentada em um CHANGELOG estrito. Nunca alteramos comportamento de IA sem revisão de código e merge request.

## ⚙️ Guia Rápido: Do Zero ao Funcionamento (DX Otimizado)

A arquitetura do AgentePro evoluiu para proporcionar a melhor Experiência do Desenvolvedor (DX). Criamos um inicializador inteligente multiplataforma que faz todo o trabalho pesado por você. Além disso, o sistema utiliza o **Settings Hub**: um painel centralizado no frontend (protegido por banco de dados criptografado) para você gerenciar todas as suas chaves de API (OpenAI, Anthropic, WhatsApp, etc). Diga adeus aos gigantescos arquivos `.env` manuais para chaves de negócio!

### Requisitos Mínimos Obrigatórios

Para executar o ecossistema AgentePro localmente, certifique-se de que sua máquina atenda aos seguintes requisitos:

- **Node.js**: Versão 22 ou superior (incluindo `npm`).
- **Docker**: Engine e Docker Compose instalados e rodando (Obrigatório para o PostgreSQL, Redis, ChromaDB e Ollama).
- **Sistema Operacional**: Suporte nativo multiplataforma (Windows via CMD/PowerShell, WSL2, Linux ou macOS).

### 1. Preparação (Opcional - Chave de Criptografia)

O sistema de inicialização criará o `.env` automaticamente para você, mas é **altamente recomendado** que você gere uma chave AES-256 para o `SETTINGS_ENCRYPTION_KEY` e adicione ao seu arquivo `.env` gerado. Esta chave blinda as credenciais no banco de dados.

```bash
# Gere uma chave segura no seu terminal e copie a saída
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

### 2. O Inicializador Inteligente (One-Click Start)

Chega de rodar `docker-compose` manualmente, descobrir portas presas ou esquecer de aplicar as migrations. Na raiz do projeto, instale as dependências e rode o inicializador:

```bash
# 1. Instale as dependências do Turborepo e dos Workspaces
npm install

# 2. Rode o inicializador Mágico
npm run init
```

**O que o Inicializador (`scripts/init.js`) faz por baixo dos panos?**

1. **Pre-flight Checks**: Valida se o Docker está em execução e cria seu arquivo `.env` padrão caso não exista.
2. **Infra Bootstrap**: Sobe todos os contêineres vitais (`docker compose up -d`) em background.
3. **Health Checks**: Realiza _polling_ nativo e seguro para garantir que o banco de dados PostgreSQL esteja aceitando conexões antes de prosseguir.
4. **Data Sync**: Dispara silenciosamente o `npm run db:push` no contexto da API para sincronizar as migrations.
5. **Diagnóstico Proativo**: Intercepta erros comuns. Por exemplo, se o WSL não tiver suporte a NVIDIA GPUs e o _Ollama_ falhar, ou se a porta `5432` já estiver em uso, o script abortará informando exatamente como consertar em português claro.
6. **Live Attach**: Finalizado o setup, ele automaticamente levanta todo o projeto (`npm run dev`) e acopla a saída no mesmo terminal.

### 3. Configurando suas Integrações via Settings Hub

Com o projeto rodando (`npm run dev` ativado pelo inicializador), acesse seus painéis locais:

- 💻 **Dashboard CRM (Next.js)**: `http://localhost:3000`
- ⚙️ **API Gateway (Fastify)**: `http://localhost:3001`
- 🤖 **Agent Runtime (FastAPI)**: `http://localhost:8001`

**Como plugar a Inteligência Artificial?**

1. Acesse o painel web em `http://localhost:3000/settings`.
2. Utilize a aba **AI Providers** para ativar e colar chaves de APIs.
3. Na seção **Ollama**, puxe modelos locais (ex: `llama3`) com 1-clique na interface.
4. Configure canais de mensageria (WhatsApp) e integrações MCP.

---

## 🧪 CI/CD e Testes Automatizados

O repositório é guardado por testes que garantem a **Imutabilidade e Segurança** dos deploys futuros.
O repositório CI valida qualquer PR com ≥50% de cobertura Python, testes unitários de domínio Node.js, testes E2E Playwright e escaneamento SAST (CodeQL + Semgrep + Trivy). **O pipeline de CD está desativado** — deploy local via `docker compose -f infra/docker-compose.yml up -d` (ver `docs/runbooks/01_iniciar_sistema.md`).

Para testar localmente na sua máquina:

```bash
# Executa apenas testes unitários de domínio (Rápido, sem dependência de Docker)
npm run test:unit -w apps/api

# Executa testes de integração (Exige DB, Redis e infra rodando via Docker)
npm run test:integration -w apps/api

# Executa cirurgicamente os testes de cibersegurança e Bypass Validation
npm run test:security -w apps/api

# Executa testes unitários nas habilidades da Inteligência Artificial
cd apps/agent-runtime
python -m pytest tests/
```

---

## ⚖️ Licença

Copyright (c) 2026 AgentePro / ProspectFlow AI

Este projeto é disponibilizado sob uma **Licença Proprietária de Uso Restrito**.

**O QUE VOCÊ PODE FAZER:**
Você está livre para usar o sistema para automatizar suas próprias vendas, prospectar clientes para o seu negócio e, dessa forma, gerar lucro. Integrações e extensões próprias são permitidas e incentivadas.

**O QUE É ESTRITAMENTE PROIBIDO:**
A **comercialização do sistema em si** é estritamente proibida. Você **não pode** vender o código, alugá-lo, distribuí-lo como produto pago, ou empacotar e oferecer o sistema como um serviço hospedado para terceiros (SaaS - Software as a Service) sem permissão explícita e prévia.
