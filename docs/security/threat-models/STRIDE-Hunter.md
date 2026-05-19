# Threat Model: Agente Hunter (Lead & Prospecting)

## Metodologia: STRIDE

### 1. Spoofing (Falsificação de Identidade)

- **Ameaça:** O Agente Hunter interage externamente se passando por algo que não é, ou sofre _Prompt Injection_ para agir contra o escopo definido.
- **Mitigações Implementadas:**
  - _Prompt-as-Code_ mantido em readonly no ambiente de execução.
  - HITL obrigatório (Hard Timeout e bloqueio de sistema) antes de qualquer e-mail/whatsapp ser enviado.

### 2. Tampering (Adulteração de Dados)

- **Ameaça:** O Agente adultera indevidamente o CRM, apagando leads de outros operadores.
- **Mitigações Implementadas:**
  - O Agente Hunter comunica-se com o CRM Core via emissão de _Domain Events_ (ex: `LeadQualified`) através da ACL e do barramento assíncrono. O Agente não possui permissão de `UPDATE`/`DELETE` na tabela de Leads diretamente.

### 3. Repudiation (Repúdio)

- **Ameaça:** O sistema qualifica ou rejeita um lead massivo sem deixar claro o porquê.
- **Mitigações Implementadas:**
  - Toda vez que o Hunter processa o `Qualification Score`, ele é forçado (via schema estruturado JSON) a depositar um "Rationale" (justificativa de texto), que é logado imutavelmente.

### 4. Information Disclosure (Divulgação de Informações)

- **Ameaça:** Durante as atividades de _scraping_ / busca, o Agente expõe dados confidenciais nos URLs ou é utilizado via SSRF para scan de redes internas.
- **Mitigações Implementadas:**
  - **Prevenção SSRF**: A skill `site_analyzer` é interceptada em nível de rede por um middleware validador. Se resolver para ranges de IP internos (ex: `192.168.x.x`, `127.0.0.1`, `10.x.x.x`), o request é abortado.
  - Redação/Mascaramento de PII: As exibições de payload do HITL devem ter um filtro que mascare emails e telefones sensíveis quando não relevantes para auditoria pública.

### 5. Denial of Service (Negação de Serviço)

- **Ameaça:** O _Web Scraping_ ou o Loop do Hunter consome todos os tokens da API LLM, gerando exaustão financeira (Wallet Drain / DoS Financeiro).
- **Mitigações Implementadas:**
  - Operações do tipo `consumeAgentTokens` usam banco de dados com comandos atômicos (`SELECT FOR UPDATE`) para incrementar o uso.
  - Há um `Token Budget` estrito no cadastro do agente. Quando atinge o teto, ele entra em `PAUSED` status automaticamente.

### 6. Elevation of Privilege (Elevação de Privilégios)

- **Ameaça:** Agente Hunter executa workflow de "Deploy" reservado ao Agente Builder.
- **Mitigações Implementadas:**
  - Separação estrita de personas e skills no runtime. As skills como `deployer` não estão registradas na _Collection_ de Skills injetadas no contexto de LLM do Hunter.
