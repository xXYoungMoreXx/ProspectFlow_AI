import { randomUUID } from "crypto";
import { SecurityError } from "../shared/Result.js";

export type MCPAuthType = "none" | "bearer" | "api_key";

interface CreateMCPServerProps {
  agentId: string;
  name: string;
  url: string;
  authType: MCPAuthType;
  authSecretRef?: string;
  allowedTools: string[];
  allowedSubAgentIds: string[];
}

const RFC1918_PATTERNS = [
  /^127\./,
  /^10\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^192\.168\./,
  /^::1$/,
  /^localhost$/i,
];

function isRFC1918OrLoopback(hostname: string): boolean {
  return RFC1918_PATTERNS.some((re) => re.test(hostname));
}

export function isAllowedMCPUrl(url: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  const hostname = parsed.hostname;
  if (!isRFC1918OrLoopback(hostname)) return true;
  const allowed = (process.env["ALLOWED_MCP_HOSTS"] ?? "")
    .split(",")
    .filter(Boolean);
  return allowed.includes(hostname);
}

export class MCPServer {
  readonly id: string;
  readonly agentId: string;
  readonly name: string;
  readonly url: string;
  readonly authType: MCPAuthType;
  readonly authSecretRef: string | undefined;
  readonly allowedTools: string[];
  readonly allowedSubAgentIds: string[];
  isEnabled: boolean;

  private constructor(
    props: CreateMCPServerProps & { id: string; isEnabled: boolean },
  ) {
    this.id = props.id;
    this.agentId = props.agentId;
    this.name = props.name;
    this.url = props.url;
    this.authType = props.authType;
    this.authSecretRef = props.authSecretRef;
    this.allowedTools = props.allowedTools;
    this.allowedSubAgentIds = props.allowedSubAgentIds;
    this.isEnabled = props.isEnabled;
  }

  static create(props: CreateMCPServerProps): MCPServer {
    if (!isAllowedMCPUrl(props.url)) {
      throw new SecurityError(
        `URL MCP não permitida (SSRF protection): ${props.url}`,
      );
    }
    return new MCPServer({ ...props, id: randomUUID(), isEnabled: true });
  }

  static reconstitute(
    props: CreateMCPServerProps & { id: string; isEnabled: boolean },
  ): MCPServer {
    return new MCPServer(props);
  }
}
