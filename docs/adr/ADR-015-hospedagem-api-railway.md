# ADR-015: Estratégia de Hospedagem da API Backend no Railway

**Status:** Aceito
**Data:** 2026-05-18
**Deciders:** Arquiteto, Engenharia
**Tags:** infraestrutura, railway, backend, deploy, bullmq

## Contexto

Inicialmente, o projeto adotou uma abordagem "Localhost-First" (descrita no ADR-005) para simplificar o MVP e reduzir overhead. No entanto, com a evolução da arquitetura e a necessidade de validar o sistema em um ambiente de produção real (com persistência de estado compartilhado via Redis, suporte a múltiplos provedores LLM, testes de integração contínuos e graceful shutdown do BullMQ), tornou-se imprescindível a implantação na nuvem do Backend API.

Avaliou-se a implantação na plataforma Railway devido ao seu suporte nativo a monorepos (Turborepo), facilidade de configuração de CI/CD via `railway.toml`, e robustez para manter processos persistentes rodando em background (necessários para os workers do BullMQ e para as integrações via Telegram e webhooks do n8n).

## Decisão

**Migrar a hospedagem do API Backend e dos Workers assíncronos (BullMQ) para a plataforma Railway.**

Isso altera parcialmente o ADR-005, que preconizava tudo em `docker-compose` local para o MVP. O novo mapa de hospedagem para a API:

- **API Backend Fastify:** Deployed no Railway (Public Networking habilitado).
- **Workers (BullMQ):** Deployed no Railway (Processos persistentes).
- **Redis (Shared State):** Mantido de forma distribuída (podendo ser um plugin no Railway ou gerenciado externo) para suportar os workers de forma confiável.

## Consequências

### Positivas

- **Disponibilidade Pública:** A API agora pode receber webhooks externos (Telegram, Evolution API, Vercel) de forma estável.
- **Integração Monorepo:** O Railway lidou perfeitamente com a estrutura Turborepo, facilitando o build e o deploy.
- **Workers Robustos:** Suporte adequado a processos persistentes long-running (essenciais para orquestração de agentes e graceful shutdown).
- **Observabilidade Integrada:** O painel do Railway facilita o rastreamento de métricas e consumo de recursos.

### Negativas

- **Custo:** Diferente do modelo 100% gratuito local, a operação contínua pode ultrapassar o tier gratuito dependendo da escala, exigindo monitoramento ativo de faturamento.
- **Debt de Configuração:** Necessidade de manter arquivos como `railway.toml` e `Dockerfile.api` precisos e sincronizados com a evolução do projeto.

## Alternativas consideradas

- **Vercel para API:** Descartado pois a Vercel foca em arquiteturas Serverless/Edge, que inviabilizam processos persistentes long-running necessários para o BullMQ e os Agentes de IA.
- **Render.com / Fly.io:** Avaliados como opções viáveis, mas o Railway foi selecionado devido ao alinhamento com as resoluções já executadas na infraestrutura e excelente documentação de deploy contínuo.

## Critérios de reavaliação

- Se os custos mensais do Railway excederem o orçamento planejado para a fase inicial do projeto.
- Se a performance ou latência do Railway impactar os SLAs dos agentes (como timeouts em respostas ao Telegram/WhatsApp).
