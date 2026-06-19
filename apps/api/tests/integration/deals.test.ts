import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  afterEach,
  beforeAll,
} from "vitest";
import { buildApp } from "../../src/app.js";
import type { FastifyInstance } from "fastify";
import { SignJWT, importPKCS8 } from "jose";
import { ulid } from "ulid";

describe("Deals Endpoints Integration", () => {
  let app: FastifyInstance;
  let validToken: string;

  const mockDealRepo = {
    save: vi.fn(),
    findById: vi.fn(),
    findMany: vi.fn(),
  };

  beforeAll(async () => {
    const keyStr = process.env.JWT_PRIVATE_KEY || "dummy";
    const key = await importPKCS8(keyStr.replace(/\\n/g, "\n"), "RS256");
    validToken = await new SignJWT({ sub: "op-123", email: "test@example.com" })
      .setProtectedHeader({ alg: "RS256", typ: "JWT" })
      .setIssuedAt()
      .setExpirationTime("1h")
      .setIssuer("hefesto.local")
      .setAudience("hefesto-api")
      .setJti(ulid())
      .sign(key);
  });

  beforeEach(async () => {
    vi.clearAllMocks();
    app = await buildApp();
    app.container.dealRepo = mockDealRepo as any;
  });

  afterEach(async () => {
    if (app) await app.close();
  });

  it("should return empty list of deals", async () => {
    mockDealRepo.findMany.mockResolvedValueOnce({
      deals: [],
      total: 0,
      nextCursor: null,
    });

    const response = await app.inject({
      method: "GET",
      url: "/api/v1/deals",
      headers: { authorization: `Bearer ${validToken}` },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.data).toEqual([]);
    expect(mockDealRepo.findMany).toHaveBeenCalled();
  });

  it("should return 404 when canceling unknown deal", async () => {
    mockDealRepo.findById.mockResolvedValueOnce(null);

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/deals/deal-123/cancel",
      headers: { authorization: `Bearer ${validToken}` },
      payload: { reason: "Client changed mind" },
    });

    expect(response.statusCode).toBe(404);
  });

  it("should return 400 validation error when cancel reason is missing", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/deals/deal-123/cancel",
      headers: { authorization: `Bearer ${validToken}` },
      payload: {},
    });

    expect(response.statusCode).toBe(400);
  });
});
