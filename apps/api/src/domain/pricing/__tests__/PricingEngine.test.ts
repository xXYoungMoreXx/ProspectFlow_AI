import { describe, it, expect } from 'vitest';
import { PricingEngine, PricingConfig } from '../PricingEngine.js';
import { ClientBriefing, OperationalCosts } from '../PricingModels.js';
import { Money } from '../Money.js';

describe('PricingEngine', () => {
  const engine = new PricingEngine();
  const baseConfig = PricingConfig.default();
  const defaultOpsCost = new OperationalCosts(
    Money.fromReal(10), // tokens
    Money.fromReal(5),  // deploy
    Money.fromReal(2)   // prospect
  ); // Total = R$ 17.00

  it('should calculate base price for simple landing page with PIX', () => {
    const briefing = new ClientBriefing('LANDING_PAGE', 1, 7, 'PIX');
    const result = engine.calculate(briefing, defaultOpsCost, baseConfig);

    expect(result.basePrice.getCents()).toBe(150000); // R$ 1500
    expect(result.extras.getCents()).toBe(0);
    expect(result.paymentFee.getCents()).toBe(0);
    expect(result.total.getCents()).toBe(150000);
    expect(result.requiresHITL).toBe(false);
    expect(result.safetyMarginApplied).toBe(false);
  });

  it('should apply extra pages and addons correctly', () => {
    const briefing = new ClientBriefing('SITE_INSTITUCIONAL', 3, 7, 'PIX', [
      { name: 'Blog', price: Money.fromReal(500) }
    ]);
    const result = engine.calculate(briefing, defaultOpsCost, baseConfig);

    expect(result.basePrice.getCents()).toBe(250000); // R$ 2500
    // 2 extra pages * 300 = 600 + 500 addon = 1100
    expect(result.extras.getCents()).toBe(110000);
    expect(result.total.getCents()).toBe(360000); // R$ 3600
  });

  it('should apply urgency multiplier (<= 2 days)', () => {
    const briefing = new ClientBriefing('PORTFOLIO', 1, 2, 'PIX');
    const result = engine.calculate(briefing, defaultOpsCost, baseConfig);

    // R$ 2000 * 1.5 = R$ 3000
    expect(result.total.getCents()).toBe(300000);
  });

  it('should apply payment fee for credit card', () => {
    const briefing = new ClientBriefing('LANDING_PAGE', 1, 7, 'CREDIT_CARD_12X');
    const result = engine.calculate(briefing, defaultOpsCost, baseConfig);

    // R$ 1500 base + 9.5% fee = 142.5
    expect(result.paymentFee.getCents()).toBe(14250);
    expect(result.total.getCents()).toBe(164250); // R$ 1642.50
  });

  it('should flag requiresHITL when total exceeds threshold', () => {
    // E-commerce R$ 5000 + 10 extra pages R$ 3000 = R$ 8000
    const briefing = new ClientBriefing('ECOMMERCE', 11, 7, 'PIX');
    const result = engine.calculate(briefing, defaultOpsCost, baseConfig);

    expect(result.total.getCents()).toBe(800000); // R$ 8000
    expect(result.requiresHITL).toBe(true); // Exceeds R$ 5000
  });

  it('should apply safety margin if cost is too high', () => {
    const briefing = new ClientBriefing('LANDING_PAGE', 1, 7, 'PIX');
    // Ops cost very high (e.g. many failed iterations)
    const highOpsCost = new OperationalCosts(
      Money.fromReal(1500), 
      Money.fromReal(5),  
      Money.fromReal(2)   
    ); // Total = R$ 1507 * 1.3 margin = R$ 1959.10
    
    const result = engine.calculate(briefing, highOpsCost, baseConfig);

    expect(result.safetyMarginApplied).toBe(true);
    expect(result.total.getCents()).toBe(195910);
  });
});
