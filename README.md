# AgentePro (ex-ProspectFlow AI) 🚀

> **"E se o seu melhor vendedor nunca dormisse, falasse todos os idiomas e qualificasse mil leads antes do seu café da manhã?"** ☕🤖

O **AgentePro** nasceu de uma dor real: o "grind" insuportável da prospecção manual. Enquanto times comerciais perdiam horas filtrando planilhas, nós decidimos construir um ecossistema onde a Inteligência Artificial não apenas ajuda, mas **lidera** o processo. 

Abaixo, você encontrará a jornada de como transformamos esse desafio em uma plataforma *Event-Driven* de ultra-alta performance.

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

A infraestrutura foi pensada para rodar de forma descentralizada. Os *Workers* do BullMQ garantem que milhares de requisições de mensagens ou acionamentos de agentes escalem de modo seguro na nuvem, sem bloquear o _Event Loop_ principal da API.

---

## 🛡️ Segurança: Abordagem "Zero Trust"

A segurança é nativa por design (Security-First) e passou por extensivos testes de invasão e auditoria de ameaças (Threat Modeling STRIDE):

- **Prevenção contra SSRF (Server-Side Request Forgery)**: O sistema proíbe ativamente tentativas de agentes consultarem IPs internos (`127.0.0.1`, `10.x.x.x`, infraestruturas AWS/GCP internal metadata) através das ferramentas de web search.
- **Proteção de Uploads (Magic Bytes)**: Não acreditamos em extensões de arquivo. Todos os uploads validados na API (ex: documentos de referência) passam por checagem profunda de "Magic Bytes" de cabeçalho. Arquivos `.exe` escondidos sob o disfarce de `.jpg` recebem hard-block (`400 Bad Request`). Há também limitação estrita de 10MB por arquivo para mitigar vetores DoS.
- **Autenticação Inquebrável (JWT & Argon2id)**: Senhas com Hash de última geração (Argon2id) resistentes a ASICs. Todo token JWT possui verificação rigorosa de assinatura, expiração temporal curta, rotação de `Refresh Token` e validação severa de propriedades (`aud`, `iss`), negando explicitamente ataques do tipo *algorithm: "none"*.
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

## ⚙️ Guia Rápido: Do Zero ao Funcionamento

### Pré-Requisitos do Sistema
Para rodar este ambiente em modo desenvolvedor (ou produção on-premise), garanta que sua máquina possua:
- **Node.js** (versão 22 ou superior) & `npm`
- **Python** (versão 3.12 ou superior)
- **Docker** e **Docker Compose**
- Uma conta no [Google Cloud Console](https://console.cloud.google.com/) para obter a chave da Places API.
- Tokens das LLMs que deseja utilizar (Anthropic, Gemini ou OpenAI).

### 1. Preparação de Credenciais
Copie o arquivo de variáveis de ambiente base da raiz e preencha com suas chaves locais e senhas desejadas.
```bash
cp .env.example .env
```

### 2. Bootstrapping da Infraestrutura
Disponibilizamos um shell script seguro para orquestrar os containers essenciais (PostgreSQL, Redis, ChromaDB, Prometheus e Grafana) em _background_ e automaticamente executar as migrações (estruturação de tabelas) de banco de dados do Drizzle.
```bash
# Na raiz do repositório
chmod +x infra/scripts/setup.sh
./infra/scripts/setup.sh
```
*Se você utiliza Windows, instale o WSL2 ou rode pelo Git Bash.*

### 3. Instalação das Dependências
Na arquitetura Turborepo, o `npm install` na raiz cuida de realizar o symlink correto entre pacotes e aplicativos TypeScript de maneira unificada:
```bash
npm install
```

### 4. Inicializando Todos os Serviços
Com apenas 1 comando, o Turborepo inicia tanto a API (Node.js), o CRM Web (Next.js) e instiga o ambiente de background dos agentes.
```bash
npm run dev
```

Pronto! Seus painéis ficarão online nas seguintes portas:
- 💻 **Dashboard CRM (Next.js)**: `http://localhost:3000`
- ⚙️ **API Gateway**: `http://localhost:3001`
- 🤖 **Agent Runtime (FastAPI + Python)**: `http://localhost:8001`
- 📈 **Grafana Metrics**: `http://localhost:3333` (usuário configurado no seu `.env`)

---

## 🧪 CI/CD e Testes Automatizados

O repositório é guardado por testes que garantem a **Imutabilidade e Segurança** dos deploys futuros.
Na nuvem, as _Github Actions_ validam a integridade de qualquer PR garantindo ao menos 80% de cobertura nos statements, testes End-To-End (E2E Playwright) e escaneamento SAST em busca de vulnerabilidades de supply-chain.

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
Todos os direitos reservados. Uso proprietário e confidencial. O uso, distribuição ou cópia não autorizada do código presente neste repositório é estritamente proibido.
