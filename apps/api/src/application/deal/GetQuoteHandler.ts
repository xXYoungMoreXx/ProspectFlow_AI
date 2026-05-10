import { PricingEngine, PricingConfig } from '../../domain/pricing/PricingEngine.js';
import { ClientBriefing, OperationalCosts } from '../../domain/pricing/PricingModels.js';
import { Money } from '../../domain/pricing/Money.js';
import { CreateQuoteDTO } from './GetQuoteSchema.js';

export class GetQuoteHandler {
  private pricingEngine: PricingEngine;

  constructor() {
    this.pricingEngine = new PricingEngine();
  }

  public async execute(dto: CreateQuoteDTO) {
    // 1. Converter DTO para objetos de domínio
    const addons = dto.addons.map((a: { name: string; priceCents: number }) => ({
      name: a.name,
      price: Money.BRL(a.priceCents)
    }));

    const briefing = new ClientBriefing(
      dto.serviceType,
      dto.pageCount,
      dto.deliveryDays,
      dto.paymentMethod,
      addons
    );

    // 2. Buscar/Calcular Custos Operacionais (Hardcoded para MVP, idealmente DB)
    const operationalCosts = new OperationalCosts(
      Money.BRL(1000), // R$ 10.00 Tokens LLM
      Money.BRL(500),  // R$ 5.00 Deploy 
      Money.BRL(200)   // R$ 2.00 Busca de lead
    );

    // 3. Buscar configuração do operador (usando default por enquanto)
    const config = PricingConfig.default();

    // 4. Calcular preço final
    const result = this.pricingEngine.calculate(briefing, operationalCosts, config);

    // 5. Retornar resposta
    return {
      basePriceCents: result.basePrice.getCents(),
      extrasCents: result.extras.getCents(),
      paymentFeeCents: result.paymentFee.getCents(),
      totalCents: result.total.getCents(),
      requiresHITL: result.requiresHITL,
      safetyMarginApplied: result.safetyMarginApplied,
      totalFormatted: result.total.format()
    };
  }
}
