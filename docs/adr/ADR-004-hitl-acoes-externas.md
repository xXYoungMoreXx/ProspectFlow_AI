# ADR-004: HITL (Human-in-the-Loop) obrigatório para todas as ações externas

**Status:** Aceito  
**Data:** 2026-05-09  
**Deciders:** Arquiteto, Produto  
**Tags:** hitl, segurança, agentes, compliance, lgpd

---

## Contexto

Agentes de IA prospectando e comunicando autonomamente com clientes reais criam riscos legais,
reputacionais e financeiros concretos:

- **LGPD / CAN-SPAM**: contato não solicitado sem base legal pode configurar infração
- **Reputação**: uma mensagem inadequada do agente queima a imagem do operador com o cliente
- **Financeiro**: agente de tráfego mal configurado pode zerar budget em minutos
- **Plataformas**: WhatsApp e Instagram bloqueiam números/contas por comportamento de spam

A questão central é: **em que ponto o operador humano precisa estar no loop de decisão?**

Duas posições foram consideradas:

1. **HITL total**: toda ação requer aprovação — seguro, mas elimina o valor da automação
2. **HITL seletivo**: apenas ações de alto impacto requerem aprovação — equilibra segurança e autonomia

---

## Decisão

**HITL seletivo e obrigatório: aprovação humana exigida antes de qualquer ação com efeito
externo irreversível ou de alto impacto.**

### Classificação de ações por nível de HITL

| Nível | Tipo de ação | Comportamento |
|-------|-------------|---------------|
| **BLOQUEADO** | Ações internas de análise, qualificação, cálculo | Execução autônoma — sem HITL |
| **HITL-1** | Primeiro contato com lead (WhatsApp/email) | Aprovação obrigatória antes de enviar |
| **HITL-1** | Envio de proposta comercial | Aprovação + possibilidade de editar valor |
| **HITL-1** | Deploy de site em produção | Aprovação obrigatória + review do preview |
| **HITL-2** | Mensagens de follow-up (2ª, 3ª) | Aprovação com timeout de 30 min — auto-aprova se operador não responder |
| **HITL-FINANCEIRO** | Qualquer ativação de campanha paga | Aprovação obrigatória + teto de gasto explícito |
| **NUNCA** | Acesso a redes internas, execução de shell sem sandbox | Bloqueado por regra, não por HITL |

### Fluxo técnico do HITL

```
Agente solicita ação externa
        ↓
Regra de HITL avaliada (agent_rules)
        ↓
HITLApproval criado (status: PENDING)
        ↓
Webhook dispara → Operador notificado (Telegram/email)
        ↓
Operador: APROVAR / REJEITAR / EDITAR_E_APROVAR
        ↓                              ↓
Ação executada            Ação cancelada + motivo logado
        ↓
Audit log append-only registra decisão + payload + timestamp + IP

```

### Timeout por tipo de ação

```typescript
const HITL_TIMEOUTS: Record<HITLActionType, number> = {
  FIRST_CONTACT:     60 * 60,    // 1 hora — não urgente
  SEND_PROPOSAL:     2 * 60 * 60, // 2 horas
  DEPLOY_SITE:       4 * 60 * 60, // 4 horas — operador pode estar dormindo
  FOLLOW_UP:         30 * 60,    // 30 min — auto-aprova se não respondido
  PAID_CAMPAIGN:     0,          // NUNCA expira — aprovação manual obrigatória
}

// Após timeout: ação REJECTED automaticamente, nunca auto-approved para HITL-1
// Exceção: FOLLOW_UP com timeout pode ser configurado para auto-approve
```

### Registro auditável imutável

Todo HITL gera entrada append-only na `audit_log`. PII é mascarado antes do log
(número de telefone → `+55 11 9****-**34`, email → `j***@gmail.com`).
A tabela tem RLS bloqueando UPDATE e DELETE — evidência juridicamente defensável.

---

## Consequências

### Positivas
- Operador nunca é surpreendido por mensagem inadequada enviada pelo agente
- Audit log imutável é evidência em caso de disputa com cliente
- Timeout configurável equilibra agilidade (follow-ups) e segurança (primeiro contato)
- HITL-FINANCEIRO sem timeout elimina risco de gasto não autorizado em campanhas pagas

### Negativas
- Latência no ciclo de vendas: se operador demora a aprovar, lead esfria
- Dependência do operador estar disponível para o sistema funcionar em horário comercial
- Notificações excessivas podem gerar fadiga de aprovação — operador começa a aprovar sem ler

### Mitigações para fadiga de aprovação
- Preview rico na notificação: mostra exatamente o texto/proposta antes do clique
- Agrupamento: múltiplos follow-ups do mesmo dia em uma única aprovação em lote
- Dashboard HITL com fila priorizada: financeiro > primeiro contato > follow-up

---

## Alternativas consideradas

### HITL zero (full autonomy)
- **Descartado** — risco legal (LGPD), reputacional e financeiro inaceitáveis para MVP

### HITL total (toda ação aprovada)
- **Descartado** — elimina o valor central da automação; operador vira clicador manual

### Aprovação assíncrona por email apenas
- **Descartado em favor de Telegram** — email tem latência alta; Telegram bot permite
  aprovação em 2 toques no celular, fundamental para UX do operador
