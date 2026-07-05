import { describe, it, expect, vi } from "vitest";
import { hash } from "argon2";
import { ForgotPasswordHandler } from "../../src/application/auth/auth.handlers.js";

vi.mock("argon2", async (importOriginal) => {
  const actual = await importOriginal<typeof import("argon2")>();
  return {
    ...actual,
    hash: vi.fn(),
  };
});

describe("VULN-010: ForgotPassword Timing Leak", () => {
  it("should use exact ARGON2_OPTIONS for dummy work to prevent timing leaks", async () => {
    const mockDb = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]), // User not found
          }),
        }),
      }),
    } as any;

    const mockEmailService = {
      sendPasswordResetEmail: vi.fn(),
    } as any;

    const handler = new ForgotPasswordHandler(mockDb, mockEmailService);

    await handler.execute("nonexistent@example.com");

    expect(hash).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        memoryCost: 65536,
        timeCost: 3,
        parallelism: 4,
        type: 2,
      })
    );
  });
});
