import { Money } from './Money.js';
import { ClientBriefing, OperationalCosts, PricingResult, ServiceType, PaymentMethod } from './PricingModels.js';

export class PricingConfig {
  constructor(
    public readonly basePrices: Record<ServiceType, Money>,
    public readonly pricePerPage: Money,
    public readonly hitlThreshold: Money,
    public readonly urgencyMultipliers: {
      urgent: number;    // <= 2 days
      standard: number;  // > 2 days
    },
    public readonly paymentFees: Record<PaymentMethod, number>
  ) {}

  public static default(): PricingConfig {
    return new PricingConfig(
      {
        LANDING_PAGE: Money.fromReal(1500),
        SITE_INSTITUCIONAL: Money.fromReal(2500),
        ECOMMERCE: Money.fromReal(5000),
        PORTFOLIO: Money.fromReal(2000),
      },
      Money.fromReal(300), // R$ 300 por página extra
      Money.fromReal(5000), // R$ 5.000 (HITL Threshold)
      { urgent: 1.5, standard: 1.0 },
      { PIX: 0, CREDIT_CARD_1X: 0.04, CREDIT_CARD_12X: 0.095 }
    );
  }
}

/**
 * Domain Service: PricingEngine
 * Encapsula a regra de negócio complexa de formação de preço.
 */
export class PricingEngine {
  public calculate(
    briefing: ClientBriefing,
    operationalCosts: OperationalCosts,
    config: PricingConfig = PricingConfig.default()
  ): PricingResult {
    
    // 1. Preço Base
    const basePrice = config.basePrices[briefing.serviceType];
    
    // 2. Extras (Páginas adicionais + Addons)
    const extraPagesCost = briefing.pageCount > 1 
      ? config.pricePerPage.multiply(briefing.pageCount - 1)
      : Money.BRL(0);
      
    const addonsCost = briefing.addons.reduce(
      (acc, addon) => acc.add(addon.price), 
      Money.BRL(0)
    );
    
    let extras = extraPagesCost.add(addonsCost);

    // 3. Multiplicador de Urgência
    const multiplier = briefing.deliveryDays <= 2 
      ? config.urgencyMultipliers.urgent 
      : config.urgencyMultipliers.standard;
      
    let calculatedTotal = basePrice.add(extras).multiply(multiplier);

    // 4. Margem de Segurança Operacional (Mínimo de 30% sobre custo)
    const totalCost = operationalCosts.getTotalCost();
    const minSafePrice = totalCost.multiply(1.3);
    
    let safetyMarginApplied = false;
    if (minSafePrice.greaterThan(calculatedTotal)) {
      calculatedTotal = minSafePrice;
      safetyMarginApplied = true;
    }

    // 5. Taxas de Pagamento
    const feeRate = config.paymentFees[briefing.paymentMethod];
    const paymentFee = calculatedTotal.multiply(feeRate);
    
    const finalTotal = calculatedTotal.add(paymentFee);
    
    // 6. Escalada de Risco (HITL)
    const requiresHITL = finalTotal.greaterThan(config.hitlThreshold);

    return new PricingResult(
      basePrice,
      extras,
      paymentFee,
      finalTotal,
      requiresHITL,
      safetyMarginApplied
    );
  }
}
