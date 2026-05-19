# ADR-007: Modelo de negócio e estratégia de precificação

**Status:** Aceito  
**Data:** 2026-05-09  
**Deciders:** Produto  
**Tags:** negócio, precificação, cobrança, receita, pricing-engine

---

## Contexto

O operador inicia o projeto com caixa limitado, suficiente apenas para cobrir os custos
de prospecção. Sem um modelo de cobrança correto:

- Pode fechar vendas sem caixa para entregar o serviço
- Pode entregar serviços e ter inadimplência
- Pode subestimar custos de produção (tokens LLM, deploy, tempo)

Três questões precisam ser endereçadas simultaneamente:

1. **Quando cobrar** — antes ou depois da entrega?
2. **Quanto cobrar** — qual a composição do preço?
3. **Como o agente calcula o preço** — manual ou dinâmico?

---

## Decisão

### 1. Cobrança 100% upfront como padrão do MVP

O agente Closer nunca confirma a contratação sem pagamento processado.
O fluxo é: proposta aceita → link de pagamento gerado automaticamente → pagamento
confirmado via webhook → Builder acionado.

Justificativa: operador sem caixa não pode absorver inadimplência. Mercado de sites
para pequenos negócios já opera com adiantamento — não é percebido como anormal pelo cliente.

**Modelos de cobrança disponíveis:**

| Modelo                       | Quando usar                        | Risco            |
| ---------------------------- | ---------------------------------- | ---------------- |
| 100% upfront                 | Padrão MVP, clientes desconhecidos | Baixo            |
| 50/50 (entrada + entrega)    | Projetos acima de R$ 1.500         | Médio            |
| Upfront + recorrência mensal | Qualquer cliente — recomendado     | Baixo + LTV alto |
| Assinatura mensal            | Clientes fidelizados, escala v2    | Médio            |

### 2. Engine de precificação como Domain Service

A lógica de cálculo de preço é um Domain Service puro — sem side effects, testável,
versionado em arquivo separado. O agente Closer **nunca calcula preço no prompt** —
sempre chama o PricingEngine via tool/skill.

```typescript
// Domain Service — sem dependências externas
class PricingEngine {
  calculate(briefing: ClientBriefing, costs: OperationalCosts): PricingResult {
    let price = SERVICE_BASE_PRICES[briefing.serviceType];

    // Complexidade
    const extraPages = Math.max(0, briefing.pageCount - 3);
    price += extraPages * PAGE_PRICE;

    // Urgência
    if (briefing.deliveryDays <= 2) price *= 1.5;
    else if (briefing.deliveryDays <= 5) price *= 1.25;

    // Extras
    if (briefing.includeCopywriting) price += ADDON_PRICES.copywriting;
    if (briefing.includeIntegrations) price += ADDON_PRICES.integrations;
    if (briefing.includeWhatsApp) price += ADDON_PRICES.whatsapp;
    if (briefing.includeSEO) price += ADDON_PRICES.seo;

    // Taxa do meio de pagamento (repassada ao cliente)
    const paymentFee = price * (PAYMENT_FEES[briefing.paymentMethod] / 100);
    price += paymentFee;

    // Safety margin sobre custo operacional
    const operationalCost = costs.tokens + costs.deploy + costs.prospecting;
    const minPrice = operationalCost * SAFETY_MARGIN_MULTIPLIER; // 1.3x mínimo

    // Aprovação humana obrigatória acima de R$ 5.000
    const requiresHITL = price > 5000;

    return {
      basePrice: SERVICE_BASE_PRICES[briefing.serviceType],
      extras: price - SERVICE_BASE_PRICES[briefing.serviceType],
      paymentFee,
      total: Math.max(price, minPrice),
      requiresHITL,
      composition: this.buildComposition(briefing, costs),
    };
  }
}
```

### 3. PricingIntelligence: custos operacionais atualizados via scraping

Um job agendado semanal (PriceCrawler) mantém os custos de ferramentas atualizados:

```
Fontes monitoradas:
  - platform.openai.com/pricing
  - anthropic.com/pricing
  - groq.com/pricing
  - vercel.com/pricing
  - netlify.com/pricing
  - mercadopago.com.br/developers (taxas gateway)

Estratégia de fallback:
  Se scraper falhar → usar último valor cacheado
  Se cache > 30 dias → alertar operador via Telegram
  Nunca bloquear venda por falha de atualização de custo
```

O Context7 MCP é usado complementarmente para consultar documentação técnica de APIs
de pricing (não as páginas de marketing).

### 4. Recorrência como motor de receita previsível

Todo site entregue inclui oferta de "manutenção + hospedagem" por R$ 97–197/mês.
O agente Closer apresenta a recorrência **como parte da proposta inicial**, não como upsell posterior.

Projeção: com conversão de 60% dos clientes para recorrência:

- 10 clientes: R$ 970–1.970/mês de receita previsível
- 30 clientes: R$ 2.910–5.910/mês antes de prospectar o cliente 31

### 5. Tabela de preços base (configurável pelo operador)

```typescript
export const SERVICE_BASE_PRICES: Record<ServiceType, Money> = {
  LANDING_PAGE: Money.BRL(800),
  INSTITUTIONAL: Money.BRL(1400),
  ECOMMERCE: Money.BRL(2800),
  BLOG_PORTFOLIO: Money.BRL(1800),
};

export const PAYMENT_FEES: Record<PaymentMethod, number> = {
  PIX: 0,
  BOLETO: 2.5,
  CREDIT_1X: 4.5,
  CREDIT_12X: 9.5,
};

export const ADDON_PRICES = {
  copywriting: Money.BRL(300),
  integrations: Money.BRL(200),
  whatsapp: Money.BRL(120),
  seo: Money.BRL(250),
  hosting_year: Money.BRL(350),
};

export const MONTHLY_MAINTENANCE = {
  small: Money.BRL(97), // Sites até R$ 1.200
  medium: Money.BRL(147), // Sites R$ 1.200–2.500
  large: Money.BRL(197), // Sites acima de R$ 2.500
};
```

---

## Consequências

### Positivas

- Zero risco de trabalhar sem pagamento — caixa sempre positivo
- PricingEngine testável unitariamente — sem prompt frágil
- Custos atualizados automaticamente — margem nunca surpresa
- Recorrência transforma vendas pontuais em receita previsível

### Negativas

- 100% upfront pode afastar clientes acostumados com pagamento na entrega
- Scraper de preços pode quebrar quando plataformas redesenham páginas
- Valores hardcoded precisam de mecanismo de atualização pelo operador via UI

### Mitigações

- Oferecer garantia de satisfação de 7 dias (direito legal — CDC Art. 49) para reduzir resistência ao upfront
- Alertas automáticos quando scraper falha há mais de 7 dias
- UI de edição de tabela de preços no painel do operador (não requer código)

---

## Nota legal

Pagamentos processados antes do início do serviço: verificar conformidade com CDC
Art. 49 (direito de arrependimento em 7 dias para contratos à distância). Operador
deve ter política de cancelamento explícita no contrato digital (clickwrap).
Consultar advogado especializado em direito digital antes do lançamento.

---

## 📋 Status de Implementação (2026-05-09)

**Implementação:** Planejada — **Fase 10** do `task.md`

| Componente                              | Status                  |
| --------------------------------------- | ----------------------- |
| `PricingEngine` (Domain Service)        | ⏳ Pendente — Fase 10.1 |
| `Money` (Value Object)                  | ⏳ Pendente — Fase 10.1 |
| `pricing_config` (tabela DB)            | ⏳ Pendente — Fase 10.2 |
| `GetQuoteHandler` + rota `/deals/quote` | ⏳ Pendente — Fase 10.3 |
| Testes unitários PricingEngine          | ⏳ Pendente — Fase 10.4 |
