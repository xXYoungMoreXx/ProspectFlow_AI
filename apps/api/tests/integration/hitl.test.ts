import { describe, it, expect, vi, beforeEach, afterEach, beforeAll } from "vitest";
import { buildApp } from "../../src/app.js";
import type { FastifyInstance } from "fastify";
import { SignJWT, importPKCS8 } from "jose";
import { ulid } from "ulid";

describe("HITL Endpoints Integration", () => {
  let app: FastifyInstance;
  let validToken: string;

  const mockHitlRepo = {
    save: vi.fn(),
    findById: vi.fn(),
    findPending: vi.fn(),
  };

  beforeAll(async () => {
    const keyStr = process.env.JWT_PRIVATE_KEY || "dummy";
    const key = await importPKCS8(keyStr.replace(/\\n/g, "\n"), "RS256");
    validToken = await new SignJWT({ sub: "op-123", email: "test@example.com" })
      .setProtectedHeader({ alg: "RS256", typ: "JWT" })
      .setIssuedAt()
      .setExpirationTime("1h")
      .setIssuer("agentepro.local")
      .setAudience("agentepro-api")
      .setJti(ulid())
      .sign(key);
  });

  beforeEach(async () => {
    vi.clearAllMocks();
    app = await buildApp();
    app.container.hitlRepo = mockHitlRepo as any;
  });

  afterEach(async () => {
    if (app) await app.close();
  });

  it("should return pending approvals", async () => {
    mockHitlRepo.findPending.mockResolvedValueOnce([]);

    const response = await app.inject({
      method: "GET",
      url: "/api/v1/hitl/pending",
      headers: { authorization: `Bearer ${validToken}` },
    });

    if (response.statusCode === 500) console.log(response.body);
    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.data).toEqual([]);
    expect(mockHitlRepo.findPending).toHaveBeenCalledWith("op-123");
  });

  it("should return 404 when approving unknown hitl", async () => {
    mockHitlRepo.findById.mockResolvedValueOnce(null);

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/hitl/hitl-unknown/approve",
      headers: { authorization: `Bearer ${validToken}` },
      payload: { note: "Looks good" },
    });

    expect(response.statusCode).toBe(404);
  });

  it("should successfully approve a pending HITL request", async () => {
    const { HITLApproval } =
      await import("../../src/domain/hitl/HITLApproval.js");
    const mockHitl = HITLApproval.reconstitute({
      id: "hitl-123",
      operatorId: "op-123",
      agentId: "ag-1",
      actionType: "SEND_QUOTE",
      contextType: "LEAD",
      contextId: "lead-1",
      payloadPreview: { amount: 500 },
      status: "PENDING",
      expiresAt: new Date(Date.now() + 1000 * 60 * 60), // Expires in 1 hour
      createdAt: new Date(),
    });

    mockHitlRepo.findById.mockResolvedValueOnce(mockHitl);
    mockHitlRepo.save.mockResolvedValueOnce(undefined);

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/hitl/hitl-123/approve",
      headers: { authorization: `Bearer ${validToken}` },
      payload: { note: "Approved looks good" },
    });

    expect(response.statusCode).toBe(200);
    expect(mockHitl.status).toBe("APPROVED");
    expect(mockHitlRepo.save).toHaveBeenCalledTimes(1);
    expect(mockHitlRepo.save).toHaveBeenCalledWith(mockHitl);
  });

  it("should successfully reject a pending HITL request", async () => {
    const { HITLApproval } =
      await import("../../src/domain/hitl/HITLApproval.js");
    const mockHitl = HITLApproval.reconstitute({
      id: "hitl-124",
      operatorId: "op-123",
      agentId: "ag-1",
      actionType: "SEND_QUOTE",
      contextType: "LEAD",
      contextId: "lead-1",
      payloadPreview: { amount: 500 },
      status: "PENDING",
      expiresAt: new Date(Date.now() + 1000 * 60 * 60),
      createdAt: new Date(),
    });

    mockHitlRepo.findById.mockResolvedValueOnce(mockHitl);
    mockHitlRepo.save.mockResolvedValueOnce(undefined);

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/hitl/hitl-124/reject",
      headers: { authorization: `Bearer ${validToken}` },
      payload: { note: "Amount is too low" },
    });

    expect(response.statusCode).toBe(200);
    expect(mockHitl.status).toBe("REJECTED");
    expect(mockHitlRepo.save).toHaveBeenCalledWith(mockHitl);
  });

  it("should successfully edit and approve a pending HITL request", async () => {
    const { HITLApproval } =
      await import("../../src/domain/hitl/HITLApproval.js");
    const mockHitl = HITLApproval.reconstitute({
      id: "hitl-125",
      operatorId: "op-123",
      agentId: "ag-1",
      actionType: "SEND_QUOTE",
      contextType: "LEAD",
      contextId: "lead-1",
      payloadPreview: { amount: 500 },
      status: "PENDING",
      expiresAt: new Date(Date.now() + 1000 * 60 * 60),
      createdAt: new Date(),
    });

    mockHitlRepo.findById.mockResolvedValueOnce(mockHitl);
    mockHitlRepo.save.mockResolvedValueOnce(undefined);

    const response = await app.inject({
      method: "PATCH",
      url: "/api/v1/hitl/hitl-125/edit-and-approve",
      headers: { authorization: `Bearer ${validToken}` },
      payload: { editedPayload: { amount: 600 }, note: "Corrected amount" },
    });

    expect(response.statusCode).toBe(200);
    expect(mockHitl.status).toBe("EDITED_APPROVED");
    expect(mockHitl.payloadPreview).toEqual({ amount: 600 });
    expect(mockHitlRepo.save).toHaveBeenCalledWith(mockHitl);
  });
});
