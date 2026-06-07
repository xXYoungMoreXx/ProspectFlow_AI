import { describe, it, expect, vi, beforeEach } from "vitest";
import * as argon2 from "argon2";
import {
  ForgotPasswordHandler,
  RefreshTokenHandler,
  ResendVerificationHandler,
} from "../../src/application/auth/auth.handlers.js";
import {
  VerifyEmailSchema,
  ResetPasswordSchema,
} from "../../src/http/schemas/auth.schemas.js";
import { authRoutes } from "../../src/http/routes/auth.routes.js";

vi.mock("argon2", async (importOriginal) => {
  const actual = await importOriginal<typeof import("argon2")>();
  return {
    ...actual,
    hash: vi.fn(actual.hash),
    verify: vi.fn(actual.verify),
  };
});

describe("Auth Security Audit (Sentinel)", () => {
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

  describe("VULN-004: ForgotPassword Timing Leak (Dummy Work)", () => {
    it("should use standard ARGON2_OPTIONS for dummy work", async () => {
      const handler = new ForgotPasswordHandler(mockDb, mockEmailService);

      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]), // User not found
          }),
        }),
      });

      await handler.execute("nonexistent@example.com");

      expect(argon2.hash).toHaveBeenCalled();
      const options = vi.mocked(argon2.hash).mock.calls[0][1];

      // Real options are { memoryCost: 65536, timeCost: 3, parallelism: 4 }
      // Vulnerable options are { memoryCost: 2048, timeCost: 2 }
      expect(options).toMatchObject({
        memoryCost: 65536,
        timeCost: 3,
      });
    });
  });

  describe("VULN-006: Weak Token Validation", () => {
    it("VerifyEmailSchema should only accept hex tokens", () => {
      const result = VerifyEmailSchema.safeParse({
        token: "g".repeat(64), // Invalid hex character 'g'
      });
      expect(result.success).toBe(false);
    });

    it("ResetPasswordSchema should only accept hex tokens", () => {
      const result = ResetPasswordSchema.safeParse({
        token: "g".repeat(64),
        password: "Password123!",
        confirmPassword: "Password123!",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("VULN-007: ResendVerification Timing Leak", () => {
    it("should perform dummy work when user is not found", async () => {
      const handler = new ResendVerificationHandler(mockDb, mockEmailService);

      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]), // User not found
          }),
        }),
      });

      await handler.execute("nonexistent@example.com");

      // Currently it returns ok(undefined) immediately
      expect(argon2.hash).toHaveBeenCalled();
    });

    it("should perform dummy work when user is already verified", async () => {
      const handler = new ResendVerificationHandler(mockDb, mockEmailService);

      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ emailVerified: true }]),
          }),
        }),
      });

      await handler.execute("verified@example.com");

      expect(argon2.hash).toHaveBeenCalled();
    });
  });

  describe("VULN-005: Missing Rate Limiting on /refresh", () => {
    it("should have rate limiting configured on /refresh route", async () => {
      const mockApp = {
        post: vi.fn(),
        delete: vi.fn(),
        container: {},
      } as any;

      await authRoutes(mockApp);

      const refreshRoute = mockApp.post.mock.calls.find(
        (call: any) => call[0] === "/refresh"
      );

      expect(refreshRoute).toBeDefined();
      expect(refreshRoute[1]).toHaveProperty("config.rateLimit");
    });
  });

  describe("VULN-001: RefreshToken Timing/DoS Vector (Regression)", () => {
    it("should fetch exactly ONE token using the ID from the raw token", async () => {
      const handler = new RefreshTokenHandler(mockDb);
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      });
      await handler.execute("ULIDID.RANDOMPART");
      const limitCall = mockDb.select().from().where().limit.mock.calls[0][0];
      expect(limitCall).toBe(1);
    });
  });
});
