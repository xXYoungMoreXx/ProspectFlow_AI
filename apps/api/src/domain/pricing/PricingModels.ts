import { Money } from "./Money.js";

export type ServiceType =
  | "LANDING_PAGE"
  | "SITE_INSTITUCIONAL"
  | "ECOMMERCE"
  | "PORTFOLIO";
export type PaymentMethod = "PIX" | "CREDIT_CARD_1X" | "CREDIT_CARD_12X";

export interface Addon {
  name: string;
  price: Money;
}

/**
 * Value Object: ClientBriefing
 * Contém as especificações do serviço solicitadas pelo cliente.
 */
export class ClientBriefing {
  constructor(
    public readonly serviceType: ServiceType,
    public readonly pageCount: number,
    public readonly deliveryDays: number,
    public readonly paymentMethod: PaymentMethod,
    public readonly addons: Addon[] = [],
  ) {
    if (pageCount < 1) throw new Error("Page count must be at least 1");
    if (deliveryDays < 1) throw new Error("Delivery days must be at least 1");
  }
}

/**
 * Value Object: OperationalCosts
 * Representa o custo base que o Hefesto terá para produzir o site.
 */
export class OperationalCosts {
  constructor(
    public readonly tokensCost: Money,
    public readonly deployCost: Money,
    public readonly prospectingCost: Money,
  ) {}

  public getTotalCost(): Money {
    return this.tokensCost.add(this.deployCost).add(this.prospectingCost);
  }
}

/**
 * Value Object: PricingResult
 * Representa a composição final do preço calculado pelo PricingEngine.
 */
export class PricingResult {
  constructor(
    public readonly basePrice: Money,
    public readonly extras: Money,
    public readonly paymentFee: Money,
    public readonly total: Money,
    public readonly requiresHITL: boolean,
    public readonly safetyMarginApplied: boolean,
  ) {}
}
