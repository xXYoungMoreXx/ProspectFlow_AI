import { describe, it, expect, afterEach } from "vitest";
import { MCPServer } from "../../../../src/domain/agent/MCPServer.js";
import { SecurityError } from "../../../../src/domain/shared/Result.js";

const BASE = {
  agentId: "a1",
  name: "test",
  authType: "none" as const,
  allowedTools: [],
  allowedSubAgentIds: [],
};

afterEach(() => {
  delete process.env["ALLOWED_MCP_HOSTS"];
});

describe("MCPServer.create()", () => {
  it("throws SecurityError for loopback 127.x", () => {
    expect(() =>
      MCPServer.create({ ...BASE, url: "http://127.0.0.1:3000" }),
    ).toThrow(SecurityError);
  });
  it("throws SecurityError for RFC1918 IP not in whitelist", () => {
    expect(() =>
      MCPServer.create({ ...BASE, url: "http://192.168.1.10:3001" }),
    ).toThrow(SecurityError);
  });
  it("accepts internal hostname when in ALLOWED_MCP_HOSTS", () => {
    process.env["ALLOWED_MCP_HOSTS"] = "mcp-brasil,searxng";
    expect(() =>
      MCPServer.create({ ...BASE, url: "http://mcp-brasil:3001" }),
    ).not.toThrow();
  });
  it("accepts public HTTPS URL", () => {
    expect(() =>
      MCPServer.create({ ...BASE, url: "https://api.example.com/mcp" }),
    ).not.toThrow();
  });
  it("assigns a UUID id", () => {
    process.env["ALLOWED_MCP_HOSTS"] = "host";
    const s = MCPServer.create({ ...BASE, url: "http://host:1" });
    expect(s.id).toMatch(/^[0-9a-f-]{36}$/);
  });
});
