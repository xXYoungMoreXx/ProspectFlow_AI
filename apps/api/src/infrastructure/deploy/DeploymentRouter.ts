import { Result } from '../../domain/shared/Result.js';

export interface DeploymentOptions {
  projectId: string;
  sourceCodePath: string;
  envVars?: Record<string, string>;
}

export interface DeploymentResult {
  url: string;
  provider: 'vercel' | 'netlify';
  deploymentId: string;
}

export interface DeploymentProvider {
  deploy(options: DeploymentOptions): Promise<Result<DeploymentResult, Error>>;
  getRemainingQuota(): Promise<number>;
}

export class DeploymentRouter {
  private static readonly QUOTA_THRESHOLD = 5;

  constructor(
    private readonly vercel: DeploymentProvider,
    private readonly netlify: DeploymentProvider
  ) {}

  async deploy(options: DeploymentOptions): Promise<Result<DeploymentResult, Error>> {
    try {
      const vercelQuota = await this.vercel.getRemainingQuota();
      
      if (vercelQuota < DeploymentRouter.QUOTA_THRESHOLD) {
        // Fallback to Netlify
        return await this.netlify.deploy(options);
      }
      
      // Primary provider
      return await this.vercel.deploy(options);
    } catch (_error) {
      // If quota check fails, try Vercel as best effort, then Netlify if it fails
      const vercelResult = await this.vercel.deploy(options);
      if (vercelResult.isOk()) {
        return vercelResult;
      }
      return await this.netlify.deploy(options);
    }
  }
}
