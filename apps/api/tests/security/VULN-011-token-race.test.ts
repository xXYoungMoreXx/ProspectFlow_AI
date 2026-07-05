import { describe, it, expect, vi } from "vitest";
import { VerifyEmailHandler } from "../../src/application/auth/auth.handlers.js";
import { createHash } from "node:crypto";

describe("VULN-011: Token Reuse Race Condition", () => {
  it("should use pessimistic locking (FOR UPDATE) for token verification", async () => {
    const token = "3a4ba9fa8690d064accaad3121cbdc26b8809e5762931fc0dc5e0fb8bd5b06ee";
    const tokenHash = createHash("sha256").update(token).digest("hex");

    const mockTx = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      for: vi.fn().mockResolvedValue([{
        id: "1",
        operatorId: "op1",
        expiresAt: new Date(Date.now() + 10000),
        usedAt: null,
        tokenHash
      }]),
      update: vi.fn().mockReturnThis(),
      set: vi.fn().mockReturnThis(),
    };

    const mockDb = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      transaction: vi.fn().mockImplementation(async (cb) => cb(mockTx))
    } as any;

    const handler = new VerifyEmailHandler(mockDb);
    await handler.execute(token);

    // Initial select on the base DB should not be called
    expect(mockDb.select).not.toHaveBeenCalled();
    // It should be called on the transaction
    expect(mockTx.select).toHaveBeenCalled();
    // It MUST use pessimistic locking
    expect(mockTx.for).toHaveBeenCalledWith("update");
  });
});
