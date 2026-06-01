import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";
import { buildApp } from "../../src/app.js";
import type { FastifyInstance } from "fastify";
import { SignJWT, importPKCS8, createSecretKey } from "jose";
import { ulid } from "ulid";
import crypto from "node:crypto";

/**
 * S0-01 — Auth security tests
 * SPEC-01 §3: RS256 only. HS256 and "none" MUST be rejected with 401.
 * PRD §11.3: anti-timing gap email-not-found vs wrong-password < 200ms.
 */
describe("Auth Security (S0-01 — SPEC-01)", () => {
  let app: FastifyInstance;
  let rs256PrivateKey: Awaited<ReturnType<typeof importPKCS8>>;
  let validRS256Token: string;

  const ISSUER = "agentepro.local";
  const AUDIENCE = "agentepro-api";

  const mockAgentRepo = {
    save: vi.fn(),
    findById: vi.fn(),
    findMany: vi.fn(),
    addSkill: vi.fn(),
    updateSkill: vi.fn(),
    removeSkill: vi.fn(),
    listSkills: vi.fn(),
    addRule: vi.fn(),
    updateRule: vi.fn(),
    removeRule: vi.fn(),
    listRules: vi.fn(),
  };

  beforeAll(async () => {
    const keyStr = (process.env["JWT_PRIVATE_KEY"] ?? "").replace(/\\n/g, "\n");
    rs256PrivateKey = await importPKCS8(keyStr, "RS256");

    validRS256Token = await new SignJWT({
      sub: "op-test-1",
      email: "sec@test.com",
    })
      .setProtectedHeader({ alg: "RS256", typ: "JWT" })
      .setIssuedAt()
      .setExpirationTime("1h")
      .setIssuer(ISSUER)
      .setAudience(AUDIENCE)
      .setJti(ulid())
      .sign(rs256PrivateKey);
  });

  beforeEach(async () => {
    vi.clearAllMocks();
    app = await buildApp();
    app.container.agentRepo =
      mockAgentRepo as unknown as typeof app.container.agentRepo;
    mockAgentRepo.findMany.mockResolvedValue({
      agents: [],
      total: 0,
      nextCursor: null,
    });
  });

  // ─── HS256 rejection ─────────────────────────────────────────────────────────

  describe("HS256 tokens MUST be rejected (SPEC-01 §3)", () => {
    it("rejects HS256-signed token with 401 AUTHENTICATION_ERROR", async () => {
      const hs256Token = await new SignJWT({
        sub: "op-attacker",
        email: "bad@actor.com",
      })
        .setProtectedHeader({ alg: "HS256" })
        .setIssuedAt()
        .setExpirationTime("1h")
        .setIssuer(ISSUER)
        .setAudience(AUDIENCE)
        .sign(createSecretKey(crypto.randomBytes(32)));

      const response = await app.inject({
        method: "GET",
        url: "/api/v1/agents",
        headers: { authorization: `Bearer ${hs256Token}` },
      });

      expect(response.statusCode).toBe(401);
      const body = response.json() as { errors: Array<{ code: string }> };
      expect(body.errors[0]?.code).toBe("AUTHENTICATION_ERROR");
    });

    it("rejects HS384-signed token with 401", async () => {
      const hs384Token = await new SignJWT({ sub: "op-attacker" })
        .setProtectedHeader({ alg: "HS384" })
        .setIssuedAt()
        .setExpirationTime("1h")
        .sign(createSecretKey(crypto.randomBytes(48)));

      const response = await app.inject({
        method: "GET",
        url: "/api/v1/agents",
        headers: { authorization: `Bearer ${hs384Token}` },
      });

      expect(response.statusCode).toBe(401);
    });

    it('rejects "none" algorithm token with 401', async () => {
      const header = Buffer.from(
        JSON.stringify({ alg: "none", typ: "JWT" }),
      ).toString("base64url");
      const payload = Buffer.from(
        JSON.stringify({
          sub: "op-bypass",
          iss: ISSUER,
          aud: AUDIENCE,
          iat: Math.floor(Date.now() / 1000),
          exp: Math.floor(Date.now() / 1000) + 3600,
        }),
      ).toString("base64url");
      const noneToken = `${header}.${payload}.`;

      const response = await app.inject({
        method: "GET",
        url: "/api/v1/agents",
        headers: { authorization: `Bearer ${noneToken}` },
      });

      expect(response.statusCode).toBe(401);
    });
  });

  // ─── RS256 acceptance ────────────────────────────────────────────────────────

  describe("RS256 tokens are accepted when valid (SPEC-01 §3)", () => {
    it("accepts a well-formed RS256 token", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/v1/agents",
        headers: { authorization: `Bearer ${validRS256Token}` },
      });

      // 200 = accepted, 404 would mean route not found — both indicate auth passed
      expect(response.statusCode).not.toBe(401);
    });

    it("rejects RS256 token signed with a different key (wrong signature)", async () => {
      const { privateKey } = crypto.generateKeyPairSync("rsa", {
        modulusLength: 2048,
      });
      const wrongKeyPem = privateKey
        .export({ type: "pkcs8", format: "pem" })
        .toString();
      const wrongKey = await importPKCS8(wrongKeyPem, "RS256");

      const tokenWrongKey = await new SignJWT({ sub: "op-forged" })
        .setProtectedHeader({ alg: "RS256", typ: "JWT" })
        .setIssuedAt()
        .setExpirationTime("1h")
        .setIssuer(ISSUER)
        .setAudience(AUDIENCE)
        .sign(wrongKey);

      const response = await app.inject({
        method: "GET",
        url: "/api/v1/agents",
        headers: { authorization: `Bearer ${tokenWrongKey}` },
      });

      expect(response.statusCode).toBe(401);
    });

    it("rejects expired RS256 token with 401", async () => {
      const expiredToken = await new SignJWT({ sub: "op-expired" })
        .setProtectedHeader({ alg: "RS256", typ: "JWT" })
        .setIssuedAt(Math.floor(Date.now() / 1000) - 7200)
        .setExpirationTime(Math.floor(Date.now() / 1000) - 3600)
        .setIssuer(ISSUER)
        .setAudience(AUDIENCE)
        .sign(rs256PrivateKey);

      const response = await app.inject({
        method: "GET",
        url: "/api/v1/agents",
        headers: { authorization: `Bearer ${expiredToken}` },
      });

      expect(response.statusCode).toBe(401);
    });

    it("rejects token with wrong issuer", async () => {
      const wrongIssuerToken = await new SignJWT({ sub: "op-123" })
        .setProtectedHeader({ alg: "RS256", typ: "JWT" })
        .setIssuedAt()
        .setExpirationTime("1h")
        .setIssuer("evil.attacker.com")
        .setAudience(AUDIENCE)
        .sign(rs256PrivateKey);

      const response = await app.inject({
        method: "GET",
        url: "/api/v1/agents",
        headers: { authorization: `Bearer ${wrongIssuerToken}` },
      });

      expect(response.statusCode).toBe(401);
    });

    it("rejects missing Authorization header with 401", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/v1/agents",
      });

      expect(response.statusCode).toBe(401);
      const body = response.json() as { errors: Array<{ code: string }> };
      expect(body.errors[0]?.code).toBe("AUTHENTICATION_ERROR");
    });

    it("rejects malformed Bearer token with 401", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/v1/agents",
        headers: { authorization: "Bearer not.a.jwt" },
      });

      expect(response.statusCode).toBe(401);
    });
  });

  // ─── Anti-timing (SPEC-01 §5) ────────────────────────────────────────────────

  describe("Anti-timing: login response time gap < 200ms (SPEC-01 §5)", () => {
    it("LoginHandler: email-not-found and wrong-password take similar time", async () => {
      // We test the handlers directly to avoid DB dependency.
      // The dummy argon2 hash in LoginHandler ensures timing parity.
      const { LoginHandler } =
        await import("../../src/application/auth/auth.handlers.js");

      const mockDb = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([]), // user not found
            }),
          }),
        }),
      };

      const loginHandler = new LoginHandler(mockDb as never);

      // Measure time for user-not-found (dummy hash runs internally)
      const t0 = performance.now();
      await loginHandler.execute("nonexistent@test.com", "SomeP@ssw0rd!");
      const notFoundMs = performance.now() - t0;

      // Measure time for wrong-password scenario (mock returns a real argon2 hash)
      // Using a pre-hashed dummy password: "wrong" hashed with argon2id
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([
              {
                id: "op-1",
                email: "exists@test.com",
                // Real argon2id hash of "correct" — wrong password will fail verify
                passwordHash:
                  "$argon2id$v=19$m=65536,t=3,p=4$dummysaltvalue123456$dummyhashvalue12345678901234",
                isActive: true,
                emailVerified: true,
                name: "Test",
              },
            ]),
          }),
        }),
      });

      const t1 = performance.now();
      await loginHandler.execute("exists@test.com", "WrongP@ssw0rd!");
      const wrongPassMs = performance.now() - t1;

      // Both should take ~argon2 duration. Difference must be < 200ms.
      const diff = Math.abs(notFoundMs - wrongPassMs);
      expect(diff).toBeLessThan(200);
    });
  });
});
