import { eq, and } from "drizzle-orm";
import { mcpServers } from "../../infrastructure/db/schema.js";
import { MCPServer } from "../../domain/agent/MCPServer.js";
import { NotFoundError } from "../../domain/shared/Result.js";

type Db = any;
type AgentRepo = any;

export class AddMCPServerHandler {
  constructor(
    private readonly database: Db,
    private readonly agentRepo: AgentRepo,
  ) {}

  async execute(cmd: {
    agentId: string;
    operatorId: string;
    organizationId?: string;
    name: string;
    url: string;
    authType: "none" | "bearer" | "api_key";
    authSecretRef?: string;
    allowedTools?: string[];
    allowedSubAgentIds?: string[];
  }) {
    const agent = await this.agentRepo.findById(
      cmd.agentId,
      cmd.operatorId,
      cmd.organizationId ?? "org_mvp"
    );
    if (!agent) {
      throw new NotFoundError("Agent", cmd.agentId);
    }

    // Domain entity validates SSRF
    const server = MCPServer.create({
      ...cmd,
      allowedTools: cmd.allowedTools ?? [],
      allowedSubAgentIds: cmd.allowedSubAgentIds ?? [],
    });

    try {
      const res = await fetch(`${cmd.url}/health`, {
        signal: AbortSignal.timeout(5_000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
    } catch {
      const e = new Error("MCP server não respondeu ao ping") as Error & {
        code: string;
      };
      e.code = "MCP_CONNECTION_FAILED";
      throw e;
    }

    // Schema columns: id (auto), agentId, name, url, authRef, isEnabled, createdAt
    const [saved] = (await this.database
      .insert(mcpServers)
      .values({
        agentId: server.agentId,
        name: server.name,
        url: server.url,
        authRef: server.authSecretRef ?? null,
        isEnabled: true,
      })
      .returning()
      .execute()) as unknown[];

    return { data: saved };
  }
}

export class TestMCPServerHandler {
  constructor(
    private readonly database: Db,
    private readonly agentRepo: AgentRepo,
  ) {}

  async execute(cmd: {
    mcpId: string;
    agentId: string;
    operatorId: string;
    organizationId?: string;
  }) {
    const agent = await this.agentRepo.findById(
      cmd.agentId,
      cmd.operatorId,
      cmd.organizationId ?? "org_mvp"
    );
    if (!agent) {
      throw new NotFoundError("Agent", cmd.agentId);
    }

    const [server] = (await this.database
      .select()
      .from(mcpServers)
      .where(
        and(eq(mcpServers.id, cmd.mcpId), eq(mcpServers.agentId, cmd.agentId)),
      )
      .limit(1)
      .execute()) as Array<Record<string, unknown>>;

    if (!server) throw new NotFoundError("MCPServer", cmd.mcpId);

    const start = Date.now();
    try {
      const res = await fetch(`${server["url"] as string}/tools`, {
        signal: AbortSignal.timeout(5_000),
      });
      const body = (await res.json()) as { tools?: string[] };
      return {
        data: {
          connected: true,
          tools: body.tools ?? [],
          latencyMs: Date.now() - start,
        },
      };
    } catch {
      return {
        data: { connected: false, tools: [], latencyMs: Date.now() - start },
      };
    }
  }
}
