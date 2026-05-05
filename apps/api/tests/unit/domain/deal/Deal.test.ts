import { describe, it, expect } from 'vitest';
import { Deal } from '../../../../src/domain/deal/Deal.js';

describe('Deal Entity', () => {
  it('should create a valid deal and emit proposed event', () => {
    const result = Deal.create({
      id: 'deal-1',
      leadId: 'lead-1',
      operatorId: 'op-1',
      serviceType: 'WEBSITE',
      briefing: { color: 'blue' },
      basePriceCents: 150000, // R$ 1500,00
    });

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      const deal = result.value;
      expect(deal.status).toBe('PROPOSED');
      expect(deal.totalCents).toBe(150000);
      expect(deal.domainEvents.length).toBe(1);
      expect(deal.domainEvents[0].eventType).toBe('deal.proposed');
    }
  });

  it('should fail creation with negative price', () => {
    const result = Deal.create({
      id: 'deal-1',
      leadId: 'lead-1',
      operatorId: 'op-1',
      serviceType: 'WEBSITE',
      briefing: {},
      basePriceCents: -500,
    });

    expect(result.isErr()).toBe(true);
  });

  it('should calculate total correctly with addons and discounts', () => {
    const deal = Deal.create({
      id: 'deal-1',
      leadId: 'lead-1',
      operatorId: 'op-1',
      serviceType: 'WEBSITE',
      briefing: {},
      basePriceCents: 100000, // 1000.00
    }).unwrap();

    deal.addAddon({ name: 'SEO', priceCents: 20000 }); // +200.00
    expect(deal.totalCents).toBe(120000);

    const discountResult = deal.setDiscount(10); // 10% discount on 1200.00
    expect(discountResult.isOk()).toBe(true);
    expect(deal.totalCents).toBe(108000); // 1200 - 120 = 1080.00
  });

  it('should close a deal and emit closed event', () => {
    const deal = Deal.create({
      id: 'deal-1',
      leadId: 'lead-1',
      operatorId: 'op-1',
      serviceType: 'WEBSITE',
      briefing: {},
      basePriceCents: 100000,
    }).unwrap();

    deal.clearDomainEvents();

    const closeResult = deal.close();
    expect(closeResult.isOk()).toBe(true);
    expect(deal.status).toBe('CLOSED');
    expect(deal.domainEvents.length).toBe(1);
    expect(deal.domainEvents[0].eventType).toBe('deal.closed');
  });

  it('should cancel a deal and emit cancelled event', () => {
    const deal = Deal.create({
      id: 'deal-1',
      leadId: 'lead-1',
      operatorId: 'op-1',
      serviceType: 'WEBSITE',
      briefing: {},
      basePriceCents: 100000,
    }).unwrap();

    deal.clearDomainEvents();

    const cancelResult = deal.cancel('Client ghosted');
    expect(cancelResult.isOk()).toBe(true);
    expect(deal.status).toBe('CANCELLED');
    expect(deal.domainEvents.length).toBe(1);
    expect(deal.domainEvents[0].eventType).toBe('deal.cancelled');

    // Cannot close after cancelled
    expect(deal.close().isErr()).toBe(true);
  });
});
