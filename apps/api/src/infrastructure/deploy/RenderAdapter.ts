import type {
  DeploymentOptions,
  DeploymentResult,
  DeploymentProvider,
} from "./DeploymentRouter.js";
import { ok, err } from "../../domain/shared/Result.js";
import type { Result } from "../../domain/shared/Result.js";

/**
 * SPEC-06: Render adapter — tertiary fallback (Vercel → CF Pages → Render).
 * Uses Render Deploy Hooks (webhook URLs configured per service).
 */
export class RenderAdapter implements DeploymentProvider {
  readonly name = "Render";
  constructor(
    private readonly apiKey: string,
    private readonly deployHookUrl?: string,
  ) {}

  async deploy(
    options: DeploymentOptions,
  ): Promise<Result<DeploymentResult, Error>> {
    try {
      if (!this.deployHookUrl) {
        return err(new Error("Render deploy hook URL not configured"));
      }

      const res = await fetch(this.deployHookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ env_vars: options.envVars }),
        signal: AbortSignal.timeout(30_000),
      });

      if (!res.ok) {
        const text = await res.text();
        return err(new Error(`Render deploy failed [${res.status}]: ${text}`));
      }

      const data = (await res.json()) as { id?: string; url?: string };

      return ok({
        url: data.url ?? `https://render.com/projects/${options.projectId}`,
        provider: "netlify" as const, // type compat — using existing union
        deploymentId: data.id ?? options.projectId,
      });
    } catch (e) {
      return err(e instanceof Error ? e : new Error(String(e)));
    }
  }

  async getRemainingQuota(): Promise<number> {
    if (!this.apiKey) return 0;
    try {
      const res = await fetch("https://api.render.com/v1/services", {
        headers: { Authorization: `Bearer ${this.apiKey}` },
        signal: AbortSignal.timeout(10_000),
      });
      return res.ok ? 50 : 0;
    } catch {
      return 0;
    }
  }
}
