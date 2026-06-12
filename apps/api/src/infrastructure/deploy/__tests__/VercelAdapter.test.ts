import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { VercelAdapter } from "../VercelAdapter.js";

describe("VercelAdapter", () => {
  let tmpDir: string;
  const fetchMock = vi.fn();

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "vercel-adapter-test-"));
    await fs.writeFile(
      path.join(tmpDir, "index.html"),
      "<!DOCTYPE html><html><body>site</body></html>",
      "utf8",
    );
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockReset();
  });

  afterEach(async () => {
    vi.unstubAllGlobals();
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  describe("deploy()", () => {
    it("envia os arquivos do sourceCodePath para a API v13 da Vercel e retorna a URL real", async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: "dpl_123",
          url: "agentepro-proj-1-abc123.vercel.app",
          readyState: "QUEUED",
        }),
      });

      const adapter = new VercelAdapter("tok_test");
      const result = await adapter.deploy({
        projectId: "proj-1",
        sourceCodePath: tmpDir,
      });

      expect(result.isOk()).toBe(true);
      const deployment = result.unwrap();
      expect(deployment.url).toBe("https://agentepro-proj-1-abc123.vercel.app");
      expect(deployment.provider).toBe("vercel");
      expect(deployment.deploymentId).toBe("dpl_123");

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [calledUrl, init] = fetchMock.mock.calls[0] as [
        string,
        { method: string; headers: Record<string, string>; body: string },
      ];
      expect(calledUrl).toContain("api.vercel.com/v13/deployments");
      expect(init.method).toBe("POST");
      expect(init.headers["Authorization"]).toBe("Bearer tok_test");

      const body = JSON.parse(init.body) as {
        name: string;
        target: string;
        files: Array<{ file: string; data: string; encoding: string }>;
      };
      expect(body.target).toBe("production");
      expect(body.files).toHaveLength(1);
      expect(body.files[0]?.file).toBe("index.html");
      expect(body.files[0]?.encoding).toBe("base64");
      const decoded = Buffer.from(body.files[0]?.data ?? "", "base64").toString(
        "utf8",
      );
      expect(decoded).toContain("<!DOCTYPE html>");
    });

    it("sanitiza o projectId para um nome de projeto válido na Vercel", async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: "dpl_1", url: "x.vercel.app" }),
      });

      const adapter = new VercelAdapter("tok_test");
      await adapter.deploy({
        projectId: "Proj_With UPPER!chars",
        sourceCodePath: tmpDir,
      });

      const [, init] = fetchMock.mock.calls[0] as [string, { body: string }];
      const body = JSON.parse(init.body) as { name: string };
      expect(body.name).toMatch(/^[a-z0-9-]+$/);
    });

    it("retorna err quando a API key está ausente (sem chamar a API)", async () => {
      const adapter = new VercelAdapter("");
      const result = await adapter.deploy({
        projectId: "proj-1",
        sourceCodePath: tmpDir,
      });

      expect(result.isErr()).toBe(true);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("retorna err quando a API da Vercel responde não-ok", async () => {
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 403,
        text: async () => "forbidden",
      });

      const adapter = new VercelAdapter("tok_test");
      const result = await adapter.deploy({
        projectId: "proj-1",
        sourceCodePath: tmpDir,
      });

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.message).toContain("403");
      }
    });

    it("retorna err quando o sourceCodePath não contém arquivos", async () => {
      const emptyDir = await fs.mkdtemp(
        path.join(os.tmpdir(), "vercel-empty-"),
      );
      try {
        const adapter = new VercelAdapter("tok_test");
        const result = await adapter.deploy({
          projectId: "proj-1",
          sourceCodePath: emptyDir,
        });

        expect(result.isErr()).toBe(true);
        expect(fetchMock).not.toHaveBeenCalled();
      } finally {
        await fs.rm(emptyDir, { recursive: true, force: true });
      }
    });
  });

  describe("getRemainingQuota()", () => {
    it("retorna 0 sem API key", async () => {
      const adapter = new VercelAdapter("");
      expect(await adapter.getRemainingQuota()).toBe(0);
    });

    it("retorna quota positiva com API key", async () => {
      const adapter = new VercelAdapter("tok_test");
      expect(await adapter.getRemainingQuota()).toBeGreaterThan(0);
    });
  });
});
