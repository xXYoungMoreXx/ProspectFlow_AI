# SPEC-09: HITL — Human-in-the-Loop

> O HITL é o guardião do sistema. Nenhum agente executa ação externa sem aprovação.
> Versão: 2.0.0 | Fase: 1 | Dependências: SPEC-00

---

## Princípio Fundamental

```
TODA ação que afeta o mundo externo DEVE ter um HITL aprovado antes.
Sem exceção. Sem modo "auto-approve". Sem bypass por configuração.

Ações externas incluem:
  - Enviar mensagem (WhatsApp, Telegram, Email)
  - Enviar proposta
  - Fazer deploy de site
  - Gerar tutorial de entrega
  - Qualquer POST/PUT em API externa
```

---

## Estados do HITL

```
PENDING → APPROVED
       → REJECTED
       → EDITED_APPROVED  (operador editou o payload e aprovou)
       → EXPIRED           (timeout — automático, equivale a REJECTED)
```

Transições permitidas:
- `PENDING → APPROVED | REJECTED | EDITED_APPROVED | EXPIRED`
- Qualquer outro estado → imutável (não há transições saindo de estados finais)

---

## Tabela de Action Types e Timeouts

| Action Type | Timeout Padrão | Pode ser Editado | Descrição |
|---|---|---|---|
| `APPROVE_LEAD_LIST` | 120 min | Não | Lista de leads para prospectar |
| `SEND_EXTERNAL_MESSAGE` | 60 min | Sim | Mensagem WhatsApp/Telegram/Email |
| `SEND_PROPOSAL` | 60 min | Sim | PDF de proposta comercial |
| `APPROVE_MOCKUP` | 180 min | Não (abrir no painel) | Design visual do site |
| `APPROVE_STAGING` | 120 min | Não (ver staging URL) | Preview do site em staging |
| `DEPLOY_PRODUCTION` | 60 min | Não | Deploy final do site |
| `APPROVE_BRIEFING` | 60 min | Sim | JSON do briefing do cliente |
| `SEND_DELIVERY` | 30 min | Sim | Mensagem de entrega ao cliente |

---

## HITLApproval — Especificação do Aggregate

```typescript
// domain/hitl/HITLApproval.ts

interface HITLApprovalProps {
  id: HITLApprovalId;
  operatorId: string;
  agentId: string;
  subAgentId?: string;
  actionType: ActionType;
  contextType: 'LEAD' | 'DEAL' | 'BRIEFING' | 'PROJECT' | 'MOCKUP' | 'BATCH';
  contextId: string;
  payloadPreview: Record<string, unknown>;  // PII mascarado
  payloadFullRef?: string;                  // Referência ao vault (PII completo)
  status: HITLStatus;
  notifyChannel: 'telegram' | 'email';
  telegramMessageId?: string;              // Para editar mensagem inline
  expiresAt: Date;
  decidedAt?: Date;
  operatorNote?: string;
  correlationId: string;
}

class HITLApproval extends AggregateRoot {
  // Criar novo HITL
  static create(props: CreateHITLProps): HITLApproval {
    if (props.expiresAt <= new Date()) {
      throw new ValidationError('expiresAt deve ser no futuro');
    }
    const hitl = new HITLApproval({ ...props, status: 'PENDING' });
    hitl.addEvent(createHITLRequestedEvent(hitl));
    return hitl;
  }

  // Aprovar
  approve(operatorNote?: string): void {
    this.assertPending();
    this.status = 'APPROVED';
    this.decidedAt = new Date();
    this.operatorNote = operatorNote;
    this.addEvent(createHITLDecidedEvent(this));
  }

  // Rejeitar
  reject(operatorNote?: string): void {
    this.assertPending();
    this.status = 'REJECTED';
    this.decidedAt = new Date();
    this.operatorNote = operatorNote;
    this.addEvent(createHITLDecidedEvent(this));
  }

  // Editar payload e aprovar
  editAndApprove(newPayload: Record<string, unknown>, note: string): void {
    this.assertPending();
    this.payloadPreview = newPayload;  // payload editado
    this.status = 'EDITED_APPROVED';
    this.decidedAt = new Date();
    this.operatorNote = note;
    this.addEvent(createHITLDecidedEvent(this));
  }

  // Expirar (chamado pelo timeout job)
  expire(): void {
    this.assertPending();
    this.status = 'EXPIRED';
    this.decidedAt = new Date();
    this.addEvent(createHITLExpiredEvent(this));
  }

  isExpired(): boolean {
    return new Date() > this.expiresAt;
  }

  private assertPending(): void {
    if (this.status !== 'PENDING') {
      throw new DomainError(
        `HITL já foi decidido: ${this.status}`,
        'INVALID_STATE',
        { currentStatus: this.status }
      );
    }
    if (this.isExpired()) {
      throw new DomainError('HITL expirado', 'HITL_EXPIRED');
    }
  }
}
```

---

## HITLPayloadMasker — Especificação

```typescript
// domain/hitl/HITLPayloadMasker.ts

const PII_KEYS_FULL_MASK = [
  'email', 'password', 'contactPhone', 'contactEmail',
  'cpf', 'cnpj', 'address', 'telefone',
];

const PII_KEYS_PARTIAL_MASK = [
  'contactName',     // "João Silva" → "Joã***"
  'businessName',    // Mostrar inteiro (não é PII real, mas cuidado)
];

const TRUNCATE_KEYS = [
  'message',         // Mostrar apenas 150 primeiros chars
  'proposalText',    // Mostrar apenas 200 primeiros chars
  'transcriptRaw',   // Não mostrar — apenas indicar que existe
];

class HITLPayloadMasker {
  mask(payload: Record<string, unknown>): Record<string, unknown> {
    return this.maskRecursive({ ...payload });
  }

  private maskRecursive(obj: Record<string, unknown>): Record<string, unknown> {
    const result: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(obj)) {
      const lowerKey = key.toLowerCase();

      if (PII_KEYS_FULL_MASK.includes(lowerKey)) {
        result[key] = '***REDACTED***';
      } else if (PII_KEYS_PARTIAL_MASK.includes(key) && typeof value === 'string') {
        result[key] = value.slice(0, 3) + '***';
      } else if (TRUNCATE_KEYS.includes(key) && typeof value === 'string') {
        result[key] = value.slice(0, 150) + (value.length > 150 ? '...' : '');
        result[`${key}_full_in_vault`] = true;
      } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        result[key] = this.maskRecursive(value as Record<string, unknown>);
      } else {
        result[key] = value;
      }
    }

    return result;
  }
}
```

---

## Telegram HITL Bot — Especificação

```typescript
// infrastructure/messaging/TelegramHITLBot.ts

class TelegramHITLBot {
  // Enviar notificação para o operador
  async notifyOperator(approval: HITLApproval): Promise<string> {
    const message = this.buildMessage(approval);
    const keyboard = this.buildKeyboard(approval);

    const response = await this.telegramAPI.sendMessage({
      chat_id: env.TELEGRAM_OPERATOR_CHAT_ID,
      text: message,
      parse_mode: 'Markdown',
      reply_markup: keyboard,
    });

    return response.message_id.toString();
  }

  private buildMessage(approval: HITLApproval): string {
    const icons: Record<string, string> = {
      APPROVE_LEAD_LIST:       '🎯',
      SEND_EXTERNAL_MESSAGE:   '📨',
      SEND_PROPOSAL:           '📋',
      APPROVE_MOCKUP:          '🎨',
      APPROVE_STAGING:         '🌐',
      DEPLOY_PRODUCTION:       '🚀',
      APPROVE_BRIEFING:        '📝',
      SEND_DELIVERY:           '🎁',
    };

    const minutesLeft = Math.floor(
      (approval.expiresAt.getTime() - Date.now()) / 60000
    );

    const previewText = JSON.stringify(approval.payloadPreview, null, 2)
      .slice(0, 600);

    return [
      `${icons[approval.actionType] ?? '⚡'} *APROVAÇÃO NECESSÁRIA*`,
      '',
      `*Tipo:* \`${approval.actionType}\``,
      `*Contexto:* ${approval.contextType} \`${approval.contextId.slice(0, 8)}\``,
      `*Agente:* ${approval.agentPersona}${approval.subAgentRole ? ` › ${approval.subAgentRole}` : ''}`,
      `*Expira em:* ${minutesLeft} minutos`,
      '',
      '*Preview:*',
      '```json',
      previewText,
      approval.payloadPreview ? '...' : '',
      '```',
    ].join('\n');
  }

  private buildKeyboard(approval: HITLApproval): TelegramInlineKeyboard {
    const canEdit = [
      'SEND_EXTERNAL_MESSAGE',
      'SEND_PROPOSAL',
      'APPROVE_BRIEFING',
      'SEND_DELIVERY',
    ].includes(approval.actionType);

    const buttons: TelegramButton[][] = [
      [
        { text: '✅ APROVAR',  callback_data: `hitl:approve:${approval.id.value}` },
        { text: '❌ REJEITAR', callback_data: `hitl:reject:${approval.id.value}` },
      ],
    ];

    if (canEdit) {
      buttons.push([
        { text: '✏️ EDITAR E APROVAR', callback_data: `hitl:edit:${approval.id.value}` },
      ]);
    }

    buttons.push([
      {
        text: '🔍 VER COMPLETO',
        url: `${env.FRONTEND_URL}/hitl/${approval.id.value}`,
      },
    ]);

    return { inline_keyboard: buttons };
  }

  // Processar callback de botão pressionado
  async handleCallback(query: TelegramCallbackQuery): Promise<void> {
    const [prefix, action, approvalId] = query.data.split(':');
    if (prefix !== 'hitl') return;

    await this.telegramAPI.answerCallbackQuery({ callback_query_id: query.id });

    let newText: string;

    switch (action) {
      case 'approve':
        await this.hitlService.approve(approvalId, 'Aprovado via Telegram');
        newText = '✅ *APROVADO* — Ação executada.';
        break;
      case 'reject':
        await this.hitlService.reject(approvalId, 'Rejeitado via Telegram');
        newText = '❌ *REJEITADO* — Ação cancelada.';
        break;
      case 'edit':
        newText = `✏️ Edite em: ${env.FRONTEND_URL}/hitl/${approvalId}`;
        break;
      default:
        return;
    }

    // Editar a mensagem original para mostrar a decisão
    await this.telegramAPI.editMessageText({
      chat_id: env.TELEGRAM_OPERATOR_CHAT_ID,
      message_id: parseInt(query.message.message_id),
      text: newText,
      parse_mode: 'Markdown',
    });
  }

  // Atualizar mensagem para mostrar que expirou
  async markAsExpired(telegramMessageId: string): Promise<void> {
    await this.telegramAPI.editMessageText({
      chat_id: env.TELEGRAM_OPERATOR_CHAT_ID,
      message_id: parseInt(telegramMessageId),
      text: '⏰ *EXPIRADO* — Esta aprovação expirou sem decisão. Acesse o painel para retomar.',
      parse_mode: 'Markdown',
    });
  }
}
```

---

## Timeout Job — Especificação

```typescript
// application/hitl/HITLTimeoutUseCase.ts
// Executado a cada 5 minutos pelo BullMQ (job repetitivo)

class HITLTimeoutUseCase {
  async execute(): Promise<void> {
    // Buscar todos os HITLs PENDING que expiraram
    const expired = await this.hitlRepo.findExpiredPending();

    for (const hitl of expired) {
      // Expirar no aggregate (emite HITLExpired event)
      hitl.expire();
      await this.hitlRepo.save(hitl);

      const events = hitl.pullEvents();
      await this.eventBus.publishAll(events);

      // Atualizar mensagem no Telegram
      if (hitl.telegramMessageId) {
        await this.telegramBot.markAsExpired(hitl.telegramMessageId);
      }

      // Notificar operador que expirou
      await this.telegramBot.sendMessage(
        env.TELEGRAM_OPERATOR_CHAT_ID,
        `⏰ HITL *expirado*: ${hitl.actionType} para ${hitl.contextType} ` +
        `\`${hitl.contextId.slice(0, 8)}\`.\n` +
        `O agente foi pausado. Acesse o painel para retomar.`
      );

      // Auditoria
      await this.auditLog.record('HITL_EXPIRED', {
        approvalId: hitl.id.value,
        actionType: hitl.actionType,
        agentId: hitl.agentId,
        correlationId: hitl.correlationId,
      });
    }
  }
}

// BullMQ setup do job repetitivo
queue.add('hitl-timeout-check', {}, {
  repeat: { every: 5 * 60 * 1000 },  // a cada 5 min
  removeOnComplete: 1,
  removeOnFail: 10,
});
```

---

## API Endpoints

### GET /api/v1/hitl/pending

```typescript
// Response 200
{
  data: Array<{
    id: string;
    actionType: string;
    contextType: string;
    contextId: string;
    agentPersona: string;
    subAgentRole?: string;
    payloadPreview: Record<string, unknown>;  // PII mascarado
    expiresAt: string;
    timeRemainingMinutes: number;
    createdAt: string;
    // Metadados para contexto rápido
    lead?: { businessName: string; city: string };
    deal?: { totalBrl: number };
    project?: { stagingUrl?: string; mockupUrl?: string };
  }>;
  meta: { total: number };
}
```

### POST /api/v1/hitl/:id/approve

```typescript
// Request
{ note?: string }  // nota opcional do operador

// Response 200
{
  data: {
    id: string;
    status: 'APPROVED';
    decidedAt: string;
  }
}

// Errors:
// 404 — HITL não encontrado
// 409 — HITL já foi decidido (status != PENDING)
// 410 — HITL expirado
// 403 — HITL de outro operador
```

### POST /api/v1/hitl/:id/reject

```typescript
// Request
{ note?: string }

// Response 200
{ data: { id: string; status: 'REJECTED'; decidedAt: string } }
```

### PATCH /api/v1/hitl/:id/edit-and-approve

```typescript
// Request
{
  editedPayload: Record<string, unknown>;  // payload editado pelo operador
  note: string;                            // obrigatório ao editar
}

// Response 200
{ data: { id: string; status: 'EDITED_APPROVED'; decidedAt: string } }
```

---

## HITLGuard — Decorator de Proteção

```typescript
// application/hitl/HITLGuard.ts
// Aplicar em TODA ação externa antes de executar

class HITLGuard {
  async requireApproval(
    actionType: ActionType,
    context: HITLContext,
    payload: Record<string, unknown>,
    executeFn: () => Promise<void>
  ): Promise<void> {
    // 1. Mascarar PII do payload
    const maskedPayload = this.masker.mask(payload);

    // 2. Criar HITL
    const hitl = HITLApproval.create({
      operatorId: context.operatorId,
      agentId: context.agentId,
      subAgentId: context.subAgentId,
      actionType,
      contextType: context.contextType,
      contextId: context.contextId,
      payloadPreview: maskedPayload,
      payloadFullRef: await this.vault.store(payload),  // vault criptografado
      expiresAt: new Date(Date.now() + this.getTimeout(actionType) * 60000),
      correlationId: context.correlationId,
    });

    await this.hitlRepo.save(hitl);
    const events = hitl.pullEvents();
    await this.eventBus.publishAll(events);

    // 3. Notificar operador
    const telegramMessageId = await this.telegramBot.notifyOperator(hitl);
    await this.hitlRepo.updateTelegramMessageId(hitl.id, telegramMessageId);

    // 4. Aguardar decisão (via webhook do Telegram ou polling da API)
    // O executeFn será chamado pelo HITLDecisionHandler quando aprovado
    // Este método é ASSÍNCRONO por natureza — não bloqueia
    await this.registerPendingExecution(hitl.id, executeFn);
  }

  private getTimeout(actionType: ActionType): number {
    const timeouts: Record<string, number> = {
      APPROVE_LEAD_LIST:     120,
      SEND_EXTERNAL_MESSAGE: 60,
      SEND_PROPOSAL:         60,
      APPROVE_MOCKUP:        180,
      APPROVE_STAGING:       120,
      DEPLOY_PRODUCTION:     60,
      APPROVE_BRIEFING:      60,
      SEND_DELIVERY:         30,
    };
    return timeouts[actionType] ?? 60;
  }
}
```

---

## HITLDecisionHandler — Event Handler

```typescript
// application/hitl/HITLDecisionHandler.ts
// Executado quando HITLApprovalDecided event é publicado

class HITLDecisionHandler {
  async handle(event: DomainEvent<HITLDecidedPayload>): Promise<void> {
    const { approvalId, decision, editedPayload } = event.payload;

    if (decision === 'REJECTED' || decision === 'EXPIRED') {
      await this.handleRejection(approvalId);
      return;
    }

    // APPROVED ou EDITED_APPROVED → executar a ação
    const pendingExecution = await this.pendingExecutions.get(approvalId);
    if (!pendingExecution) {
      this.logger.warn({ approvalId }, 'hitl_no_pending_execution');
      return;
    }

    try {
      if (decision === 'EDITED_APPROVED' && editedPayload) {
        await pendingExecution.executeWithPayload(editedPayload);
      } else {
        await pendingExecution.execute();
      }

      await this.auditLog.record('HITL_ACTION_EXECUTED', {
        approvalId,
        decision,
        correlationId: event.correlationId,
      });
    } catch (error) {
      this.logger.error({ approvalId, error }, 'hitl_execution_failed');
      await this.notifyOperatorOfFailure(approvalId, error);
    } finally {
      await this.pendingExecutions.remove(approvalId);
    }
  }
}
```

---

## Testes Obrigatórios

```typescript
describe('HITLApproval', () => {
  describe('approve()', () => {
    it('deve aprovar HITL PENDING e emitir HITLApprovalDecided')
    it('deve lançar DomainError quando HITL já APPROVED')
    it('deve lançar DomainError quando HITL EXPIRED')
    it('deve registrar decidedAt com timestamp correto')
  });

  describe('expire()', () => {
    it('deve expirar HITL PENDING após timeout')
    it('deve emitir HITLExpired event')
    it('deve lançar DomainError quando HITL já decidido')
  });
});

describe('HITLPayloadMasker', () => {
  it('deve mascarar email completamente')
  it('deve mascarar telefone completamente')
  it('deve truncar mensagem em 150 chars')
  it('deve preservar businessName integralmente')
  it('deve mascarar campos aninhados recursivamente')
  it('deve adicionar _full_in_vault: true para campos truncados')
});

describe('Security: HITL obrigatório', () => {
  it('deve bloquear envio de WhatsApp sem HITL → 403 HITL_REQUIRED')
  it('deve bloquear deploy sem HITL aprovado → 403 HITL_REQUIRED')
  it('deve executar ação após HITL aprovado')
  it('deve não executar ação após HITL rejeitado')
  it('deve não executar ação após HITL expirado')
});
```

---

## Critérios de Aceite Finais

- [ ] HITL criado antes de qualquer ação externa — sem exceção
- [ ] Operador recebe notificação Telegram com botões inline
- [ ] Aprovação via botão Telegram funciona sem abrir o painel
- [ ] Timeout automático após período configurado
- [ ] PII mascarado no payloadPreview (email e telefone nunca visíveis)
- [ ] Mensagem Telegram atualizada após decisão (aprovado/rejeitado/expirado)
- [ ] Audit log registra toda decisão com operatorId e timestamp
- [ ] HITL já decidido retorna 409
- [ ] HITL expirado retorna 410
