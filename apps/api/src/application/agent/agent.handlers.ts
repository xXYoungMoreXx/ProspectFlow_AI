import { ulid } from "ulid";
import type {
  AgentRepository,
  AgentFilters,
  AgentListResult,
} from "../../domain/agent/AgentRepository.js";
import { Agent, type LLMConfiguration } from "../../domain/agent/Agent.js";
import {
  NotFoundError,
  SecurityError,
  ok,
  err,
  type Result,
} from "../../domain/shared/Result.js";
import type { AgentPersona, LLMProvider } from "@agentepro/shared-types";

export function isValidLlmBaseUrl(url: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  let hostname = parsed.hostname.toLowerCase();

  // Strip surrounding square brackets for IPv6 addresses
  if (hostname.startsWith("[") && hostname.endsWith("]")) {
    hostname = hostname.slice(1, -1);
  }

  // Block common SSRF hostnames
  const blockedHostnames = ["localhost", "metadata.google.internal", "0.0.0.0"];
  if (blockedHostnames.includes(hostname)) {
    return false;
  }

  // Block IPv6 loopbacks / wildcards
  if (hostname === "::1" || hostname === "::") {
    return false;
  }

  // Check dotted IPv4
  const ipv4Parts = hostname.split(".");
  if (ipv4Parts.length === 4) {
    try {
      const nums = ipv4Parts.map(part => {
        let val: number;
        if (part.startsWith("0x") || part.startsWith("0X")) {
          val = parseInt(part, 16);
        } else if (part.startsWith("0") && part.length > 1) {
          val = parseInt(part, 8);
        } else {
          val = parseInt(part, 10);
        }
        if (isNaN(val) || val < 0 || val > 255) {
          throw new Error("Invalid IP part");
        }
        return val;
      });

      const ipStr = nums.join(".");
      if (
        ipStr.startsWith("127.") ||
        ipStr.startsWith("10.") ||
        ipStr.startsWith("192.168.") ||
        ipStr.startsWith("169.254.") ||
        ipStr === "0.0.0.0"
      ) {
        return false;
      }
      if (nums[0] === 172 && nums[1]! >= 16 && nums[1]! <= 31) {
        return false;
      }
    } catch {
      // Not a valid dotted IPv4, continue
    }
  } else {
    // Check if it is a single large integer representation (decimal, hex, octal)
    let parsedInt: number | null = null;
    try {
      if (hostname.startsWith("0x") || hostname.startsWith("0X")) {
        parsedInt = parseInt(hostname, 16);
      } else if (hostname.startsWith("0") && hostname.length > 1 && /^[0-7]+$/.test(hostname)) {
        parsedInt = parseInt(hostname, 8);
      } else if (/^\d+$/.test(hostname)) {
        parsedInt = parseInt(hostname, 10);
      }
    } catch {
      // Ignore parse errors
    }

    if (parsedInt !== null && !isNaN(parsedInt) && parsedInt >= 0 && parsedInt <= 0xffffffff) {
      const part1 = (parsedInt >> 24) & 0xff;
      const part2 = (parsedInt >> 16) & 0xff;
      const part3 = (parsedInt >> 8) & 0xff;
      const part4 = parsedInt & 0xff;
      const ipStr = `${part1}.${part2}.${part3}.${part4}`;

      if (
        ipStr.startsWith("127.") ||
        ipStr.startsWith("10.") ||
        ipStr.startsWith("192.168.") ||
        ipStr.startsWith("169.254.") ||
        ipStr === "0.0.0.0"
      ) {
        return false;
      }
      if (part1 === 172 && part2 >= 16 && part2 <= 31) {
        return false;
      }
    }
  }

  const allowed = (process.env["ALLOWED_LLM_HOSTS"] ?? "")
    .split(",")
    .filter(Boolean);
  return allowed.includes(hostname) || !allowed.length; // Defaults to allowing standard public hostnames if allowed list is empty
}
import type { CompositeLLMRouter } from "../../infrastructure/llm/CompositeLLMRouter.js";

// ── Commands ──────────────────────────────────────────────────────────────────

export class CreateAgentHandler {
  constructor(private readonly repo: AgentRepository) {}

  async execute(
    operatorId: string,
    input: {
      name: string;
      persona: AgentPersona;
      llmProvider: LLMProvider;
      llmModel: string;
      llmBaseUrl?: string;
      llmApiKeyRef?: string;
      llmTemperature?: number;
      llmMaxTokens?: number;
      llmSystemPrompt?: string;
    },
  ): Promise<Result<Agent, Error>> {
    if (input.llmBaseUrl && !isValidLlmBaseUrl(input.llmBaseUrl)) {
      return err(new SecurityError(`URL LLM não permitida (SSRF protection): ${input.llmBaseUrl}`));
    }

    const llmConfig: LLMConfiguration = {
      provider: input.llmProvider,
      model: input.llmModel,
      baseUrl: input.llmBaseUrl,
      apiKeyRef: input.llmApiKeyRef,
      temperature: input.llmTemperature ?? 0.7,
      maxTokens: input.llmMaxTokens ?? 4096,
      systemPrompt: input.llmSystemPrompt,
    };

    const agentResult = Agent.create({
      id: ulid(),
      operatorId,
      name: input.name,
      persona: input.persona,
      llmConfig,
    });

    if (agentResult.isErr()) return agentResult;

    const agent = agentResult.value;
    await this.repo.save(agent);
    return ok(agent);
  }
}

export class UpdateAgentHandler {
  constructor(private readonly repo: AgentRepository) {}

  async execute(
    agentId: string,
    operatorId: string,
    updates: Record<string, unknown>,
    organizationId: string = "org_mvp",
  ): Promise<Result<Agent, Error>> {
    const agent = await this.repo.findById(agentId, operatorId, organizationId);
    if (!agent) return err(new NotFoundError("Agent", agentId));

    // Map flat updates to domain model
    const configUpdates: Parameters<Agent["updateConfig"]>[0] = {};
    if (updates["name"] !== undefined)
      configUpdates.name = updates["name"] as string;
    if (updates["ragEnabled"] !== undefined)
      configUpdates.ragEnabled = updates["ragEnabled"] as boolean;
    if (updates["ragCollection"] !== undefined)
      configUpdates.ragCollection = updates["ragCollection"] as string;
    if (updates["ragTopK"] !== undefined)
      configUpdates.ragTopK = updates["ragTopK"] as number;
    if (updates["ragThreshold"] !== undefined)
      configUpdates.ragThreshold = updates["ragThreshold"] as number;
    if (updates["hitlTimeoutMinutes"] !== undefined)
      configUpdates.hitlTimeoutMinutes = updates[
        "hitlTimeoutMinutes"
      ] as number;
    if (updates["hitlNotifyChannel"] !== undefined)
      configUpdates.hitlNotifyChannel = updates["hitlNotifyChannel"] as string;

    // LLM config rebuild if any llm field present
    if (
      updates["llmProvider"] ||
      updates["llmModel"] ||
      updates["llmTemperature"] ||
      updates["llmMaxTokens"] ||
      updates["llmSystemPrompt"] ||
      updates["llmBaseUrl"] !== undefined
    ) {
      const newBaseUrl = updates["llmBaseUrl"] !== undefined ? updates["llmBaseUrl"] as string | undefined : agent.llmConfig.baseUrl;
      if (newBaseUrl && !isValidLlmBaseUrl(newBaseUrl)) {
        return err(new SecurityError(`URL LLM não permitida (SSRF protection): ${newBaseUrl}`));
      }

      configUpdates.llmConfig = {
        provider: (updates["llmProvider"] ??
          agent.llmConfig.provider) as LLMProvider,
        model: (updates["llmModel"] ?? agent.llmConfig.model) as string,
        baseUrl: newBaseUrl,
        apiKeyRef: (updates["llmApiKeyRef"] ?? agent.llmConfig.apiKeyRef) as
          | string
          | undefined,
        temperature: (updates["llmTemperature"] ??
          agent.llmConfig.temperature) as number,
        maxTokens: (updates["llmMaxTokens"] ??
          agent.llmConfig.maxTokens) as number,
        systemPrompt: (updates["llmSystemPrompt"] ??
          agent.llmConfig.systemPrompt) as string | undefined,
      };
    }

    agent.updateConfig(configUpdates);
    await this.repo.save(agent);
    return ok(agent);
  }
}

export class ActivateAgentHandler {
  constructor(
    private readonly repo: AgentRepository,
    private readonly llm?: CompositeLLMRouter,
  ) {}

  async execute(
    agentId: string,
    operatorId: string,
    organizationId: string = "org_mvp",
  ): Promise<Result<void, Error>> {
    const agent = await this.repo.findById(agentId, operatorId, organizationId);
    if (!agent) return err(new NotFoundError("Agent", agentId));

    // SPEC-02 rule 3: verify LLM connectivity before activation
    if (this.llm) {
      const available = await this.llm
        .isAvailable(agent.llmConfig.provider)
        .catch(() => false);
      if (!available) {
        const e = new Error(
          `LLM provider '${agent.llmConfig.provider}' is not reachable`,
        );
        (e as NodeJS.ErrnoException).code = "LLM_CONNECTIVITY_ERROR";
        return err(e);
      }
    }

    const result = agent.activate();
    if (result.isErr()) return result;

    await this.repo.save(agent);
    return ok(undefined);
  }
}

export class PauseAgentHandler {
  constructor(private readonly repo: AgentRepository) {}

  async execute(
    agentId: string,
    operatorId: string,
    reason?: string,
    organizationId: string = "org_mvp",
  ): Promise<Result<void, Error>> {
    const agent = await this.repo.findById(agentId, operatorId, organizationId);
    if (!agent) return err(new NotFoundError("Agent", agentId));

    const result = agent.pause(reason);
    if (result.isErr()) return result;

    await this.repo.save(agent);
    return ok(undefined);
  }
}

// ── Queries ───────────────────────────────────────────────────────────────────

export class GetAgentsHandler {
  constructor(private readonly repo: AgentRepository) {}

  async execute(filters: AgentFilters): Promise<AgentListResult> {
    return this.repo.findMany(filters);
  }
}

export class GetAgentByIdHandler {
  constructor(private readonly repo: AgentRepository) {}

  async execute(
    agentId: string,
    operatorId: string,
    organizationId: string = "org_mvp",
  ): Promise<Result<Agent, NotFoundError>> {
    const agent = await this.repo.findById(agentId, operatorId, organizationId);
    if (!agent) return err(new NotFoundError("Agent", agentId));
    return ok(agent);
  }
}
