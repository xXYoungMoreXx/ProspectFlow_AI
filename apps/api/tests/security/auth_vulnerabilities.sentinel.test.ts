import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  ForgotPasswordHandler,
  VerifyEmailHandler,
  ResetPasswordHandler,
  RefreshTokenHandler,
} from "../../src/application/auth/auth.handlers.js";
import * as argon2 from "argon2";

// Mock argon2
vi.mock("argon2", async () => {
  const actual = await vi.importActual("argon2");
  return {
    ...actual,
    hash: vi.fn().mockResolvedValue("hash"),
    verify: vi.fn().mockResolvedValue(false),
  };
});

describe("Auth Security Audit Phase 1 (Sentinel)", () => {
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

  describe("VULN-004: ForgotPassword Timing Side-Channel", () => {
    it("should use exactly 64MB memory cost for dummy work", async () => {
      const handler = new ForgotPasswordHandler(mockDb, mockEmailService);

      // Mock user not found
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      await handler.execute("nonexistent@example.com");

      expect(argon2.hash).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          memoryCost: 65536,
        })
      );
    });
  });

  describe("VULN-005: Missing Hex Validation for Tokens", () => {
    it("should reject non-hex tokens in VerifyEmailHandler", async () => {
      const handler = new VerifyEmailHandler(mockDb);
      const result = await handler.execute("NOT-A-HEX-TOKEN-!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!");

      // If it doesn't return an error, it's vulnerable (or at least weakly validated)
      // Actually, we want it to fail validation BEFORE hitting the DB or crypto
      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.message).toMatch(/Invalid token format/i);
      }
    });

    it("should reject non-hex tokens in ResetPasswordHandler", async () => {
      const handler = new ResetPasswordHandler(mockDb);
      const result = await handler.execute("NOT-A-HEX-TOKEN-!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!", "NewPass123!");

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.message).toMatch(/Invalid token format/i);
      }
    });
  });

  describe("VULN-006: RefreshToken Timing Parity", () => {
    it("should use dummy hash with correct cost when token not found", async () => {
      const handler = new RefreshTokenHandler(mockDb);

      // Mock token not found
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      await handler.execute("01JMB8W8A9G6Q5XJ4A8Y8W8A9G.01JMB8W8A9G6Q5XJ4A8Y8W8A9G");

      expect(argon2.verify).toHaveBeenCalledWith(
        expect.stringContaining("$m=65536"),
        expect.any(String)
      );
    });
  });
});
