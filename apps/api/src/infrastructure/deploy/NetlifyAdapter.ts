import { ok, err, type Result } from "../../domain/shared/Result.js";
import type {
  DeploymentProvider,
  DeploymentOptions,
  DeploymentResult,
} from "./DeploymentRouter.js";

export class NetlifyAdapter implements DeploymentProvider {
  readonly name = "Netlify";
  constructor(private readonly apiKey: string) {}

  async deploy(
    options: DeploymentOptions,
  ): Promise<Result<DeploymentResult, Error>> {
    // Simulated Netlify deployment
    if (!this.apiKey) return err(new Error("Netlify API key is missing"));

    return ok({
      url: `https://proj-${options.projectId}.netlify.app`,
      provider: "netlify",
      deploymentId: `ntl_${Date.now()}`,
    });
  }

  async getRemainingQuota(): Promise<number> {
    // Netlify (fallback) quota check
    return Promise.resolve(100);
  }
}
