import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { CloudflarePagesAdapter } from "../CloudflarePagesAdapter.js";

const HTML = "<!DOCTYPE html><html><body>cf</body></html>";

describe("CloudflarePagesAdapter", () => {
  let tmpDir: string;
  const fetchMock = vi.fn();

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "cf-adapter-test-"));
    await fs.writeFile(path.join(tmpDir, "index.html"), HTML, "utf8");
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockReset();
  });

  afterEach(async () => {
    vi.unstubAllGlobals();
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("executa o fluxo direct upload completo: token → check-missing → upload → deployment", async () => {
    fetchMock
      // 1. ensureProject
      .mockResolvedValueOnce({ ok: true, json: async () => ({}) })
      // 2. upload-token
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ result: { jwt: "jwt-1" } }),
      })
      // 3. check-missing — devolve o hash como faltante
      .mockImplementationOnce(async (_url: string, init: { body: string }) => {
        const { hashes } = JSON.parse(init.body) as { hashes: string[] };
        return { ok: true, json: async () => ({ result: hashes }) };
      })
      // 4. upload assets
      .mockResolvedValueOnce({ ok: true, json: async () => ({}) })
      // 5. create deployment
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          result: {
            id: "dep-1",
            url: "https://abc.hefesto-proj-1.pages.dev",
          },
        }),
      });

    const adapter = new CloudflarePagesAdapter("acc-1", "cf-token");
    const result = await adapter.deploy({
      projectId: "proj-1",
      sourceCodePath: tmpDir,
    });

    expect(result.isOk()).toBe(true);
    const deployment = result.unwrap();
    expect(deployment.url).toBe("https://abc.hefesto-proj-1.pages.dev");
    expect(deployment.provider).toBe("cloudflare");
    expect(deployment.deploymentId).toBe("dep-1");

    expect(fetchMock).toHaveBeenCalledTimes(5);

    // check-missing usa o JWT, não o api token
    const [, checkInit] = fetchMock.mock.calls[2] as [
      string,
      { headers: Record<string, string>; body: string },
    ];
    expect(checkInit.headers["Authorization"]).toBe("Bearer jwt-1");
    const { hashes } = JSON.parse(checkInit.body) as { hashes: string[] };
    expect(hashes[0]).toMatch(/^[0-9a-f]{32}$/);

    // upload envia o conteúdo base64 com contentType correto
    const [, uploadInit] = fetchMock.mock.calls[3] as [
      string,
      { body: string },
    ];
    const payload = JSON.parse(uploadInit.body) as Array<{
      key: string;
      value: string;
      metadata: { contentType: string };
      base64: boolean;
    }>;
    expect(payload[0]?.key).toBe(hashes[0]);
    expect(payload[0]?.metadata.contentType).toBe("text/html");
    expect(Buffer.from(payload[0]?.value ?? "", "base64").toString()).toBe(
      HTML,
    );

    // deployment leva o manifest path → hash
    const [, deployInit] = fetchMock.mock.calls[4] as [
      string,
      { body: FormData },
    ];
    const manifest = JSON.parse(
      String(deployInit.body.get("manifest")),
    ) as Record<string, string>;
    expect(manifest["/index.html"]).toBe(hashes[0]);
  });

  it("pula o upload quando a CF já tem todos os assets", async () => {
    fetchMock
      .mockResolvedValueOnce({ ok: true, json: async () => ({}) })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ result: { jwt: "jwt-1" } }),
      })
      // nada faltante
      .mockResolvedValueOnce({ ok: true, json: async () => ({ result: [] }) })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          result: { id: "dep-2", url: "https://x.pages.dev" },
        }),
      });

    const adapter = new CloudflarePagesAdapter("acc-1", "cf-token");
    const result = await adapter.deploy({
      projectId: "proj-1",
      sourceCodePath: tmpDir,
    });

    expect(result.isOk()).toBe(true);
    // 4 chamadas: sem o passo de upload
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it("retorna err sem credenciais (sem chamadas de rede)", async () => {
    const adapter = new CloudflarePagesAdapter("", "");
    const result = await adapter.deploy({
      projectId: "proj-1",
      sourceCodePath: tmpDir,
    });
    expect(result.isErr()).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(await adapter.getRemainingQuota()).toBe(0);
  });
});
