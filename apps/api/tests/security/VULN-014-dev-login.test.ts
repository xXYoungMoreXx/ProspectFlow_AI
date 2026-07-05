import { describe, it, expect, vi } from "vitest";
import { DevLoginHandler } from "../../src/application/auth/auth.handlers.js";

describe("VULN-014: Insecure DevLogin Backdoor", () => {
  it("should strictly refuse execution if NODE_ENV is NOT development or test", async () => {
    const originalEnv = process.env["NODE_ENV"];
    process.env["NODE_ENV"] = "production";

    const handler = new DevLoginHandler({} as any);
    const result = await handler.execute("admin@example.com", "password");

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
        expect(result.error.message.toLowerCase()).toContain("não disponível em produção");
    }

    process.env["NODE_ENV"] = originalEnv;
  });
});
