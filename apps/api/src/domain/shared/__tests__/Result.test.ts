import { describe, it, expect } from "vitest";
import {
  ok,
  err,
  tracedErr,
  Err,
  TracedErr,
  type DomainResult,
  DomainError,
} from "../Result.js";

describe("Result", () => {
  describe("ok()", () => {
    it("isOk returns true", () => {
      expect(ok(1).isOk()).toBe(true);
    });
    it("isErr returns false", () => {
      expect(ok(1).isErr()).toBe(false);
    });
    it("map transforms value", () => {
      expect(
        ok(2)
          .map((x) => x * 3)
          .unwrap(),
      ).toBe(6);
    });
  });

  describe("err()", () => {
    it("isErr returns true", () => {
      expect(err(new Error("x")).isErr()).toBe(true);
    });
    it("unwrapOr returns fallback", () => {
      expect(err(new Error("x")).unwrapOr(99)).toBe(99);
    });
  });

  describe("TracedErr / tracedErr()", () => {
    it("carries correlationId alongside the error", () => {
      const e = tracedErr(
        new DomainError("NOT_FOUND", "not found"),
        "corr-123",
      );
      expect(e.isErr()).toBe(true);
      expect(e.correlationId).toBe("corr-123");
      expect(e.error.code).toBe("NOT_FOUND");
    });

    it("is assignable to DomainResult", () => {
      const result: DomainResult<number> = tracedErr(
        new DomainError("VALIDATION_ERROR", "bad"),
        "corr-456",
      );
      expect(result.isOk()).toBe(false);
    });

    it("preserves Err behaviour — unwrapOr returns fallback", () => {
      const e = tracedErr(new DomainError("CONFLICT", "conflict"), "corr-789");
      expect(e.unwrapOr(42)).toBe(42);
    });

    it("is an instance of Err", () => {
      const e = tracedErr(new DomainError("X", "y"), "c");
      expect(e).toBeInstanceOf(Err);
      expect(e).toBeInstanceOf(TracedErr);
    });
  });
});
