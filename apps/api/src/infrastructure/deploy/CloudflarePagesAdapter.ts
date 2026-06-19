import { promises as fs } from "node:fs";
import path from "node:path";
import { blake3 } from "@noble/hashes/blake3.js";
import { bytesToHex, utf8ToBytes } from "@noble/hashes/utils.js";
import type {
  DeploymentOptions,
  DeploymentResult,
  DeploymentProvider,
} from "./DeploymentRouter.js";
import { ok, err } from "../../domain/shared/Result.js";
import type { Result } from "../../domain/shared/Result.js";

const API_BASE = "https://api.cloudflare.com/client/v4";

const CONTENT_TYPES: Record<string, string> = {
  html: "text/html",
  css: "text/css",
  js: "text/javascript",
  json: "application/json",
  svg: "image/svg+xml",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  ico: "image/x-icon",
  txt: "text/plain",
};

interface CfFile {
  deployPath: string; // "/index.html"
  base64: string;
  extension: string;
  hash: string;
  contentType: string;
}

/**
 * SPEC-06: Cloudflare Pages adapter — secondary fallback after Vercel.
 *
 * Direct Upload completo (mesmo fluxo do wrangler):
 * upload-token (JWT) → check-missing → upload assets → create deployment
 * com manifest multipart. Hash = blake3(base64 + extensão) truncado a 32 hex.
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
    if (!this.accountId || !this.apiToken) {
      return err(new Error("Cloudflare credentials missing"));
    }

    try {
      const files = await this.collectFiles(options.sourceCodePath);
      if (files.length === 0) {
        return err(
          new Error(`No deployable files found in ${options.sourceCodePath}`),
        );
      }

      const projectName = this.toProjectName(options.projectId);
      await this.ensureProject(projectName);

      // 1. JWT de upload do projeto
      const jwt = await this.getUploadToken(projectName);

      // 2. Quais hashes a CF ainda não tem?
      const missing = await this.checkMissing(
        jwt,
        files.map((f) => f.hash),
      );

      // 3. Sobe apenas os assets faltantes
      const toUpload = files.filter((f) => missing.has(f.hash));
      if (toUpload.length > 0) {
        await this.uploadAssets(jwt, toUpload);
      }

      // 4. Cria o deployment com o manifest path → hash
      const manifest: Record<string, string> = {};
      for (const f of files) manifest[f.deployPath] = f.hash;

      const form = new FormData();
      form.append("manifest", JSON.stringify(manifest));

      const deployRes = await fetch(
        `${API_BASE}/accounts/${this.accountId}/pages/projects/${projectName}/deployments`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${this.apiToken}` },
          body: form,
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
        result: { id: string; url: string };
      };
      return ok({
        url: data.result.url,
        provider: "cloudflare",
        deploymentId: data.result.id,
      });
    } catch (e) {
      return err(e instanceof Error ? e : new Error(String(e)));
    }
  }

  async getRemainingQuota(): Promise<number> {
    // WHY: CF Pages tem limites generosos; sem credenciais o provider é
    // inutilizável (0) e a chain pula direto para o próximo.
    return Promise.resolve(this.accountId && this.apiToken ? 100 : 0);
  }

  private async getUploadToken(projectName: string): Promise<string> {
    const res = await fetch(
      `${API_BASE}/accounts/${this.accountId}/pages/projects/${projectName}/upload-token`,
      {
        headers: { Authorization: `Bearer ${this.apiToken}` },
        signal: AbortSignal.timeout(15_000),
      },
    );
    if (!res.ok) {
      throw new Error(`CF Pages upload-token failed [${res.status}]`);
    }
    const data = (await res.json()) as { result: { jwt: string } };
    return data.result.jwt;
  }

  private async checkMissing(
    jwt: string,
    hashes: string[],
  ): Promise<Set<string>> {
    const res = await fetch(`${API_BASE}/pages/assets/check-missing`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${jwt}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ hashes }),
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) {
      throw new Error(`CF Pages check-missing failed [${res.status}]`);
    }
    const data = (await res.json()) as { result: string[] };
    return new Set(data.result ?? []);
  }

  private async uploadAssets(jwt: string, files: CfFile[]): Promise<void> {
    const payload = files.map((f) => ({
      key: f.hash,
      value: f.base64,
      metadata: { contentType: f.contentType },
      base64: true,
    }));
    const res = await fetch(`${API_BASE}/pages/assets/upload`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${jwt}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(60_000),
    });
    if (!res.ok) {
      throw new Error(`CF Pages asset upload failed [${res.status}]`);
    }
  }

  private async ensureProject(name: string): Promise<void> {
    const res = await fetch(
      `${API_BASE}/accounts/${this.accountId}/pages/projects`,
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
    // 409 = já existe — reusar
    if (!res.ok && res.status !== 409) {
      const text = await res.text();
      throw new Error(`Failed to create CF Pages project: ${text}`);
    }
  }

  private async collectFiles(rootDir: string): Promise<CfFile[]> {
    const entries = await fs.readdir(rootDir, {
      withFileTypes: true,
      recursive: true,
    });

    const files: CfFile[] = [];
    for (const entry of entries) {
      if (!entry.isFile()) continue;
      const absolute = path.join(entry.parentPath, entry.name);
      const relative = path
        .relative(rootDir, absolute)
        .split(path.sep)
        .join("/");
      const base64 = (await fs.readFile(absolute)).toString("base64");
      const extension = path.extname(entry.name).slice(1).toLowerCase();
      // WHY: mesmo algoritmo do wrangler — blake3(base64 + ext), 32 hex chars
      const hash = bytesToHex(blake3(utf8ToBytes(base64 + extension))).slice(
        0,
        32,
      );
      files.push({
        deployPath: `/${relative}`,
        base64,
        extension,
        hash,
        contentType: CONTENT_TYPES[extension] ?? "application/octet-stream",
      });
    }
    return files;
  }

  private toProjectName(projectId: string): string {
    return `hefesto-${projectId}`
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, "-")
      .replace(/-{2,}/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 58);
  }
}
