# ADR-011: Estratégia contratual e compliance — LGPD + CDC + Clickwrap

**Status:** Aceito  
**Data:** 2026-05-09  
**Deciders:** Produto  
**Tags:** legal, lgpd, cdc, contrato, clickwrap, compliance

---

## Contexto

O AgentePro opera em um contexto com múltiplas camadas de risco legal:

1. **Prospecção ativa** — agentes contatam pessoas que não solicitaram o serviço
2. **Coleta de dados pessoais** — nome, telefone, email, empresa de leads
3. **Contrato digital** — venda fechada via chat/WhatsApp sem assinatura física
4. **Pagamento antecipado** — cliente paga antes de receber o serviço
5. **Serviço prestado por IA** — cliente pode não saber que negocia com um agente

Conversas e e-mails isolados **não** são suficientes como instrumento contratual.
Precisam de: identificação das partes, escopo definido, assinatura verificável,
política de cancelamento, e base legal para tratamento de dados (LGPD).

---

## Decisão

**Clickwrap agreement como instrumento contratual principal, com registro auditável
de aceite. Operação sob CNPJ (MEI mínimo). Consentimento explícito para tratamento
de dados na prospecção.**

### 1. Clickwrap Agreement — fluxo técnico

```
Closer fecha venda
        ↓
Gera link de proposta + contrato (URL única, expira em 48h)
        ↓
Cliente acessa página de aceitação
        ↓
Lê: escopo, prazo, valor, política de cancelamento, LGPD
        ↓
Clica "Li e aceito os termos" (checkbox obrigatório, não pré-marcado)
        ↓
Sistema registra:
  - timestamp ISO 8601
  - IP do cliente (hash — não armazenado em texto)
  - User-Agent
  - Conteúdo exato do contrato aceito (hash SHA-256 do texto)
  - ID da sessão
        ↓
Link de pagamento liberado SOMENTE após aceite registrado
        ↓
Registro armazenado em audit_log (append-only, imutável)
```

### 2. Conteúdo mínimo obrigatório do contrato

```markdown
1. PARTES
   Prestador: [Nome/CNPJ do operador], [endereço]
   Contratante: [Nome do cliente], [CPF/CNPJ]

2. OBJETO
   Desenvolvimento de [tipo de site] conforme briefing anexo.
   Especificações: [lista detalhada — sem ambiguidade]
   O que NÃO está incluído: [lista explícita]

3. PRAZO
   Entrega em até [N] dias úteis após confirmação do pagamento.
   Revisões inclusas: [N] rounds conforme especificação.

4. VALOR E PAGAMENTO
   Valor total: R$ [X,XX]
   Forma de pagamento: [PIX/boleto/cartão]
   Pagamento realizado antes do início do serviço.

5. DIREITO DE ARREPENDIMENTO (CDC Art. 49)
   Em até 7 dias da contratação, se o serviço não tiver sido iniciado,
   o cliente pode cancelar com reembolso integral.
   Após início do serviço (confirmado por e-mail), o cancelamento
   sujeita-se à política do item 6.

6. CANCELAMENTO
   Antes do início: reembolso integral
   Após início: [política específica — ex: reembolso proporcional]
   Após entrega: sem reembolso; sujeito a revisões contratuais

7. TRATAMENTO DE DADOS (LGPD)
   Dados coletados: [lista]
   Finalidade: prestação do serviço contratado
   Base legal: execução de contrato (Art. 7º, V, LGPD)
   Retenção: [período]
   Direitos do titular: acesso, correção, exclusão via [email]

8. FORO
   [Cidade do operador], Estado [UF]
```

### 3. Base legal para prospecção (LGPD)

O agente Hunter coleta e trata dados de pessoas que não solicitaram contato.
A base legal mais adequada é **legítimo interesse** (Art. 7º, IX, LGPD), mas
requer avaliação de necessidade e proporcionalidade.

```
Obrigações do operador antes de prospectar:
  ✓ Ter Política de Privacidade publicada e acessível
  ✓ Primeira mensagem incluir: identificação, finalidade e opt-out
  ✓ Honrar opt-out imediatamente (blocklist permanente)
  ✓ Não armazenar dados de quem optou por não ser contatado

Texto obrigatório na primeira mensagem do agente:
  "Olá [nome], sou [nome do operador] e entrei em contato sobre
  [serviço]. Se preferir não receber mais mensagens, responda PARAR
  e não voltarei a entrar em contato."
```

### 4. HITL como controle de compliance

```typescript
// Rule obrigatória em todos os agentes de prospecção
const COMPLIANCE_RULE: AgentRule = {
  name: "first_message_opt_out_required",
  condition: "message.isFirst == true && message.channel == 'EXTERNAL'",
  action: "BLOCK_UNLESS_OPT_OUT_INCLUDED",
  priority: 1,
};

// Verificação automática antes de qualquer primeiro contato
function validateFirstMessage(message: string): boolean {
  const OPT_OUT_PATTERNS = [
    /responda PARAR/i,
    /para não receber/i,
    /descadastrar/i,
  ];
  return OPT_OUT_PATTERNS.some((p) => p.test(message));
}
```

### 5. Registro da prova de aceite

```sql
-- Tabela específica para evidência de aceite contratual
CREATE TABLE contract_acceptances (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id         UUID NOT NULL REFERENCES deals(id),
  contract_hash   TEXT NOT NULL,  -- SHA-256 do texto exato do contrato
  accepted_at     TIMESTAMPTZ NOT NULL,
  ip_hash         TEXT NOT NULL,  -- Hash do IP — não armazena IP puro (LGPD)
  user_agent_hash TEXT NOT NULL,
  session_id      TEXT NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
  -- Sem UPDATE/DELETE via RLS
);
```

---

## Consequências

### Positivas

- Clickwrap é juridicamente defensável no Brasil (MP 2.200-2/2001 + jurisprudência)
- Registro imutável do aceite protege o operador em disputas
- Opt-out na prospecção reduz risco LGPD significativamente
- Direito de arrependimento explicitado protege o operador de chargebacks

### Negativas

- Adiciona fricção no fluxo de compra (cliente precisa acessar página de contrato)
- Requer consultoria jurídica para revisão do texto contratual antes do lançamento
- MEI tem limitações de faturamento (R$ 81.000/ano em 2026) — planejar transição

### Recomendações não técnicas (fora do escopo do sistema)

- Contratar advogado especializado em direito digital para revisão do contrato (R$ 300–600)
- Registrar CNPJ (MEI mínimo) antes de receber primeiro pagamento
- Ter conta bancária PJ separada da pessoal

---

## Referências

- LGPD — Lei 13.709/2018
- CDC — Lei 8.078/1990, Art. 49
- MP 2.200-2/2001 (certificação digital e validade de contratos eletrônicos)
- Resolução CD/ANPD 2/2022 (tratamento de dados de agentes de negócios)

---

## 📋 Status de Implementação (2026-05-09)

**Implementação:** Planejada — **Fase 12** do `task.md`

| Componente                                           | Status                  |
| ---------------------------------------------------- | ----------------------- |
| `contract_acceptances` (tabela DB + RLS append-only) | ⏳ Pendente — Fase 12.1 |
| `prospect_optouts` (blocklist hasheada)              | ⏳ Pendente — Fase 12.1 |
| `ContractAcceptance` (Domain Aggregate)              | ⏳ Pendente — Fase 12.2 |
| `GenerateProposalLinkHandler` (JWT 48h)              | ⏳ Pendente — Fase 12.4 |
| `RecordContractAcceptanceHandler`                    | ⏳ Pendente — Fase 12.4 |
| `CheckOptOutHandler` (antes de HITL-1)               | ⏳ Pendente — Fase 12.4 |
