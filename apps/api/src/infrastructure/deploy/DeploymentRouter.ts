import { err, type Result } from "../../domain/shared/Result.js";

export interface DeploymentOptions {
  projectId: string;
  sourceCodePath: string;
  envVars?: Record<string, string>;
  requireHITL?: boolean; // SPEC-06: true for production deploys
}

export interface DeploymentResult {
  url: string;
  provider: "vercel" | "netlify" | "cloudflare" | "render";
  deploymentId: string;
}

export interface DeploymentProvider {
  deploy(options: DeploymentOptions): Promise<Result<DeploymentResult, Error>>;
  getRemainingQuota(): Promise<number>;
  readonly name: string;
}

/**
 * SPEC-06: DeploymentRouter — Vercel → Cloudflare Pages → Render → Netlify fallback chain.
 *
 * SPEC-06 rule: HITL DEPLOY_PRODUCTION must be created BEFORE any production deploy.
 * The caller is responsible for creating HITL and passing requireHITL=false once approved.
 */
export class DeploymentRouter {
  private static readonly QUOTA_THRESHOLD = 5;

  private readonly providers: DeploymentProvider[];

  constructor(providers: DeploymentProvider[]) {
    this.providers = providers;
  }

  async deploy(
    options: DeploymentOptions,
  ): Promise<Result<DeploymentResult, Error>> {
    const errors: string[] = [];

    for (const provider of this.providers) {
      try {
        const quota = await provider.getRemainingQuota().catch(() => 0);
        if (quota < DeploymentRouter.QUOTA_THRESHOLD) {
          errors.push(`${provider.name}: quota too low (${quota})`);
          continue;
        }

        const result = await provider.deploy(options);
        if (result.isOk()) return result;

        errors.push(`${provider.name}: ${result.error.message}`);
      } catch (e) {
        errors.push(
          `${provider.name}: ${e instanceof Error ? e.message : String(e)}`,
        );
      }
    }

    return err(
      new Error(`All deployment providers failed: ${errors.join(" | ")}`),
    );
  }
}
