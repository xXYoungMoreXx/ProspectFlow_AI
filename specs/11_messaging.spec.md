# SPEC-11: Messaging — WhatsApp + Telegram

> Versão: 2.0.0 | Fase: 1 | Dependências: SPEC-09 (HITL)

---

## Arquitetura de Canais

```
┌─────────────────────────────────────────────────────┐
│                MessagingRouter                       │
│  route(lead.preferredChannel) → adapter correto      │
└──────┬──────────────┬──────────────┬────────────────┘
       │              │              │
  WHATSAPP       TELEGRAM        EMAIL
(Evolution API) (Bot 2 Sales)  (Brevo SMTP)
       │              │
  Bot 1 HITL    Bot 2 Sales
  (operador)    (leads/clientes)
```

### Dois Bots Telegram — papéis distintos

| Bot         | Propósito                       | Destinatário     | Auth                       |
| ----------- | ------------------------------- | ---------------- | -------------------------- |
| Bot 1 HITL  | Notificações + aprovação inline | Operador         | `TELEGRAM_HITL_BOT_TOKEN`  |
| Bot 2 Sales | Canal de vendas alternativo     | Leads e clientes | `TELEGRAM_SALES_BOT_TOKEN` |

---

## Interface de Domínio

```typescript
// infrastructure/messaging/MessagingPort.ts

interface MessagingPort {
  sendText(to: string, text: string): Promise<MessageId>;
  sendDocument(
    to: string,
    file: Buffer,
    filename: string,
    caption?: string,
  ): Promise<MessageId>;
  sendImage(to: string, imageUrl: string, caption?: string): Promise<MessageId>;
  listenWebhook(handler: MessageHandler): void;
  getDeliveryStatus(messageId: string): Promise<MessageStatus>;
}

type MessageHandler = (message: IncomingMessage) => Promise<void>;

interface IncomingMessage {
  id: string;
  from: string; // número/chatId do remetente
  text?: string;
  documentUrl?: string;
  channel: "WHATSAPP" | "TELEGRAM";
  timestamp: Date;
}
```

---

## WhatsApp (Evolution API)

### Anti-spam e Humanização

```typescript
// infrastructure/messaging/WhatsAppAdapter.ts

class WhatsAppAdapter implements MessagingPort {
  // Configurações de anti-ban
  private readonly MAX_MESSAGES_PER_DAY = 50;
  private readonly MIN_DELAY_MS = 1500;
  private readonly MAX_DELAY_MS = 4000;

  async sendText(to: string, text: string): Promise<MessageId> {
    // 1. Verificar rate limit diário (Redis)
    const dayKey = `wpp:daily:${to}:${new Date().toISOString().slice(0, 10)}`;
    const count = await this.cache.increment(dayKey, 86400);
    if (count > this.MAX_MESSAGES_PER_DAY) {
      throw new QuotaExceededError("WhatsApp", this.MAX_MESSAGES_PER_DAY);
    }

    // 2. Delay humanizado
    const delay =
      this.MIN_DELAY_MS +
      Math.random() * (this.MAX_DELAY_MS - this.MIN_DELAY_MS);
    await sleep(delay);

    // 3. Typing indicator (simula digitação)
    await this.sendTypingIndicator(to);
    await sleep(text.length * 30); // ~30ms por char (simula digitação)

    // 4. Enviar
    const response = await fetch(
      `${this.baseUrl}/message/sendText/${this.instanceName}`,
      {
        method: "POST",
        headers: { apikey: this.apiKey, "Content-Type": "application/json" },
        body: JSON.stringify({ number: to, text }),
        signal: AbortSignal.timeout(15_000),
      },
    );

    if (!response.ok) {
      const error = await response.text();
      throw new ExternalServiceError("Evolution API", response.status, error);
    }

    const data = await response.json();

    // 5. Audit log (sem o conteúdo da mensagem — PII)
    await this.auditLog.record("WHATSAPP_MESSAGE_SENT", {
      to: to.slice(0, 5) + "***", // mascarar número
      messageId: data.key.id,
      channel: "WHATSAPP",
    });

    return new MessageId(data.key.id);
  }

  private async sendTypingIndicator(to: string): Promise<void> {
    await fetch(`${this.baseUrl}/chat/sendPresence/${this.instanceName}`, {
      method: "POST",
      headers: { apikey: this.apiKey },
      body: JSON.stringify({ number: to, presence: "composing" }),
    }).catch(() => {}); // Não falhar se indicator falhar
  }

  listenWebhook(handler: MessageHandler): void {
    // Registrar endpoint: POST /webhooks/whatsapp
    // Evolution API envia eventos para este endpoint
    this.webhookRegistry.register("/webhooks/whatsapp", async (body) => {
      if (body.event !== "messages.upsert") return;
      if (body.data.key.fromMe) return; // Ignorar mensagens enviadas por nós

      await handler({
        id: body.data.key.id,
        from: body.data.key.remoteJid.replace("@s.whatsapp.net", ""),
        text: body.data.message?.conversation,
        channel: "WHATSAPP",
        timestamp: new Date(body.date_time),
      });
    });
  }
}
```

### Proteção Anti-ban

```typescript
// Configuração completa no YAML do agente Closer:
anti_ban:
  max_messages_per_day: 50           # Por número de destino
  min_delay_ms: 1500                 # Delay mínimo humanizado
  max_delay_ms: 4000                 # Delay máximo
  typing_indicator: true             # Simular digitação
  typing_speed_ms_per_char: 30       # Velocidade de digitação
  max_new_contacts_per_day: 20       # Novos números/dia
  # Fallback automático para Telegram se banido
  fallback_channel_on_ban: TELEGRAM
  # Alertar operador se Evolution retornar aviso
  alert_on_warning_response: true
```

---

## Telegram Bot 1 (HITL — Operador)

```typescript
// infrastructure/messaging/TelegramHITLBot.ts
// (Spec completa em SPEC-09 — aqui apenas o complemento)

// Webhook endpoint: POST /webhooks/telegram/hitl
// Processa:
//   - callback_query (botões inline: approve/reject/edit)
//   - Comandos: /status, /pending

class TelegramHITLBot {
  // Comando /pending — listar aprovações pendentes
  async handlePendingCommand(chatId: string): Promise<void> {
    const pending = await this.hitlRepo.findPending();
    if (pending.length === 0) {
      await this.sendMessage(chatId, "✅ Nenhuma aprovação pendente.");
      return;
    }

    const list = pending
      .map(
        (h, i) =>
          `${i + 1}. ${h.actionType} — expira em ${h.timeRemainingMinutes}min`,
      )
      .join("\n");

    await this.sendMessage(
      chatId,
      `📋 *${pending.length} aprovações pendentes:*\n\n${list}\n\n` +
        `Acesse: ${env.FRONTEND_URL}/hitl`,
    );
  }

  // Notificação de alerta de banimento WhatsApp
  async alertWhatsAppBan(instanceName: string): Promise<void> {
    await this.sendMessage(
      env.TELEGRAM_OPERATOR_CHAT_ID,
      `🚨 *ALERTA: WhatsApp possivelmente banido!*\n\n` +
        `Instância: \`${instanceName}\`\n` +
        `A Evolution API retornou aviso de conta.\n\n` +
        `Ação: O canal foi trocado para Telegram automaticamente.\n` +
        `Verifique o WhatsApp e o runbook de recuperação.`,
    );
  }
}
```

---

## Telegram Bot 2 (Sales — Leads/Clientes)

```typescript
// infrastructure/messaging/TelegramSalesBot.ts

class TelegramSalesBot implements MessagingPort {
  async sendText(chatId: string, text: string): Promise<MessageId> {
    const response = await fetch(
      `https://api.telegram.org/bot${this.botToken}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          parse_mode: "Markdown",
        }),
        signal: AbortSignal.timeout(10_000),
      },
    );

    const data = await response.json();
    if (!data.ok) {
      throw new ExternalServiceError(
        "Telegram API",
        data.error_code,
        data.description,
      );
    }

    return new MessageId(data.result.message_id.toString());
  }

  async sendDocument(
    chatId: string,
    file: Buffer,
    filename: string,
    caption?: string,
  ): Promise<MessageId> {
    const formData = new FormData();
    formData.append("chat_id", chatId);
    formData.append("document", new Blob([file]), filename);
    if (caption) formData.append("caption", caption);

    const response = await fetch(
      `https://api.telegram.org/bot${this.botToken}/sendDocument`,
      { method: "POST", body: formData, signal: AbortSignal.timeout(30_000) },
    );

    const data = await response.json();
    return new MessageId(data.result.message_id.toString());
  }

  listenWebhook(handler: MessageHandler): void {
    // Webhook: POST /webhooks/telegram/sales
    this.webhookRegistry.register("/webhooks/telegram/sales", async (body) => {
      const msg = body.message;
      if (!msg) return;

      await handler({
        id: msg.message_id.toString(),
        from: msg.chat.id.toString(),
        text: msg.text,
        channel: "TELEGRAM",
        timestamp: new Date(msg.date * 1000),
      });
    });
  }
}
```

---

## MessagingRouter

```typescript
// infrastructure/messaging/MessagingRouter.ts

class MessagingRouter {
  constructor(
    private readonly whatsapp: WhatsAppAdapter,
    private readonly telegramSales: TelegramSalesBot,
    private readonly email: EmailAdapter,
  ) {}

  route(lead: Lead): MessagingPort {
    switch (lead.preferredChannel) {
      case "WHATSAPP":
        return this.whatsapp;
      case "TELEGRAM":
        return this.telegramSales;
      case "EMAIL":
        return this.email;
      default:
        this.logger.warn(
          { channel: lead.preferredChannel },
          "unknown_channel_fallback_whatsapp",
        );
        return this.whatsapp;
    }
  }

  // Fallback quando WhatsApp está banido
  routeWithFallback(lead: Lead): MessagingPort {
    if (this.whatsappIsBanned) {
      return lead.preferredChannel === "EMAIL"
        ? this.email
        : this.telegramSales;
    }
    return this.route(lead);
  }
}
```

---

## Email (Brevo)

```typescript
// infrastructure/messaging/EmailAdapter.ts

class EmailAdapter implements MessagingPort {
  // Brevo: 300 e-mails/dia no plano gratuito
  // Para mais volume: upgrade para plano Starter (~€25/mês)

  async sendText(to: string, text: string): Promise<MessageId> {
    const response = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        "api-key": this.apiKey,
      },
      body: JSON.stringify({
        sender: { email: env.OPERATOR_EMAIL, name: env.OPERATOR_NAME },
        to: [{ email: to }],
        subject: "Mensagem Hefesto",
        textContent: text,
      }),
    });

    const data = await response.json();
    return new MessageId(data.messageId ?? randomUUID());
  }

  async sendDocument(
    to: string,
    file: Buffer,
    filename: string,
    caption?: string,
  ): Promise<MessageId> {
    // Enviar PDF como anexo
    const response = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: { "api-key": this.apiKey, "content-type": "application/json" },
      body: JSON.stringify({
        sender: { email: env.OPERATOR_EMAIL, name: env.OPERATOR_NAME },
        to: [{ email: to }],
        subject: caption ?? "Documento Hefesto",
        htmlContent: `<p>${caption ?? "Segue o documento em anexo."}</p>`,
        attachment: [
          {
            name: filename,
            content: file.toString("base64"),
          },
        ],
      }),
    });

    const data = await response.json();
    return new MessageId(data.messageId ?? randomUUID());
  }
}
```

---

## Webhook Setup — Configuração Inicial

```bash
# Configurar webhook do Bot HITL (Telegram)
curl "https://api.telegram.org/bot${TELEGRAM_HITL_BOT_TOKEN}/setWebhook" \
  -d "url=${API_PUBLIC_URL}/webhooks/telegram/hitl"

# Configurar webhook do Bot Sales (Telegram)
curl "https://api.telegram.org/bot${TELEGRAM_SALES_BOT_TOKEN}/setWebhook" \
  -d "url=${API_PUBLIC_URL}/webhooks/telegram/sales"

# Configurar webhook da Evolution API (WhatsApp)
curl -X POST "${EVOLUTION_API_URL}/webhook/set/${WPP_INSTANCE}" \
  -H "apikey: ${EVOLUTION_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "'${API_PUBLIC_URL}'/webhooks/whatsapp",
    "webhook_by_events": true,
    "events": ["MESSAGES_UPSERT", "MESSAGES_UPDATE"]
  }'
```

---

## Testes Obrigatórios

```typescript
describe('WhatsAppAdapter') {
  it('deve aplicar delay entre 1500ms e 4000ms')
  it('deve enviar typing indicator antes da mensagem')
  it('deve lançar QuotaExceededError acima de 50 msg/dia')
  it('deve mascarar número no audit log')
  it('deve lançar ExternalServiceError para 4xx da Evolution API')
  it('deve retornar MessageId do response da Evolution API')
  it('deve ignorar mensagens enviadas por nós (fromMe: true)')
}

describe('TelegramSalesBot') {
  it('sendText envia com parse_mode: Markdown')
  it('sendDocument envia arquivo como FormData')
  it('webhook processa mensagens do cliente corretamente')
  it('ignora updates sem message (callback_query, etc.)')
}

describe('MessagingRouter') {
  it('WHATSAPP → WhatsAppAdapter')
  it('TELEGRAM → TelegramSalesBot')
  it('EMAIL → EmailAdapter')
  it('canal desconhecido → fallback WhatsApp com warning no log')
}

describe('Security: Mensageria') {
  it('toda mensagem external requer HITL aprovado')
  it('número WhatsApp mascarado nos logs')
  it('chatId Telegram mascarado nos logs')
  it('email mascarado nos logs')
}
```

---

## Critérios de Aceite

- [ ] WhatsApp: delay humanizado (1.5–4s) antes de toda mensagem
- [ ] WhatsApp: typing indicator enviado antes da mensagem
- [ ] WhatsApp: limite de 50 msg/dia por número respeitado
- [ ] Telegram Bot 1: notificações HITL com botões inline ao operador
- [ ] Telegram Bot 2: canal de vendas funcionando com leads
- [ ] Email: PDF como anexo funcionando via Brevo
- [ ] Webhooks configurados para todos os canais
- [ ] Falha no envio → log estruturado com canal (sem PII completo)
- [ ] HITL requerido antes de qualquer envio — sem exceção
