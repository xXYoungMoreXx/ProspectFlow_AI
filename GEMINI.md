# GEMINI.md - ProspectFlow AI

> Este projeto segue o Protocolo de Isolamento de Agentes.

---

## 🏛️ Governança

- **Isolation**: Este projeto utiliza MCPs locais para Supabase e Memory.
- **Global Guide**: Consulte [GOVERNANCE.md](file:///E:/Dev/.shared_agent/GOVERNANCE.md) para diretrizes de ecossistema.

## 📚 Base de Conhecimento e Documentação

- **PRD Central**: `docs/PRD_AgentePro.md`
- **Decisões Arquiteturais (ADRs)**: Documentadas em `docs/adr/`. Devem seguir formato (Contexto, Opções, Decisão, Consequências).
- **Contratos de Integração**:
  - API HTTP (Síncrona): `docs/api/openapi.yaml` (Spec 3.1)
  - Mensageria (Event-Driven): `docs/asyncapi/asyncapi.yaml`
- **Segurança (STRIDE)**: Modelagem de ameaças mapeada em `docs/security/threat-models/`.
- **System Prompts**: Tratados como código (*Prompt-as-Code*). Versionados em `docs/agents/prompts/` com respectivo CHANGELOG.

---

## 🛠️ Configuração Local

Os MCPs deste projeto estão configurados em `./.agent/mcp_config.json`.

---

## 🛡️ Regras de Engenharia e Segurança (Obrigatórias)

1. **Ferramentas**: Sempre utilize as _skills_, _subagents_ e _workflows_ disponibilizados para realizar a tarefa solicitada.
2. **Arquitetura e Clean Code**: Sempre siga os padrões de _Clean Architecture_ ou _Hexagonal Architecture_ (a depender do projeto), _Clean Code_, _Domain Driven Design (DDD)_, _TDD_, _SDD_, _BDD_ e abordagem _Security First_.
3. **Framework GSD**: Sempre utilize o framework "Get Shit Done" (GSD - https://github.com/gsd-build/get-shit-done).
4. **Criptografia e Hashing**: Use padrões modernos, como **Argon2**, para hashing de senhas.
5. **Prevenção contra Enumeração**: Evite mensagens de erro específicas (como "e-mail não encontrado") que permitam a atacantes descobrir usuários válidos. Responda de forma genérica.
6. **Desconfiança do Frontend (Zero Trust)**: Nunca confie no frontend. Implemente limites estritos de tamanho de _input_ no backend para evitar poluição do banco de dados e ataques DoS.
7. **Atomicidade (Race Conditions)**: Em sistemas com transações financeiras ou contadores, utilize sempre operações atômicas ou transações de banco de dados nativas para evitar _Race Conditions_.
8. **Validação de Uploads**: Ao permitir uploads de arquivos, não verifique apenas a extensão. Valide obrigatoriamente o _MIME Type_ e os _Magic Bytes_ (assinatura real do arquivo).
9. **Pragmatismo**: Evite "inventar a moda" (_Over-engineering_). Foque na solução mais limpa e padrão possível.
10. **Testes de Segurança Automatizados**: Sempre gere testes de integração automatizados que cubram cenários de falhas de segurança. Se uma nova funcionalidade quebrar algo ou abrir brechas, a esteira de testes deve acusar.
11. **Gestão de Segredos**: Variáveis de ambiente e segredos devem ficar **sempre fora** do repositório de código.
12. **Prevenção SSRF e Trackers**: Ao permitir inserção de imagens ou links por usuários, valide se a URL pertence ao próprio domínio ou a uma _allowlist_ para evitar rastreadores de IP e ataques SSRF.
13. **PRD**: Sempre siga a risca o PRD local do projeto.
