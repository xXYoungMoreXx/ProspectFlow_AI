# SPEC-04: Closer Agent — Vendas e Negociação

> Versão: 2.0.0 | Fase: 1 | Dependências: SPEC-03 (Hunter), SPEC-09 (HITL), SPEC-11 (Messaging)

---

## Responsabilidade

Conduzir a negociação com leads qualificados do zero ao deal fechado.
Gerar outreach personalizado usando dados de enriquecimento.
Manter follow-ups automáticos com cadência configurável.
Gerar e enviar proposta comercial em PDF.

---

## Sub-agentes e Modelos

| Sub-agente | Modelo | Custo/1k | Modo | Função |
|---|---|---|---|---|
| OUTREACH_WRITER | `claude-sonnet-4-6` | ~$0.015 | sequential | 1º contato personalizado |
| CONV_HANDLER | `claude-sonnet-4-6` | ~$0.015 | sequential | Negociação e objeções |
| PROPOSAL_WRITER | `claude-sonnet-4-6` | ~$0.015 | sequential | PDF da proposta |
| DEAL_TRACKER | `ollama/llama3.2:3b` | $0.00 | sequential + cron | Follow-up automático |

---

## Fluxo Principal

```
Trigger: DomainEvent[LeadApprovedForContact]
│
├─ Carregar lead com enrichmentData completo
├─ OUTREACH_WRITER: gerar mensagem personalizada
│   └─ Usar: rating Google, anos no mercado, cidade/bairro, sem site
├─ HITL: operador aprova mensagem antes de enviar
├─ Aprovado: enviar via canal preferido do lead (WhatsApp/Telegram/Email)
├─ Registrar: DomainEvent[MessageSent]
│
│  Loop de negociação (até 5 rodadas):
│  ├─ Aguardar resposta (webhook)
│  ├─ CONV_HANDLER: analisar resposta → decidir próximo passo
│  │   Casos: Interessado | Dúvida | Objeção preço | Silêncio
│  ├─ HITL: aprovar resposta (configurável — pode desativar para padrões)
│  └─ Enviar resposta
│
├─ Briefing rápido na conversa (5 perguntas essenciais)
├─ PROPOSAL_WRITER: gerar proposta com pricing_rules_v2
├─ HITL: operador aprova proposta + valor
├─ Enviar proposta PDF
│
├─ Cliente aceita → DomainEvent[DealClosed] → BriefingAgent
├─ Cliente rejeita → DealTracker agenda follow-up
└─ Silêncio → DealTracker agenda follow-up

DEAL_TRACKER (cron 09:00):
├─ Buscar leads NEGOTIATING sem contato há N dias (cadência: [3, 7, 14])
├─ Gerar follow-up contextual (Sonnet, não Ollama — qualidade importa)
├─ HITL → Enviar
└─ Após 3 tentativas sem resposta: DomainEvent[LeadLost]
```

---

## OUTREACH_WRITER — Prompt e Personalização

```python
# apps/agent-runtime/src/agents/closer/sub_agents/outreach_writer.py

SYSTEM_PROMPT = """
Você é um consultor de vendas especializado em serviços digitais para pequenos negócios.
Seu estilo é consultivo, empático e direto — não invasivo ou pressioso.
Você usa dados reais do negócio para personalizar cada mensagem.
NUNCA revele que você tem acesso a dados externos (Google Maps, CNPJ, etc.).
NUNCA mencione que é uma IA ou sistema automatizado.
Escreva em pt-BR informal mas profissional. Máximo 3 parágrafos.
"""

def build_outreach_prompt(lead: dict) -> str:
    enrichment = lead.get('enrichmentData', {})
    rating = enrichment.get('googleRating', 0)
    reviews = enrichment.get('googleReviewsCount', 0)
    city = enrichment.get('city', '')
    neighborhood = enrichment.get('neighborhood', '')
    years = enrichment.get('yearsInBusiness', 0)
    has_website = enrichment.get('hasWebsite', False)

    context_parts = []
    if rating >= 4.0 and reviews >= 20:
        context_parts.append(f"Vi que vocês têm nota {rating} com {reviews}+ avaliações — impressionante!")
    if years >= 2:
        context_parts.append(f"Com {years} anos no mercado, vocês claramente construíram algo sólido.")
    if neighborhood:
        context_parts.append(f"Aqui no {neighborhood}, em {city}")
    if not has_website:
        context_parts.append("Mas notei que vocês ainda não têm um site profissional")

    return f"""
Crie uma mensagem de primeiro contato para o seguinte negócio:

NEGÓCIO: {lead.get('businessName', '')}
SEGMENTO: {lead.get('niche', '')}
CANAL: {lead.get('preferredChannel', 'whatsapp')}
DONO: {lead.get('contactName', '')}

CONTEXTO DISPONÍVEL:
{chr(10).join(f'- {p}' for p in context_parts)}

A mensagem deve:
1. Mencionar algo específico do negócio (usar o contexto acima)
2. Identificar o problema (sem site ou site ruim)
3. Propor valor (site profissional em X dias)
4. Ter um CTA claro e simples
5. Ter tom amigável, não de vendedor

NÃO use: "Olá tudo bem?", "como vai você?", saudações genéricas.
COMECE diretamente com algo relevante sobre o negócio.
"""
```

---

## CONV_HANDLER — Detecção de Intenção

```python
# apps/agent-runtime/src/agents/closer/sub_agents/conv_handler.py

INTENT_DETECTION_PROMPT = """
Analise a mensagem do cliente e classifique a intenção:

INTENÇÕES POSSÍVEIS:
- INTERESTED: Cliente demonstra interesse real ("quanto custa?", "me conta mais", "quero sim")
- DOUBT: Dúvida específica sobre o serviço ("funciona para meu tipo de negócio?")
- PRICE_OBJECTION: Objeção de preço ("achei caro", "não tenho budget agora")
- SILENCE: Não respondeu (mensagem enviada há mais de 48h sem resposta)
- REJECTION: Rejeição clara ("não tenho interesse", "obrigado mas não")
- SCHEDULING: Quer agendar reunião ("podemos conversar?", "tem um horário?")
- DEAL_CLOSED: Aceitou a proposta ("pode fazer", "vamos em frente", "topei")

Responda APENAS com o JSON:
{ "intent": "INTERESTED|DOUBT|PRICE_OBJECTION|SILENCE|REJECTION|SCHEDULING|DEAL_CLOSED",
  "confidence": 0.0-1.0,
  "key_phrase": "frase exata que indica a intenção" }
"""

RESPONSES_BY_INTENT = {
    'PRICE_OBJECTION': """
Entendo que o investimento precisa fazer sentido. Pensa assim:
um site profissional trabalha 24h por dia por você — enquanto você atende clientes,
ele está trazendo novos. {VALUE_PROPOSITION}
Posso fazer em {INSTALLMENTS}? O que acha?
""",
    'DOUBT': """
Boa pergunta! {SPECIFIC_ANSWER}.
Já fiz sites para {SIMILAR_BUSINESS} e o resultado foi {RESULT}.
Quer ver um exemplo?
""",
}
```

---

## PROPOSAL_WRITER — Geração de PDF

```python
# O PDF é gerado pelo sub-agente usando o pricing_rules_v2.js
# via chamada HTTP à API Node.js

class ProposalWriterSubAgent(BaseSubAgent):
    def build_task(self, input: dict) -> Task:
        briefing = input['quickBriefing']
        lead = input['lead']
        pricing = input['pricing']  # já calculado pelo pricing_calculator skill

        return Task(
            description=f"""
Crie uma proposta comercial profissional para:

CLIENTE: {lead['contactName']} — {lead['businessName']}
SERVIÇO: Site {briefing['siteType']} com {briefing['pages']} páginas

INVESTIMENTO: R$ {pricing['total']:,.2f}
BREAKDOWN:
{chr(10).join(f"  - {item['item']}: R$ {item['value']:,.2f}" for item in pricing['breakdown'])}

PRAZO: {briefing['deliveryDays']} dias úteis

A proposta deve incluir:
1. Apresentação (quem somos, por que nós)
2. O que está incluído (lista detalhada)
3. O que não está incluído (sem surpresas)
4. Prazo e processo de entrega
5. Investimento com breakdown
6. Garantia e suporte
7. Como começar (próximos passos)

Tom: profissional mas acessível. Sem jargão técnico.
Formato: Markdown para conversão em PDF.
""",
            expected_output="Proposta completa em Markdown",
            agent=self.crewai_agent,
        )
```

---

## DEAL_TRACKER — Cadência de Follow-up

```python
# apps/agent-runtime/src/agents/closer/sub_agents/deal_tracker.py
# Modelo: Ollama Llama 3.2 3B (custo zero — decisões simples)
# Executa via cron BullMQ todos os dias às 09:00

class DealTrackerSubAgent(BaseSubAgent):
    llm_model = 'ollama/llama3.2:3b'

    CADENCE_DAYS = [3, 7, 14]  # dias após último contato

    async def run_daily_check(self) -> None:
        # Buscar leads que precisam de follow-up
        pending = await self.api_client.get('/leads/pending-followups')

        for lead in pending['data']:
            days_since_contact = lead['daysSinceLastContact']
            attempt = lead['followUpCount']

            if attempt >= len(self.CADENCE_DAYS):
                # Esgotou todas as tentativas → marcar como perdido
                await self.api_client.patch(f'/leads/{lead["id"]}/status',
                                            {'status': 'LOST', 'reason': 'followup_exhausted'})
                continue

            next_day = self.CADENCE_DAYS[attempt]
            if days_since_contact < next_day:
                continue  # Ainda não é hora

            # Gerar follow-up (usando Sonnet para qualidade, não Ollama)
            followup_msg = await self.generate_followup(lead)

            # HITL antes de enviar
            await self.api_client.create_hitl({
                'actionType': 'SEND_EXTERNAL_MESSAGE',
                'contextId': lead['id'],
                'payload': { 'message': followup_msg, 'channel': lead['preferredChannel'] }
            })

    async def generate_followup(self, lead: dict) -> str:
        # Templates por tentativa
        templates = [
            # Tentativa 1 (3 dias): gentil, verifica interesse
            f"Oi {lead['contactName']}, tudo certo? Vi que não consegui resposta. "
            f"Ainda tem interesse em um site para {lead['businessName']}? "
            f"Só me confirma e te mando mais detalhes 😊",

            # Tentativa 2 (7 dias): social proof + urgência suave
            f"Oi {lead['contactName']}! Essa semana terminei 2 sites para "
            f"negócios como o seu. Ficou incrível! "
            f"Ainda tenho 1 vaga nesse mês — quer aproveitar?",

            # Tentativa 3 (14 dias): última tentativa + oferta
            f"Oi {lead['contactName']}, última mensagem da minha parte 🙂 "
            f"Caso mude de ideia sobre o site pro {lead['businessName']}, é só chamar. "
            f"Boa sorte com o negócio!",
        ]
        return templates[lead['followUpCount']]
```

---

## Regras de Precificação (pricing_rules_v2.js)

```javascript
// apps/api/src/infrastructure/pricing/pricing_rules_v2.js
// Executado pelo PROPOSAL_WRITER skill via Node.js vm.Script

export function calculatePrice(briefing) {
  const BASE_PRICE = 800; // R$
  let price = BASE_PRICE;
  const breakdown = [];

  // Multiplicador por tipo
  const TYPE_MULT = {
    landing: 0.8, institutional: 1.0, scheduling: 1.3,
    portfolio: 1.1, ecommerce: 2.0,
  };
  price *= (TYPE_MULT[briefing.siteType] ?? 1.0);
  breakdown.push({ item: `Tipo: ${briefing.siteType}`, value: Math.round(price) });

  // Páginas extras (acima de 5)
  if (briefing.pages?.length > 5) {
    const extra = (briefing.pages.length - 5) * 120;
    price += extra;
    breakdown.push({ item: `Páginas extras (${briefing.pages.length - 5}×R$120)`, value: extra });
  }

  // Adicionais
  const addons = [
    { condition: briefing.hasEcommerce,    price: 600, label: 'E-commerce' },
    { condition: briefing.hasBlog,         price: 200, label: 'Blog' },
    { condition: briefing.hasCustomForm,   price: 150, label: 'Formulário customizado' },
    { condition: briefing.hasScheduling,   price: 250, label: 'Sistema de agendamento (Cal.com)' },
    { condition: briefing.needsCopywriting,price: 300, label: 'Copywriting profissional' },
  ];

  for (const addon of addons) {
    if (addon.condition) {
      price += addon.price;
      breakdown.push({ item: addon.label, value: addon.price });
    }
  }

  // Urgência
  if (briefing.deliveryDays < 3) {
    price *= 1.4;
    breakdown.push({ item: 'Urgência (<3 dias úteis)', value: '+40%' });
  }

  // Desconto por volume (operador pode configurar)
  const discount = briefing.discountPct ?? 0;
  if (discount > 0) {
    const discountValue = Math.round(price * (discount / 100));
    price -= discountValue;
    breakdown.push({ item: `Desconto (${discount}%)`, value: -discountValue });
  }

  price = Math.round(price);

  return {
    price,
    breakdown,
    requiresHITL: price > 5000,
    requiresHITLReason: price > 5000 ? 'Valor acima de R$5.000 requer aprovação manual' : null,
  };
}
```

---

## Domain Events Emitidos

```typescript
// Todos pelo Closer Agent
MessageSent           // { leadId, channel, messagePreview }
LeadContacted         // { leadId, attemptNumber }
ProposalGenerated     // { leadId, dealId, totalBrl }
ProposalSent          // { leadId, dealId }
DealClosed            // { dealId, leadId, totalBrl }
DealCancelled         // { dealId, reason }
FollowUpScheduled     // { leadId, nextDate, attempt }
FollowUpSent          // { leadId, attempt, channel }
FollowUpExhausted     // { leadId, totalAttempts }
MeetingScheduled      // { leadId, dealId, calBookingUid }
```

---

## HTTP Endpoints

```
POST /api/v1/deals
  Body: { leadId, serviceType: 'WEBSITE' }
  Response 201: { data: Deal }

POST /api/v1/deals/:id/cancel
  Body: { reason: string }
  Response 200: { data: Deal }

POST /api/v1/deals/:id/schedule-meeting
  Body: { eventTypeId?: string }
  Response 200: { data: { bookingLink: string, uid: string } }

GET  /api/v1/leads/:id/follow-ups
  Response 200: { data: FollowUpHistory[] }
```

---

## Testes Obrigatórios

```python
# Python
def test_outreach_uses_google_rating_naturally()
def test_outreach_does_not_mention_google_maps_or_automation()
def test_outreach_personalizes_with_business_name()
def test_conv_handler_detects_price_objection()
def test_conv_handler_detects_deal_closed()
def test_deal_tracker_schedules_followup_after_3_days()
def test_deal_tracker_marks_lost_after_3_attempts()
def test_proposal_calculates_price_correctly_for_ecommerce()
def test_proposal_applies_urgency_multiplier()
def test_outreach_requires_hitl_before_sending()
```

```typescript
// TypeScript
describe('pricing_rules_v2') {
  it('site institucional = R$800')
  it('ecommerce = R$800 × 2 = R$1.600')
  it('scheduling = R$800 × 1.3 + R$250 agendamento = R$1.290')
  it('urgência < 3 dias aplica multiplicador de 1.4')
  it('acima de R$5.000 marca requiresHITL = true')
  it('desconto 10% reduz o preço corretamente')
}
```

---

## Critérios de Aceite

- [ ] Outreach gerado personaliza com dados reais do negócio (rating, cidade, sem site)
- [ ] Outreach NUNCA menciona "Google Maps", "automação" ou "IA"
- [ ] HITL criado antes de enviar qualquer mensagem
- [ ] DealTracker roda diariamente às 09:00 via BullMQ cron
- [ ] Cadência [3, 7, 14] dias respeitada corretamente
- [ ] Após 3 follow-ups sem resposta: lead marcado como LOST
- [ ] Proposta PDF gerada com breakdown de preços
- [ ] Valor > R$5.000 bloqueia para HITL especial
- [ ] Deal fechado emite DealClosed → BriefingAgent recebe
