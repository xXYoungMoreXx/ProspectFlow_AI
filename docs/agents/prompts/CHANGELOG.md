# Changelog de Prompts (Prompt-as-Code)

Todas as mudanças nos System Prompts dos agentes devem ser documentadas aqui.
O formato baseia-se em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/).

## [Unreleased]

## [v1.4.0] - 2026-05-15

### Expandido

- `hunter-v1.md`: Prompt expandido para suportar ferramentas de B2B no Brasil via CNPJ (BrasilAPI). Adicionado: regras para qualificação baseada em saúde financeira (Capital Social) e facilidade de contato via QSA.

## [v1.3.1] - 2026-05-10

### Expandido

- `qa-v1.md`: Prompt expandido de 25 → 81 linhas. Adicionado: Workflow Operacional (3 passos), checklist completo por categoria (Segurança/Performance/Acessibilidade/SEO/Compliance LGPD), template de Relatório de Auditoria, constraint ZERO TOLERÂNCIA A SECRETS, regra de escalada HITL-FINANCEIRO.

## [v1.3.0] - 2026-05-09

### Adicionado

- `qa-v1.md`: Criação inicial do prompt base para o QA Agent. Define critérios estritos baseados no OWASP Top 10, WCAG 2.1 e Lighthouse, com regra de HITL após 3 iterações falhas.

## [v1.1.0] - 2026-05-09

## [1.0.0] - 2026-05-01

### Adicionado

- `hunter-v1.md`: Criação inicial do prompt base para o agente de prospecção, focando em extração de critérios, presença digital e score (0-100). Regra estrita de bloqueio de envio externo.
- `closer-v1.md`: Criação inicial do prompt de negociação, com regras de precificação justa e abordagem consultiva. Regra estrita de aprovação HITL.
- `builder-v1.md`: Criação inicial do prompt do desenvolvedor. Ênfase em OWASP Top 10, Core Web Vitals e uso de templates pré-aprovados.
