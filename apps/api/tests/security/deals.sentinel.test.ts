import { describe, it, expect, vi, beforeEach } from "vitest";
import { buildApp } from "../../src/app.js";
import type { FastifyInstance } from "fastify";
import * as jose from "jose";

describe("Deal Security Audit (Sentinel)", () => {
  let app: FastifyInstance;
  const JWT_SECRET = process.env["JWT_SECRET"] || "super-secret-key";

  beforeEach(async () => {
    app = await buildApp();
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
      const dealId = crypto.randomUUID();
      const contractText = "Legal Agreement Content";
      const contractHash = "6891632733d3c8c734032d8471e959ec217c9b0e12351c4a04702b88126e8550"; // SHA256 of contractText
      const token = await generateToken(dealId, contractHash);

      // First acceptance
      const res1 = await app.inject({
        method: "POST",
        url: `/api/v1/deals/${dealId}/accept`,
        query: { token },
        payload: { contractText },
      });
      expect(res1.statusCode).toBe(200);

      // Second acceptance (Replay)
      const res2 = await app.inject({
        method: "POST",
        url: `/api/v1/deals/${dealId}/accept`,
        query: { token },
        payload: { contractText },
      });

      // This is EXPECTED TO FAIL (it will return 200 now, but we want it to be 400)
      expect(res2.statusCode).toBe(400);
      expect(res2.json().errors[0].message).toMatch(/already accepted/i);
    });
  });

  describe("VULN-005: Oversized contract text (DoS)", () => {
    it("should reject contract text exceeding 100KB", async () => {
      const dealId = crypto.randomUUID();
      const oversizedText = "A".repeat(100001); // 100,001 bytes
      const token = await generateToken(dealId, "some-hash");

      const response = await app.inject({
        method: "POST",
        url: `/api/v1/deals/${dealId}/accept`,
        query: { token },
        payload: { contractText: oversizedText },
      });

      // This is EXPECTED TO FAIL (it will return 200 or 400 with a different error now)
      expect(response.statusCode).toBe(400);
      expect(response.json().errors[0].message).toMatch(/too long|maximum/i);
    });
  });

  describe("VULN-006: Missing specific rate limiting", () => {
    it("should have a strict rate limit for proposal acceptance", async () => {
      const dealId = crypto.randomUUID();
      const contractText = "Legal Agreement Content";
      const contractHash = "6891632733d3c8c734032d8471e959ec217c9b0e12351c4a04702b88126e8550";
      const token = await generateToken(dealId, contractHash);

      // Hit the endpoint 10 times quickly.
      // If there is no specific rate limit, it will likely succeed 10 times (or fail with 400 if VULN-004 is fixed)
      // but NOT with 429 unless it hits the global limit (100/min).
      // We want a stricter limit for this sensitive endpoint.

      const requests = Array.from({ length: 10 }).map(() =>
        app.inject({
          method: "POST",
          url: `/api/v1/deals/${dealId}/accept`,
          query: { token },
          payload: { contractText },
        })
      );

      const responses = await Promise.all(requests);
      const rateLimited = responses.some(r => r.statusCode === 429);

      // This is EXPECTED TO FAIL (it will be false now)
      expect(rateLimited).toBe(true);
    });
  });
});
