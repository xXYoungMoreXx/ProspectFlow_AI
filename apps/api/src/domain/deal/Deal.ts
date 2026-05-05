import { AggregateRoot } from '../shared/AggregateRoot.js';
import { createDomainEvent } from '../shared/DomainEvent.js';
import { ValidationError, ok, err, type Result } from '../shared/Result.js';
import type { DealStatus, ServiceType } from '@agentepro/shared-types';

export interface Addon {
  readonly name: string;
  readonly priceCents: number;
}

export interface DealProps {
  id: string;
  leadId: string;
  operatorId: string;
  agentId?: string;
  serviceType: ServiceType;
  status: DealStatus;
  briefing: Record<string, unknown>;
  proposalText?: string;
  basePriceCents: number;
  addons: Addon[];
  discountPct: number;
  currency: string;
  proposalSentAt?: Date;
  closedAt?: Date;
  closedReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

export class Deal extends AggregateRoot {
  private constructor(private props: DealProps) {
    super();
  }

  static create(input: {
    id: string;
    leadId: string;
    operatorId: string;
    agentId?: string;
    serviceType: ServiceType;
    briefing: Record<string, unknown>;
    basePriceCents: number;
  }): Result<Deal, ValidationError> {
    if (input.basePriceCents < 0) {
      return err(new ValidationError('Base price cannot be negative', 'base_price_cents'));
    }

    const now = new Date();
    const deal = new Deal({
      id: input.id,
      leadId: input.leadId,
      operatorId: input.operatorId,
      agentId: input.agentId,
      serviceType: input.serviceType,
      status: 'PROPOSED',
      briefing: input.briefing,
      basePriceCents: input.basePriceCents,
      addons: [],
      discountPct: 0,
      currency: 'BRL',
      createdAt: now,
      updatedAt: now,
    });

    deal.addDomainEvent(
      createDomainEvent('deal.proposed', 'Deal', input.id, {
        dealId: input.id,
        leadId: input.leadId,
        totalCents: input.basePriceCents,
      }),
    );

    return ok(deal);
  }

  static reconstitute(props: DealProps): Deal {
    return new Deal(props);
  }

  get id(): string { return this.props.id; }
  get leadId(): string { return this.props.leadId; }
  get operatorId(): string { return this.props.operatorId; }
  get agentId(): string | undefined { return this.props.agentId; }
  get serviceType(): ServiceType { return this.props.serviceType; }
  get status(): DealStatus { return this.props.status; }
  get briefing(): Record<string, unknown> { return this.props.briefing; }
  get proposalText(): string | undefined { return this.props.proposalText; }
  get basePriceCents(): number { return this.props.basePriceCents; }
  get addons(): ReadonlyArray<Addon> { return this.props.addons; }
  get discountPct(): number { return this.props.discountPct; }
  get currency(): string { return this.props.currency; }
  get createdAt(): Date { return this.props.createdAt; }
  get updatedAt(): Date { return this.props.updatedAt; }

  /** Total in cents after addons + discount */
  get totalCents(): number {
    const addonsTotal = this.props.addons.reduce((sum, a) => sum + a.priceCents, 0);
    const subtotal = this.props.basePriceCents + addonsTotal;
    const discount = Math.round(subtotal * (this.props.discountPct / 100));
    return subtotal - discount;
  }

  close(): Result<void, ValidationError> {
    if (this.props.status === 'CLOSED') {
      return err(new ValidationError('Deal is already closed'));
    }
    if (this.props.status === 'CANCELLED') {
      return err(new ValidationError('Cannot close a cancelled deal'));
    }
    this.props.status = 'CLOSED';
    this.props.closedAt = new Date();
    this.props.updatedAt = new Date();
    this.addDomainEvent(
      createDomainEvent('deal.closed', 'Deal', this.props.id, {
        dealId: this.props.id,
        leadId: this.props.leadId,
        totalCents: this.totalCents,
        serviceType: this.props.serviceType,
      }),
    );
    return ok(undefined);
  }

  cancel(reason: string): Result<void, ValidationError> {
    if (this.props.status === 'CANCELLED') {
      return err(new ValidationError('Deal is already cancelled'));
    }
    if (this.props.status === 'CLOSED') {
      return err(new ValidationError('Cannot cancel a closed deal'));
    }
    this.props.status = 'CANCELLED';
    this.props.closedReason = reason;
    this.props.updatedAt = new Date();
    this.addDomainEvent(
      createDomainEvent('deal.cancelled', 'Deal', this.props.id, {
        dealId: this.props.id,
        reason,
      }),
    );
    return ok(undefined);
  }

  setProposal(text: string): void {
    this.props.proposalText = text;
    this.props.proposalSentAt = new Date();
    this.props.updatedAt = new Date();
  }

  addAddon(addon: Addon): void {
    this.props.addons = [...this.props.addons, addon];
    this.props.updatedAt = new Date();
  }

  setDiscount(pct: number): Result<void, ValidationError> {
    if (pct < 0 || pct > 100) {
      return err(new ValidationError('Discount must be between 0 and 100', 'discount_pct'));
    }
    this.props.discountPct = pct;
    this.props.updatedAt = new Date();
    return ok(undefined);
  }

  toJSON(): DealProps {
    return { ...this.props };
  }
}
