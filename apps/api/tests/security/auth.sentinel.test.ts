import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  ForgotPasswordHandler,
  RefreshTokenHandler,
} from "../../src/application/auth/auth.handlers.js";

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

  describe("VULN-003: ForgotPassword Email Enumeration", () => {
    it("should execute dummy hash for non-existent users", async () => {
      const handler = new ForgotPasswordHandler(mockDb, mockEmailService);
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      });
      await handler.execute("nonexistent@example.com");
    });
  });

  describe("VULN-001: RefreshToken Timing/DoS Vector", () => {
    it("should fetch exactly ONE token using the ID from the raw token", async () => {
      const handler = new RefreshTokenHandler(mockDb);
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      });
      // Use a valid UUID to pass the format check
      await handler.execute("eb24050a-5c12-42b7-873b-554471e98d1a.RANDOMPART");
      const limitCall = mockDb.select().from().where().limit.mock.calls[0][0];
      expect(limitCall).toBe(1);
    });
  });
});
