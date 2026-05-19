# Threat Model: Identity & Access Management (IAM)

## Metodologia: STRIDE

### 1. Spoofing (Falsificação de Identidade)

- **Ameaça:** Atacante força logins para tentar assumir a conta de um Operador do sistema.
- **Mitigações Implementadas:**
  - Uso de JWT com chave RSA-256 (RS256), prevenindo falsificação do token.
  - Hashing de senhas utilizando `Argon2id` (resistente contra ataques de GPU e _rainbow tables_).
  - Rate Limiting restrito na rota `/auth/login` (ex: 5 tentativas por 15 min).
  - Endpoint anti-enumeração: Falhas de login com e-mails inexistentes retornam a exata mesma resposta e latência de senhas incorretas de e-mails válidos.

### 2. Tampering (Adulteração de Dados)

- **Ameaça:** Atacante intercepta e altera o JWT em trânsito ou altera logs de auditoria no DB.
- **Mitigações Implementadas:**
  - TLS/HTTPS estrito em todo o tráfego via API Gateway / Reverse Proxy.
  - Tabela `audit_log` no PostgreSQL configurada via Row Level Security (RLS) para ser `APPEND-ONLY` (Insert only). Funções de banco bloqueiam explicitamente comandos `UPDATE` ou `DELETE` nesta tabela.

### 3. Repudiation (Repúdio)

- **Ameaça:** Um operador ou agente de IA realiza uma ação destrutiva e o sistema não tem provas de quem originou o comando.
- **Mitigações Implementadas:**
  - Log de auditoria atrelado a IDs únicos imutáveis e `correlation_id` do OpenTelemetry.
  - Registros do HITL (Human-in-the-loop) guardam o exato timestamp e o operador que aprovou a transação. O RLS impede modificação desses logs retroativamente.

### 4. Information Disclosure (Divulgação de Informações)

- **Ameaça:** Vazamento de banco de dados ou interceptação de tokens LLM (ex: chaves da OpenAI) nas requisições.
- **Mitigações Implementadas:**
  - Senhas NUNCA são trafegadas limpas ou decifradas.
  - Uso do padrão de Vault/Secrets (ex: Infisical) onde o DB só salva a string de referência (`secrets/openai_key_xyz`), e a chave real é ejetada apenas em runtime no momento exato do uso pelo adaptador, sem circular em logs.

### 5. Denial of Service (Negação de Serviço)

- **Ameaça:** Um atacante pode enviar payloads gigantescos (ex: JSON bomb) na rota de login ou sobrecarregar a verificação Argon2 (que custa CPU).
- **Mitigações Implementadas:**
  - Middlewares na camada API avaliando _Content-Length_ antes de efetuar o parsing JSON.
  - Rate limiting restrito no NGINX / Gateway na rota Auth, protegendo a camada do Node.js de consumir excesso de recursos computacionais processando Argon2 hashes.

### 6. Elevation of Privilege (Elevação de Privilégios)

- **Ameaça:** Um Agente ganha acesso ao token de operador para se auto-aprovar (burlar HITL).
- **Mitigações Implementadas:**
  - _Zero Trust_: Agentes (via runtime Python/CrewAI) recebem credenciais escopadas geradas no momento da execução e não compartilham do mesmo JWT dos operadores. O módulo HITL só aceita comandos validados por um operador humano via contexto HTTP autenticado.
