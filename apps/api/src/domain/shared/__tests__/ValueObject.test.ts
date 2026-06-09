import { describe, it, expect } from "vitest";
import { ValueObject } from "../ValueObject.js";

class TestVO extends ValueObject<{ x: number; y: string }> {
  constructor(x: number, y: string) {
    super({ x, y });
  }
  get x() {
    return this.props.x;
  }
  get y() {
    return this.props.y;
  }
}

describe("ValueObject", () => {
  it("equals returns true for same props", () => {
    expect(new TestVO(1, "a").equals(new TestVO(1, "a"))).toBe(true);
  });

  it("equals returns false for different props", () => {
    expect(new TestVO(1, "a").equals(new TestVO(2, "a"))).toBe(false);
  });

  it("equals returns false when null passed", () => {
    expect(new TestVO(1, "a").equals(null as unknown as TestVO)).toBe(false);
  });

  it("equals returns false when undefined passed", () => {
    expect(new TestVO(1, "a").equals(undefined as unknown as TestVO)).toBe(
      false,
    );
  });

  it("props are frozen (immutable)", () => {
    const vo = new TestVO(5, "z");
    expect(Object.isFrozen((vo as unknown as { props: object }).props)).toBe(
      true,
    );
  });
});
