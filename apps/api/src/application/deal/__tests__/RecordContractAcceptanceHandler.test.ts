import { describe, it, expect, vi, beforeEach, type Mocked } from "vitest";
import * as jose from "jose";
import { RecordContractAcceptanceHandler } from "../RecordContractAcceptanceHandler.js";
import type { ContractAcceptanceRepository } from "../../../domain/deal/ContractAcceptanceRepository.js";
import { createHash } from "crypto";

describe("RecordContractAcceptanceHandler Security Tests", () => {
  let repo: Mocked<ContractAcceptanceRepository>;
  let handler: RecordContractAcceptanceHandler;
  const jwtSecret = "test-secret";
  const dealId = "deal-123";
  const contractText = "Legal contract text";
  const contractHash = createHash("sha256").update(contractText).digest("hex");

  beforeEach(() => {
    repo = {
      save: vi.fn(),
      findByDealId: vi.fn(),
    };
    handler = new RecordContractAcceptanceHandler(repo, jwtSecret);
  });

  async function createToken(payload: any) {
    const secret = new TextEncoder().encode(jwtSecret);
    return await new jose.SignJWT(payload)
      .setProtectedHeader({ alg: "HS256" })
      .sign(secret);
  }

  it("VULN-004: should reject acceptance if the deal has already been accepted", async () => {
    const token = await createToken({ dealId, contractHash });

    // Mock first call: no acceptance found
    repo.findByDealId.mockResolvedValueOnce(null);
    repo.save.mockResolvedValueOnce(undefined);

    const firstResult = await handler.execute({
      token,
      dealId,
      contractText,
      ipRaw: "127.0.0.1",
      userAgent: "test",
      sessionId: "sess-1",
    });

    expect(firstResult.isOk()).toBe(true);

    // Mock second call: acceptance NOW EXISTS
    repo.findByDealId.mockResolvedValueOnce({ id: 'existing' } as any);

    const secondResult = await handler.execute({
      token,
      dealId,
      contractText,
      ipRaw: "127.0.0.1",
      userAgent: "test",
      sessionId: "sess-1",
    });

    expect(secondResult.isErr()).toBe(true);
    if (secondResult.isErr()) {
      // console.log("ERROR MESSAGE:", secondResult.error.message);
      expect(secondResult.error.message).toContain("already");
    }
  });

  it("VULN-006: should reject acceptance if contractText is excessively large", async () => {
    const largeContractText = "a".repeat(100001); // Assuming 100k is the limit
    const largeContractHash = createHash("sha256").update(largeContractText).digest("hex");
    const token = await createToken({ dealId, contractHash: largeContractHash });

    repo.findByDealId.mockResolvedValue(null);

    const result = await handler.execute({
      token,
      dealId,
      contractText: largeContractText,
      ipRaw: "127.0.0.1",
      userAgent: "test",
      sessionId: "sess-1",
    });

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.message).toMatch(/too large/i);
    }
  });
});
