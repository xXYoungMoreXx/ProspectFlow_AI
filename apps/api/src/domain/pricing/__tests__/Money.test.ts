import { describe, it, expect } from "vitest";
import { Money } from "../Money.js";

describe("Money Value Object", () => {
  it("should create from cents correctly", () => {
    const m = Money.BRL(1500);
    expect(m.getCents()).toBe(1500);
  });

  it("should create from Real correctly", () => {
    const m = Money.fromReal(15.99);
    expect(m.getCents()).toBe(1599);
  });

  it("should format to BRL string", () => {
    const m = Money.fromReal(1500.5);
    const formatted = m.format();
    // Non-breaking space is used in Intl.NumberFormat
    expect(formatted.replace(/\s/g, " ")).toContain("R$ 1.500,50");
  });

  it("should add two money values", () => {
    const m1 = Money.fromReal(10);
    const m2 = Money.fromReal(5.5);
    const sum = m1.add(m2);
    expect(sum.getCents()).toBe(1550);
  });

  it("should multiply money value and round", () => {
    const m = Money.fromReal(10);
    const result = m.multiply(1.5);
    expect(result.getCents()).toBe(1500);
  });

  it("should properly handle greaterThan", () => {
    const m1 = Money.fromReal(20);
    const m2 = Money.fromReal(10);
    expect(m1.greaterThan(m2)).toBe(true);
    expect(m2.greaterThan(m1)).toBe(false);
  });

  it("should throw error on non-integer cents", () => {
    expect(() => Money.BRL(15.5)).toThrow("must be an integer");
  });

  it("should throw error on negative cents", () => {
    expect(() => Money.BRL(-10)).toThrow("cannot be negative");
  });
});
