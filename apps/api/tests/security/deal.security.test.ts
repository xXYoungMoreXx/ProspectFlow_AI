import { describe, it, expect, vi, beforeEach } from "vitest";
import { RecordContractAcceptanceHandler } from "../../src/application/deal/RecordContractAcceptanceHandler.js";
import { GetDealByIdHandler, CancelDealHandler } from "../../src/application/deal/deal.handlers.js";
import { SignJWT } from "jose";
import { NotFoundError, ok, err } from "../../src/domain/shared/Result.js";

describe("Deal Security Audit (S1-03)", () => {
  const jwtSecret = "test-secret-12345678123456781234567812345678";
  const encodedSecret = new TextEncoder().encode(jwtSecret);
  const contractHash = "88ebf276113a5a7f2380fc2ca37611320cc59c5f09ac3f7baed835342f876568";

  const mockDealRepo = {
    findById: vi.fn(),
    findByIdInternal: vi.fn(),
    save: vi.fn(),
    findMany: vi.fn(),
  };

  const mockAcceptanceRepo = {
    save: vi.fn(),
    findByDealId: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("VULN-001: Missing Idempotency in Contract Acceptance", () => {
    it("should reject duplicate acceptances for the same deal", async () => {
      const dealId = "deal-123";
      const contractText = "Legal Terms";

      const token = await new SignJWT({ dealId, contractHash })
        .setProtectedHeader({ alg: "HS256" })
        .setIssuedAt()
        .setExpirationTime("1h")
        .sign(encodedSecret);

      const handler = new RecordContractAcceptanceHandler(
        mockAcceptanceRepo as any,
        mockDealRepo as any,
        jwtSecret
      );

      mockAcceptanceRepo.findByDealId.mockResolvedValue({ id: "existing-acc" });

      const result = await handler.execute({
        token,
        dealId,
        contractText,
        ipRaw: "127.0.0.1",
        userAgent: "test",
        sessionId: "sess-1",
      });

      expect(result.isErr(), "Should return error for duplicate acceptance").toBe(true);
      expect(result.error?.message).toMatch(/already accepted/i);
    });
  });

  describe("VULN-002: Invalid State Acceptance", () => {
    it("should reject acceptance if the deal is CANCELLED", async () => {
      const dealId = "deal-cancelled";
      const contractText = "Legal Terms";

      const token = await new SignJWT({ dealId, contractHash })
        .setProtectedHeader({ alg: "HS256" })
        .setIssuedAt()
        .setExpirationTime("1h")
        .sign(encodedSecret);

      const handler = new RecordContractAcceptanceHandler(
        mockAcceptanceRepo as any,
        mockDealRepo as any,
        jwtSecret
      );

      mockAcceptanceRepo.findByDealId.mockResolvedValue(null);
      mockDealRepo.findByIdInternal.mockResolvedValue({
        id: dealId,
        status: "CANCELLED",
        toJSON: () => ({ status: "CANCELLED" })
      });

      const result = await handler.execute({
        token,
        dealId,
        contractText,
        ipRaw: "127.0.0.1",
        userAgent: "test",
        sessionId: "sess-1",
      });

      expect(result.isErr(), "Should return error for cancelled deal").toBe(true);
      expect(result.error?.message).toMatch(/invalid deal status/i);
    });
  });

  describe("VULN-003: IDOR in Deal Handlers", () => {
    it("GetDealByIdHandler should return NotFound when operatorId does not match", async () => {
      const dealId = "deal-1";
      const ownerId = "operator-owner";
      const attackerId = "operator-attacker";
      const orgId = "org-1";

      const handler = new GetDealByIdHandler(mockDealRepo as any);

      mockDealRepo.findById.mockImplementation((id, opId, oId) => {
        if (id === dealId && opId === ownerId) {
          return Promise.resolve({ id: dealId, operatorId: ownerId });
        }
        return Promise.resolve(null);
      });

      const result = await handler.execute(dealId, attackerId, orgId);

      expect(result.isErr()).toBe(true);
      expect(result.error).toBeInstanceOf(NotFoundError);
    });

    it("CancelDealHandler should return NotFound when operatorId does not match", async () => {
      const dealId = "deal-1";
      const ownerId = "operator-owner";
      const attackerId = "operator-attacker";
      const orgId = "org-1";

      const handler = new CancelDealHandler(mockDealRepo as any);

      mockDealRepo.findById.mockImplementation((id, opId, oId) => {
        if (id === dealId && opId === ownerId) {
          return Promise.resolve({
              id: dealId,
              operatorId: ownerId,
              cancel: vi.fn().mockReturnValue(ok(undefined))
          });
        }
        return Promise.resolve(null);
      });

      const result = await handler.execute(dealId, attackerId, "Reason", orgId);

      expect(result.isErr()).toBe(true);
      expect(mockDealRepo.save).not.toHaveBeenCalled();
    });
  });
});
