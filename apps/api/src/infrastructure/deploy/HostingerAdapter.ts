import { err, type Result } from "../../domain/shared/Result.js";
import type {
  DeploymentProvider,
  DeploymentOptions,
  DeploymentResult,
} from "./DeploymentRouter.js";

export class HostingerAdapter implements DeploymentProvider {
  readonly name = "Hostinger";

  async deploy(
    _options: DeploymentOptions,
  ): Promise<Result<DeploymentResult, Error>> {
    // WHY: Hostinger deploy is listed in BUILD_ORDER §2.5 but not yet implemented.
    // Stub prevents a missing-adapter gap at runtime; replace with real API calls
    // once Hostinger API credentials and endpoint are confirmed.
    return err(new Error("Hostinger deploy not yet implemented"));
  }

  async getRemainingQuota(): Promise<number> {
    return Promise.resolve(0);
  }
}
