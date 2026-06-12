import { promises as fs } from "node:fs";
import path from "node:path";
import { ok, err, type Result } from "../../domain/shared/Result.js";
import type {
  DeploymentProvider,
  DeploymentOptions,
  DeploymentResult,
} from "./DeploymentRouter.js";

interface VercelDeploymentResponse {
  id: string;
  url: string;
  readyState?: string;
}

/**
 * SPEC-06: Vercel adapter — primary provider da fallback chain.
 * Usa a API v13 de deployments com upload inline (base64) dos arquivos
 * estáticos gerados pelo Builder (index.html único hoje; recursivo por design).
 */
export class VercelAdapter implements DeploymentProvider {
  readonly name = "Vercel";
  private static readonly API_URL = "https://api.vercel.com/v13/deployments";
  private static readonly MAX_NAME_LENGTH = 90;

  constructor(private readonly apiKey: string) {}

  async deploy(
    options: DeploymentOptions,
  ): Promise<Result<DeploymentResult, Error>> {
    if (!this.apiKey) return err(new Error("Vercel API key is missing"));

    try {
      const files = await this.collectFiles(options.sourceCodePath);
      if (files.length === 0) {
        return err(
          new Error(`No deployable files found in ${options.sourceCodePath}`),
        );
      }

      const response = await fetch(VercelAdapter.API_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: this.toProjectName(options.projectId),
          target: "production",
          files,
          projectSettings: { framework: null },
        }),
        signal: AbortSignal.timeout(60_000),
      });

      if (!response.ok) {
        const text = await response.text();
        return err(
          new Error(`Vercel deploy failed [${response.status}]: ${text}`),
        );
      }

      const data = (await response.json()) as VercelDeploymentResponse;
      const url = data.url.startsWith("http")
        ? data.url
        : `https://${data.url}`;

      return ok({
        url,
        provider: "vercel",
        deploymentId: data.id,
      });
    } catch (e) {
      return err(e instanceof Error ? e : new Error(String(e)));
    }
  }

  async getRemainingQuota(): Promise<number> {
    // WHY: a Vercel não expõe um contador simples de deploys restantes;
    // sem token o provider é inutilizável (0), com token assumimos quota livre.
    return Promise.resolve(this.apiKey ? 100 : 0);
  }

  private async collectFiles(
    rootDir: string,
  ): Promise<Array<{ file: string; data: string; encoding: "base64" }>> {
    const entries = await fs.readdir(rootDir, {
      withFileTypes: true,
      recursive: true,
    });

    const files: Array<{ file: string; data: string; encoding: "base64" }> = [];
    for (const entry of entries) {
      if (!entry.isFile()) continue;
      const absolute = path.join(entry.parentPath, entry.name);
      const relative = path
        .relative(rootDir, absolute)
        .split(path.sep)
        .join("/");
      const content = await fs.readFile(absolute);
      files.push({
        file: relative,
        data: content.toString("base64"),
        encoding: "base64",
      });
    }
    return files;
  }

  private toProjectName(projectId: string): string {
    const sanitized = `agentepro-${projectId}`
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, "-")
      .replace(/-{2,}/g, "-")
      .replace(/^-|-$/g, "");
    return sanitized.slice(0, VercelAdapter.MAX_NAME_LENGTH);
  }
}
