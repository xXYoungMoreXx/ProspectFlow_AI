import { describe, it, expect, vi, beforeEach } from "vitest";
import * as argon2 from "argon2";
import { ForgotPasswordHandler } from "../../src/application/auth/auth.handlers.js";
import { VerifyEmailSchema, ResetPasswordSchema } from "../../src/http/schemas/auth.schemas.js";
import { buildApp } from "../../src/app.js";

vi.mock("argon2", async (importOriginal) => {
  const actual = await importOriginal<typeof import("argon2")>();
  return {
    ...actual,
    hash: vi.fn(actual.hash),
  };
});

describe("Auth Audit Tests (Phase 1)", () => {
  const mockDb = {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    transaction: vi.fn(),
  } as any;

  const mockEmailService = {
    sendVerificationEmail: vi.fn(),
    sendPasswordResetEmail: vi.fn(),
  } as any;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("VULN-005: Strict Token Validation", () => {
    it("VerifyEmailSchema should reject non-hex tokens", () => {
      const result = VerifyEmailSchema.safeParse({ token: "g".repeat(64) });
      expect(result.success).toBe(false);
    });

    it("ResetPasswordSchema should reject non-hex tokens", () => {
      const result = ResetPasswordSchema.safeParse({
        token: "g".repeat(64),
        password: "Password123!",
        confirmPassword: "Password123!"
      });
      expect(result.success).toBe(false);
    });
  });

  describe("VULN-006: ForgotPassword Timing Parity", () => {
    it("should use ARGON2_OPTIONS for dummy work (mCost 64MB)", async () => {
      const handler = new ForgotPasswordHandler(mockDb, mockEmailService);
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]), // User not found
          }),
        }),
      });

      await handler.execute("nonexistent@example.com");

      expect(argon2.hash).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          memoryCost: 65536,
          timeCost: 3,
        })
      );
    });
  });

  describe("VULN-007: Rate Limiting for Refresh Token", () => {
    it("should have rate limit configuration on /refresh route", async () => {
      const app = await buildApp();
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/auth/refresh",
        body: { refreshToken: "invalid" }
      });

      // Check for rate limit headers in the response
      expect(response.headers['x-ratelimit-limit']).toBeDefined();
    });
  });
});
