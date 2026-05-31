import { describe, it, expect, vi, beforeEach } from "vitest";
import { RecordContractAcceptanceHandler } from "../../src/application/deal/RecordContractAcceptanceHandler.js";
import { ValidationError } from "../../src/domain/shared/Result.js";
import * as jose from "jose";
import { createHash } from "crypto";

describe("Deal Security Audit - Unit Tests (Sentinel)", () => {
  const JWT_SECRET = "super-secret-key";

  const mockAcceptanceRepo = {
    save: vi.fn(),
    findByDealId: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  async function generateToken(dealId: string, contractHash: string) {
    const secret = new TextEncoder().encode(JWT_SECRET);
    return await new jose.SignJWT({ dealId, contractHash })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("48h")
      .sign(secret);
  }

  describe("VULN-004: Duplicate acceptance (Replay)", () => {
    it("should reject a second acceptance for the same deal", async () => {
      const handler = new RecordContractAcceptanceHandler(mockAcceptanceRepo as any, JWT_SECRET);

      const dealId = "deal-123";
      const contractText = "Legal Agreement Content";
      const contractHash = createHash("sha256").update(contractText).digest("hex");
      const token = await generateToken(dealId, contractHash);

      // Mock repository to simulate that an acceptance ALREADY EXISTS
      mockAcceptanceRepo.findByDealId.mockResolvedValue({
        dealId,
        contractHash,
        acceptedAt: new Date(),
      });

      const result = await handler.execute({
        token,
        dealId,
        ipRaw: "127.0.0.1",
        userAgent: "test",
        sessionId: "session-1",
        contractText,
      });

      // This is EXPECTED TO PASS now
      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.message).toContain("already been accepted");
      }
    });
  });

  describe("VULN-005: Injection (Unbounded Input)", () => {
    // We can't easily test Zod here without importing the routes,
    // but we can verify if the handler itself has any length checks (it doesn't).
    it("should ideally be rejected by the schema (tested via route audit)", () => {
        // Placeholder for the report
    });
  });
});
