import { describe, it, expect } from "vitest";
import {
  ok,
  err,
  tracedErr,
  Ok,
  Err,
  TracedErr,
  type DomainResult,
  DomainError,
  ValidationError,
  NotFoundError,
  AuthenticationError,
  AuthorizationError,
  ConflictError,
  InsufficientBudgetError,
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

  describe("Ok — full branch coverage", () => {
    it("flatMap chains to next result", () => {
      const r = ok(5).flatMap((x) => ok(x * 2));
      expect(r.isOk()).toBe(true);
      expect((r as Ok<number>).value).toBe(10);
    });

    it("unwrap returns value", () => {
      expect(ok("hello").unwrap()).toBe("hello");
    });

    it("unwrapOr returns value (not fallback)", () => {
      expect(ok(42).unwrapOr(0)).toBe(42);
    });
  });

  describe("Err — full branch coverage", () => {
    it("isOk returns false", () => {
      expect(err(new Error("x")).isOk()).toBe(false);
    });

    it("isErr returns true", () => {
      expect(err(new Error("x")).isErr()).toBe(true);
    });

    it("map returns same Err unchanged", () => {
      const e = err(new Error("e"));
      const r = e.map((x: never) => x);
      expect(r.isErr()).toBe(true);
      expect((r as Err<Error>).error.message).toBe("e");
    });

    it("flatMap returns same Err unchanged", () => {
      const e = err(new Error("flat"));
      const r = e.flatMap((_x: never) => ok(999));
      expect(r.isErr()).toBe(true);
    });

    it("unwrap throws the error", () => {
      const e = new Error("boom");
      expect(() => err(e).unwrap()).toThrow("boom");
    });
  });

  describe("Error subclasses", () => {
    it("ValidationError with field", () => {
      const e = new ValidationError("bad value", "email");
      expect(e.code).toBe("VALIDATION_ERROR");
      expect(e.field).toBe("email");
      expect(e.name).toBe("ValidationError");
    });

    it("ValidationError without field", () => {
      const e = new ValidationError("bad");
      expect(e.field).toBeUndefined();
    });

    it("NotFoundError", () => {
      const e = new NotFoundError("Lead", "lead-1");
      expect(e.code).toBe("NOT_FOUND");
      expect(e.message).toContain("lead-1");
    });

    it("AuthenticationError default message", () => {
      const e = new AuthenticationError();
      expect(e.code).toBe("AUTHENTICATION_ERROR");
      expect(e.name).toBe("AuthenticationError");
    });

    it("AuthenticationError custom message", () => {
      const e = new AuthenticationError("custom");
      expect(e.message).toBe("custom");
    });

    it("AuthorizationError default message", () => {
      const e = new AuthorizationError();
      expect(e.code).toBe("AUTHORIZATION_ERROR");
    });

    it("ConflictError", () => {
      const e = new ConflictError("duplicate");
      expect(e.code).toBe("CONFLICT");
    });

    it("InsufficientBudgetError default", () => {
      const e = new InsufficientBudgetError();
      expect(e.code).toBe("INSUFFICIENT_BUDGET");
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
