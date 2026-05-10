/**
 * Value Object: Money
 * Responsável por representar valores monetários em centavos para evitar problemas
 * de precisão com floats, garantindo cálculos financeiros seguros.
 */
export class Money {
  private constructor(private readonly cents: number) {
    if (!Number.isInteger(cents)) {
      throw new Error('Money value must be an integer (cents)');
    }
    if (cents < 0) {
      throw new Error('Money value cannot be negative');
    }
  }

  public getCents(): number {
    return this.cents;
  }

  public static BRL(cents: number): Money {
    return new Money(cents);
  }

  public static fromReal(real: number): Money {
    return new Money(Math.round(real * 100));
  }

  public add(other: Money): Money {
    return new Money(this.cents + other.cents);
  }

  public multiply(multiplier: number): Money {
    return new Money(Math.round(this.cents * multiplier));
  }

  public greaterThan(other: Money): boolean {
    return this.cents > other.cents;
  }

  public format(): string {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(this.cents / 100);
  }
}
