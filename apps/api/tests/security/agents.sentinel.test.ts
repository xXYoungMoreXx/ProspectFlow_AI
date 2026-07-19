import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  SaveWorkflowHandler,
  GetWorkflowHandler,
} from "../../src/application/agent/workflow.handlers.js";
import {
  AddMCPServerHandler,
  TestMCPServerHandler,
} from "../../src/application/agent/mcp-server.handlers.js";
import {
  CreateAgentHandler,
  UpdateAgentHandler,
} from "../../src/application/agent/agent.handlers.js";
import { SecurityError, NotFoundError } from "../../src/domain/shared/Result.js";

describe("Agent Security Audit (Sentinel)", () => {
  const mockDb = {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    transaction: vi.fn(),
  } as any;

  const mockAgentRepo = {
    findById: vi.fn(),
    save: vi.fn(),
  } as any;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("VULN-005: IDOR on Agent Sub-resources", () => {
    it("should reject GetWorkflowHandler if operator does not own the agent", async () => {
      const handler = new GetWorkflowHandler(mockDb, mockAgentRepo);
      mockAgentRepo.findById.mockResolvedValue(null); // No agent found or wrong ownership

      await expect(
        handler.execute({ agentId: "agent-1", operatorId: "attacker-op" })
      ).rejects.toThrow(NotFoundError);
    });

    it("should reject SaveWorkflowHandler if operator does not own the agent", async () => {
      const handler = new SaveWorkflowHandler(mockDb, mockAgentRepo);
      mockAgentRepo.findById.mockResolvedValue(null); // Wrong ownership

      await expect(
        handler.execute({
          agentId: "agent-1",
          operatorId: "attacker-op",
          workflow: { nodes: [], edges: [] },
        })
      ).rejects.toThrow(NotFoundError);
    });

    it("should reject AddMCPServerHandler if operator does not own the agent", async () => {
      const handler = new AddMCPServerHandler(mockDb, mockAgentRepo);
      mockAgentRepo.findById.mockResolvedValue(null); // Wrong ownership

      await expect(
        handler.execute({
          agentId: "agent-1",
          operatorId: "attacker-op",
          name: "MCP-Local",
          url: "https://secure.mcp.com",
          authType: "none",
        })
      ).rejects.toThrow(NotFoundError);
    });

    it("should reject TestMCPServerHandler if operator does not own the agent", async () => {
      const handler = new TestMCPServerHandler(mockDb, mockAgentRepo);
      mockAgentRepo.findById.mockResolvedValue(null); // Wrong ownership

      await expect(
        handler.execute({
          agentId: "agent-1",
          mcpId: "mcp-123",
          operatorId: "attacker-op",
        })
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe("VULN-006: SSRF on Custom LLM Base URL", () => {
    it("should reject CreateAgentHandler with local/private LLM Base URL", async () => {
      const handler = new CreateAgentHandler(mockAgentRepo);

      const result = await handler.execute("operator-123", {
        name: "Malicious Agent",
        persona: "HUNTER",
        llmProvider: "OLLAMA",
        llmModel: "llama3",
        llmBaseUrl: "http://127.0.0.1:8545/evil",
      });

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error).toBeInstanceOf(SecurityError);
      }
    });

    it("should reject UpdateAgentHandler with local/private LLM Base URL", async () => {
      const handler = new UpdateAgentHandler(mockAgentRepo);
      const mockAgent = {
        llmConfig: { provider: "OLLAMA", model: "llama3" },
        updateConfig: vi.fn(),
      };
      mockAgentRepo.findById.mockResolvedValue(mockAgent);

      const result = await handler.execute("agent-123", "operator-123", {
        llmBaseUrl: "http://169.254.169.254/latest/meta-data/",
      });

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error).toBeInstanceOf(SecurityError);
      }
    });

    it("should block advanced SSRF loopback/private bypass attempts", async () => {
      const handler = new CreateAgentHandler(mockAgentRepo);

      // 1. IPv6 bracket loopback
      const r1 = await handler.execute("op-123", {
        name: "IPv6 Loopback",
        persona: "HUNTER",
        llmProvider: "OLLAMA",
        llmModel: "llama3",
        llmBaseUrl: "http://[::1]:11434/api/chat",
      });
      expect(r1.isErr()).toBe(true);

      // 2. Integer loopback (2130706433 = 127.0.0.1)
      const r2 = await handler.execute("op-123", {
        name: "Int Loopback",
        persona: "HUNTER",
        llmProvider: "OLLAMA",
        llmModel: "llama3",
        llmBaseUrl: "http://2130706433:11434/api/chat",
      });
      expect(r2.isErr()).toBe(true);

      // 3. Hex loopback parts (0x7f.0x0.0x0.0x1 = 127.0.0.1)
      const r3 = await handler.execute("op-123", {
        name: "Hex Loopback",
        persona: "HUNTER",
        llmProvider: "OLLAMA",
        llmModel: "llama3",
        llmBaseUrl: "http://0x7f.0x0.0x0.0x1:11434/api/chat",
      });
      expect(r3.isErr()).toBe(true);

      // 4. Octal loopback parts (0177.0.0.01 = 127.0.0.1)
      const r4 = await handler.execute("op-123", {
        name: "Octal Loopback",
        persona: "HUNTER",
        llmProvider: "OLLAMA",
        llmModel: "llama3",
        llmBaseUrl: "http://0177.0.0.01:11434/api/chat",
      });
      expect(r4.isErr()).toBe(true);

      // 5. Wildcard 0.0.0.0
      const r5 = await handler.execute("op-123", {
        name: "Wildcard Any",
        persona: "HUNTER",
        llmProvider: "OLLAMA",
        llmModel: "llama3",
        llmBaseUrl: "http://0.0.0.0:11434/api/chat",
      });
      expect(r5.isErr()).toBe(true);
    });

    it("should accept safe, standard public hostnames", async () => {
      const handler = new CreateAgentHandler(mockAgentRepo);

      const result = await handler.execute("op-123", {
        name: "Safe Agent",
        persona: "HUNTER",
        llmProvider: "ANTHROPIC",
        llmModel: "claude-3",
        llmBaseUrl: "https://api.anthropic.com/v1",
      });

      expect(result.isOk()).toBe(true);
    });
  });
});
