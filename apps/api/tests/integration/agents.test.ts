import { describe, it, expect, vi, beforeEach, afterEach, beforeAll } from "vitest";
import { buildApp } from "../../src/app.js";
import type { FastifyInstance } from "fastify";
import { SignJWT, importPKCS8 } from "jose";
import { ulid } from "ulid";

describe("Agents Endpoints Integration", () => {
  let app: FastifyInstance;
  let validToken: string;

  // Create a mock for AgentRepository
  const mockAgentRepo = {
    save: vi.fn(),
    findById: vi.fn(),
    findList: vi.fn(),
  };

  beforeAll(async () => {
    // Generate a valid JWT for tests
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

    // Inject the mocked repo into the container
    app.container.agentRepo = mockAgentRepo as any;
  });

  afterEach(async () => {
    if (app) await app.close();
  });

  it("should return 401 if not authenticated", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/agents",
      payload: {
        name: "Test Agent",
        persona: "HUNTER",
        llmProvider: "ANTHROPIC",
        llmModel: "claude-3",
      },
    });
    expect(response.statusCode).toBe(401);
  });

  it("should return 400 for invalid creation payload (validation error)", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/agents",
      headers: { authorization: `Bearer ${validToken}` },
      payload: { name: "", persona: "INVALID" },
    });
    expect(response.statusCode).toBe(400);
    const body = response.json();
    expect(body.errors[0].code).toBe("VALIDATION_ERROR");
  });

  it("should create an agent and return 201", async () => {
    mockAgentRepo.save.mockResolvedValueOnce(undefined);

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/agents",
      headers: { authorization: `Bearer ${validToken}` },
      payload: {
        name: "Test Agent",
        persona: "HUNTER",
        llmProvider: "ANTHROPIC",
        llmModel: "claude-3",
      },
    });

    expect(response.statusCode).toBe(201);
    const body = response.json();
    expect(body.data.name).toBe("Test Agent");
    expect(mockAgentRepo.save).toHaveBeenCalledTimes(1);
  });

  it("should return 404 when getting an unknown agent", async () => {
    mockAgentRepo.findById.mockResolvedValueOnce(null);

    const response = await app.inject({
      method: "GET",
      url: "/api/v1/agents/ag-unknown",
      headers: { authorization: `Bearer ${validToken}` },
    });

    expect(response.statusCode).toBe(404);
  });
});
