import type {
  DeploymentOptions,
  DeploymentResult,
  DeploymentProvider,
} from "./DeploymentRouter.js";
import { ok, err } from "../../domain/shared/Result.js";
import type { Result } from "../../domain/shared/Result.js";

/**
 * SPEC-06: Cloudflare Pages adapter — primary CF deploy via Direct Upload API v2.
 * Used as secondary fallback after Vercel fails.
 */
export class CloudflarePagesAdapter implements DeploymentProvider {
  readonly name = "CloudflarePages";
  constructor(
    private readonly accountId: string,
    private readonly apiToken: string,
  ) {}

  async deploy(
    options: DeploymentOptions,
  ): Promise<Result<DeploymentResult, Error>> {
    try {
      const projectName = `agentepro-${options.projectId.toLowerCase().replace(/[^a-z0-9]/g, "-")}`;

      // 1. Ensure project exists
      await this.ensureProject(projectName);

      // 2. Create deployment via Direct Upload
      const deployRes = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${this.accountId}/pages/projects/${projectName}/deployments`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${this.apiToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            production_branch: "main",
            env_vars: options.envVars ?? {},
          }),
          signal: AbortSignal.timeout(60_000),
        },
      );

      if (!deployRes.ok) {
        const text = await deployRes.text();
        return err(
          new Error(
            `Cloudflare Pages deploy failed [${deployRes.status}]: ${text}`,
          ),
        );
      }

      const data = (await deployRes.json()) as {
        result: { id: string; url: string; aliases?: string[] };
      };

      const deployment = data.result;
      return ok({
        url: deployment.aliases?.[0] ?? deployment.url,
        provider: "vercel" as const, // type compat — extend enum if needed
        deploymentId: deployment.id,
      });
    } catch (e) {
      return err(e instanceof Error ? e : new Error(String(e)));
    }
  }

  async getRemainingQuota(): Promise<number> {
    // CF Pages has generous limits — return high number unless API returns error
    try {
      const res = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${this.accountId}/pages/projects`,
        {
          headers: { Authorization: `Bearer ${this.apiToken}` },
          signal: AbortSignal.timeout(10_000),
        },
      );
      return res.ok ? 100 : 0;
    } catch {
      return 0;
    }
  }

  private async ensureProject(name: string): Promise<void> {
    const res = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${this.accountId}/pages/projects`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name, production_branch: "main" }),
        signal: AbortSignal.timeout(15_000),
      },
    );
    // 409 = already exists — that's fine
    if (!res.ok && res.status !== 409) {
      const text = await res.text();
      throw new Error(`Failed to create CF Pages project: ${text}`);
    }
  }
}
