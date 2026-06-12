import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { NetlifyAdapter } from "../NetlifyAdapter.js";

const HTML = "<!DOCTYPE html><html><body>netlify</body></html>";
const HTML_SHA1 = createHash("sha1").update(HTML).digest("hex");

describe("NetlifyAdapter", () => {
  let tmpDir: string;
  const fetchMock = vi.fn();

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "netlify-adapter-test-"));
    await fs.writeFile(path.join(tmpDir, "index.html"), HTML, "utf8");
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockReset();
  });

  afterEach(async () => {
    vi.unstubAllGlobals();
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("cria site, cria deploy por digest e sobe os arquivos requeridos", async () => {
    fetchMock
      // 1. create site
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: "site_1",
          ssl_url: "https://agentepro-proj-1.netlify.app",
        }),
      })
      // 2. create deploy (digest)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: "deploy_1", required: [HTML_SHA1] }),
      })
      // 3. upload file
      .mockResolvedValueOnce({ ok: true, json: async () => ({}) });

    const adapter = new NetlifyAdapter("ntl_token");
    const result = await adapter.deploy({
      projectId: "proj-1",
      sourceCodePath: tmpDir,
    });

    expect(result.isOk()).toBe(true);
    const deployment = result.unwrap();
    expect(deployment.url).toBe("https://agentepro-proj-1.netlify.app");
    expect(deployment.provider).toBe("netlify");
    expect(deployment.deploymentId).toBe("deploy_1");

    // create deploy envia o mapa de digests
    const [deployUrl, deployInit] = fetchMock.mock.calls[1] as [
      string,
      { body: string },
    ];
    expect(deployUrl).toContain("/sites/site_1/deploys");
    const deployBody = JSON.parse(deployInit.body) as {
      files: Record<string, string>;
    };
    expect(deployBody.files["/index.html"]).toBe(HTML_SHA1);

    // upload do arquivo requerido com o conteúdo bruto
    const [uploadUrl, uploadInit] = fetchMock.mock.calls[2] as [
      string,
      { method: string },
    ];
    expect(uploadUrl).toContain("/deploys/deploy_1/files/index.html");
    expect(uploadInit.method).toBe("PUT");
  });

  it("reaproveita site existente quando a criação retorna 422 (nome já usado)", async () => {
    fetchMock
      // 1. create site → 422
      .mockResolvedValueOnce({ ok: false, status: 422, text: async () => "" })
      // 2. list sites → find by name
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [
          {
            id: "site_existing",
            name: "agentepro-proj-1",
            ssl_url: "https://agentepro-proj-1.netlify.app",
          },
        ],
      })
      // 3. create deploy — nada a subir
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: "deploy_2", required: [] }),
      });

    const adapter = new NetlifyAdapter("ntl_token");
    const result = await adapter.deploy({
      projectId: "proj-1",
      sourceCodePath: tmpDir,
    });

    expect(result.isOk()).toBe(true);
    expect(result.unwrap().deploymentId).toBe("deploy_2");
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("retorna err sem API key (sem chamadas de rede — nunca sucesso simulado)", async () => {
    const adapter = new NetlifyAdapter("");
    const result = await adapter.deploy({
      projectId: "proj-1",
      sourceCodePath: tmpDir,
    });
    expect(result.isErr()).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("retorna err quando a API falha na criação do deploy", async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: "site_1", ssl_url: "https://x.netlify.app" }),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () => "boom",
      });

    const adapter = new NetlifyAdapter("ntl_token");
    const result = await adapter.deploy({
      projectId: "proj-1",
      sourceCodePath: tmpDir,
    });
    expect(result.isErr()).toBe(true);
    if (result.isErr()) expect(result.error.message).toContain("500");
  });

  describe("getRemainingQuota()", () => {
    it("retorna 0 sem API key", async () => {
      const adapter = new NetlifyAdapter("");
      expect(await adapter.getRemainingQuota()).toBe(0);
    });

    it("retorna quota positiva com API key", async () => {
      const adapter = new NetlifyAdapter("ntl_token");
      expect(await adapter.getRemainingQuota()).toBeGreaterThan(0);
    });
  });
});
