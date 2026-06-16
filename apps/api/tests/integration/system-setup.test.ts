import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { buildApp } from "../../src/app.js";
import type { FastifyInstance } from "fastify";

/**
 * Covers the local-first onboarding contract consumed by the web client:
 * GET /api/v1/system/setup-status tells the frontend whether the local
 * backend already has an admin (skip the setup wizard) and the deployment mode.
 */
describe("System setup-status", () => {
  let app: FastifyInstance;

  const mockDb = {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn(),
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    app = await buildApp();
    app.container.db = mockDb as never;
  });

  afterEach(async () => {
    if (app) await app.close();
  });

  it("returns needsSetup=true and mode=local when no admin exists", async () => {
    mockDb.limit.mockResolvedValueOnce([]); // no operators

    const res = await app.inject({
      method: "GET",
      url: "/api/v1/system/setup-status",
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data.hasUsers).toBe(false);
    expect(body.data.needsSetup).toBe(true);
    expect(body.data.mode).toBe("local");
    expect(typeof body.data.llmConfigured).toBe("boolean");
  });

  it("returns hasUsers=true and needsSetup=false when an admin exists", async () => {
    mockDb.limit.mockResolvedValueOnce([{ id: "op_1" }]);

    const res = await app.inject({
      method: "GET",
      url: "/api/v1/system/setup-status",
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data.hasUsers).toBe(true);
    expect(body.data.needsSetup).toBe(false);
  });
});
