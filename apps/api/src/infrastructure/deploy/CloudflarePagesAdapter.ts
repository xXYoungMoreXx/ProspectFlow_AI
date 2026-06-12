import type {
  DeploymentOptions,
  DeploymentResult,
  DeploymentProvider,
} from "./DeploymentRouter.js";
import { err } from "../../domain/shared/Result.js";
import type { Result } from "../../domain/shared/Result.js";

/**
 * SPEC-06: Cloudflare Pages adapter — secondary fallback after Vercel.
 *
 * WHY desabilitado: a implementação anterior criava o deployment via API mas
 * NUNCA fazia upload dos arquivos (Direct Upload exige manifest + asset upload
 * com JWT via /pages/assets/*), resultando em site vazio reportado como
 * sucesso. Até o fluxo completo de upload ser implementado, este adapter
 * retorna err() honesto e quota 0 para a chain pular direto ao próximo
 * provider real (Netlify).
 */
export class CloudflarePagesAdapter implements DeploymentProvider {
  readonly name = "CloudflarePages";
  constructor(
    private readonly accountId: string,
    private readonly apiToken: string,
  ) {}

  async deploy(
    _options: DeploymentOptions,
  ): Promise<Result<DeploymentResult, Error>> {
    if (!this.accountId || !this.apiToken) {
      return err(new Error("Cloudflare credentials missing"));
    }
    return err(
      new Error(
        "Cloudflare Pages deploy not implemented: Direct Upload asset flow pending",
      ),
    );
  }

  async getRemainingQuota(): Promise<number> {
    return Promise.resolve(0);
  }
}
