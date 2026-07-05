import { describe, it, expect } from "vitest";
import { authRoutes } from "../../src/http/routes/auth.routes.js";
import { FastifyInstance } from "fastify";
import fastify from "fastify";

describe("VULN-012: Refresh Token Rate Limiting", () => {
  it("should have rate limiting configured for /refresh endpoint", async () => {
    const app = fastify() as unknown as FastifyInstance;
    // Mock container
    (app as any).container = { db: {}, authEmailService: {} };

    // We need to capture the route registration
    const routes: any[] = [];
    const originalPost = app.post.bind(app);
    app.post = ((url: string, opts: any, handler: any) => {
        routes.push({ url, opts });
        return originalPost(url, opts, handler);
    }) as any;

    await authRoutes(app);

    const refreshRoute = routes.find(r => r.url === "/refresh");
    expect(refreshRoute).toBeDefined();
    expect(refreshRoute.opts?.config?.rateLimit).toBeDefined();
    // In test environment, the limit is higher (1000) to support E2E tests,
    // but in production/other envs it should be 10.
    const expectedMax = process.env["NODE_ENV"] === "test" ? 1000 : 10;
    expect(refreshRoute.opts.config.rateLimit.max).toBe(expectedMax);
  });
});
