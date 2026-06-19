import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { ok, err, type Result } from "../../domain/shared/Result.js";
import type {
  DeploymentProvider,
  DeploymentOptions,
  DeploymentResult,
} from "./DeploymentRouter.js";

interface NetlifySite {
  id: string;
  name?: string;
  ssl_url?: string;
  url?: string;
}

interface NetlifyDeploy {
  id: string;
  required?: string[];
}

interface LocalFile {
  deployPath: string; // "/index.html"
  urlPath: string; // "index.html"
  sha1: string;
  content: Buffer;
}

/**
 * SPEC-06: Netlify adapter — último fallback da chain.
 * Deploy real via API de file-digest: cria/reusa o site, envia o mapa
 * {path: sha1} e sobe apenas os arquivos que a Netlify marcar como required.
 */
export class NetlifyAdapter implements DeploymentProvider {
  readonly name = "Netlify";
  private static readonly API_BASE = "https://api.netlify.com/api/v1";

  constructor(private readonly apiKey: string) {}

  async deploy(
    options: DeploymentOptions,
  ): Promise<Result<DeploymentResult, Error>> {
    if (!this.apiKey) return err(new Error("Netlify API key is missing"));

    try {
      const files = await this.collectFiles(options.sourceCodePath);
      if (files.length === 0) {
        return err(
          new Error(`No deployable files found in ${options.sourceCodePath}`),
        );
      }

      const siteName = this.toSiteName(options.projectId);
      const site = await this.ensureSite(siteName);

      const digest: Record<string, string> = {};
      for (const file of files) digest[file.deployPath] = file.sha1;

      const deployRes = await fetch(
        `${NetlifyAdapter.API_BASE}/sites/${site.id}/deploys`,
        {
          method: "POST",
          headers: this.headers("application/json"),
          body: JSON.stringify({ files: digest }),
          signal: AbortSignal.timeout(60_000),
        },
      );
      if (!deployRes.ok) {
        const text = await deployRes.text();
        return err(
          new Error(`Netlify deploy failed [${deployRes.status}]: ${text}`),
        );
      }
      const deploy = (await deployRes.json()) as NetlifyDeploy;

      const required = new Set(deploy.required ?? []);
      for (const file of files) {
        if (!required.has(file.sha1)) continue;
        const uploadRes = await fetch(
          `${NetlifyAdapter.API_BASE}/deploys/${deploy.id}/files/${file.urlPath}`,
          {
            method: "PUT",
            headers: this.headers("application/octet-stream"),
            body: new Uint8Array(file.content),
            signal: AbortSignal.timeout(60_000),
          },
        );
        if (!uploadRes.ok) {
          const text = await uploadRes.text();
          return err(
            new Error(
              `Netlify file upload failed [${uploadRes.status}] for ${file.deployPath}: ${text}`,
            ),
          );
        }
      }

      const url = site.ssl_url ?? site.url ?? `https://${siteName}.netlify.app`;
      return ok({
        url,
        provider: "netlify",
        deploymentId: deploy.id,
      });
    } catch (e) {
      return err(e instanceof Error ? e : new Error(String(e)));
    }
  }

  async getRemainingQuota(): Promise<number> {
    // WHY: a Netlify não expõe contador de deploys; sem token o provider
    // é inutilizável (0), com token assumimos a quota generosa do free tier.
    return Promise.resolve(this.apiKey ? 100 : 0);
  }

  private headers(contentType: string): Record<string, string> {
    return {
      Authorization: `Bearer ${this.apiKey}`,
      "Content-Type": contentType,
    };
  }

  private async ensureSite(siteName: string): Promise<NetlifySite> {
    const createRes = await fetch(`${NetlifyAdapter.API_BASE}/sites`, {
      method: "POST",
      headers: this.headers("application/json"),
      body: JSON.stringify({ name: siteName }),
      signal: AbortSignal.timeout(30_000),
    });
    if (createRes.ok) return (await createRes.json()) as NetlifySite;

    // 422 = nome já existe (deploy anterior do mesmo projeto) — reusar
    if (createRes.status === 422) {
      const listRes = await fetch(
        `${NetlifyAdapter.API_BASE}/sites?name=${encodeURIComponent(siteName)}`,
        {
          headers: this.headers("application/json"),
          signal: AbortSignal.timeout(30_000),
        },
      );
      if (listRes.ok) {
        const sites = (await listRes.json()) as NetlifySite[];
        const match = sites.find((s) => s.name === siteName) ?? sites[0];
        if (match) return match;
      }
    }

    const text = await createRes.text();
    throw new Error(
      `Netlify site creation failed [${createRes.status}]: ${text}`,
    );
  }

  private async collectFiles(rootDir: string): Promise<LocalFile[]> {
    const entries = await fs.readdir(rootDir, {
      withFileTypes: true,
      recursive: true,
    });

    const files: LocalFile[] = [];
    for (const entry of entries) {
      if (!entry.isFile()) continue;
      const absolute = path.join(entry.parentPath, entry.name);
      const relative = path
        .relative(rootDir, absolute)
        .split(path.sep)
        .join("/");
      const content = await fs.readFile(absolute);
      files.push({
        deployPath: `/${relative}`,
        urlPath: relative,
        sha1: createHash("sha1").update(content).digest("hex"),
        content,
      });
    }
    return files;
  }

  private toSiteName(projectId: string): string {
    return `hefesto-${projectId}`
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, "-")
      .replace(/-{2,}/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 60);
  }
}
