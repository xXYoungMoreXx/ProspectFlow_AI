import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import Fastify, { type FastifyInstance } from "fastify";
import { internalMessagesRoutes } from "../internal/messages.routes.js";

const TOKEN = "test-internal-token";

interface ContainerStub {
  whatsapp: { sendText: ReturnType<typeof vi.fn> };
  queue: { enqueueEmail: ReturnType<typeof vi.fn> };
  optOutRepo: { isBlocked: ReturnType<typeof vi.fn> };
}

async function buildTestApp(): Promise<{
  app: FastifyInstance;
  container: ContainerStub;
}> {
  const container: ContainerStub = {
    whatsapp: { sendText: vi.fn().mockResolvedValue({ messageId: "wamid_1" }) },
    queue: { enqueueEmail: vi.fn().mockResolvedValue(undefined) },
    optOutRepo: { isBlocked: vi.fn().mockResolvedValue(false) },
  };

  const app = Fastify();
  app.decorate("container", container as never);
  await app.register(internalMessagesRoutes, { prefix: "/api/v1/internal" });
  await app.ready();
  return { app, container };
}

describe("internalMessagesRoutes", () => {
  beforeEach(() => {
    process.env["INTERNAL_API_TOKEN"] = TOKEN;
  });

  afterEach(() => {
    delete process.env["INTERNAL_API_TOKEN"];
  });

  describe("auth", () => {
    it("retorna 401 sem X-Internal-Token", async () => {
      const { app } = await buildTestApp();
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/internal/messages/whatsapp",
        payload: { phone: "5511999999999", message: "olá" },
      });
      expect(res.statusCode).toBe(401);
      await app.close();
    });

    it("retorna 401 com token errado", async () => {
      const { app } = await buildTestApp();
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/internal/messages/whatsapp",
        headers: { "x-internal-token": "wrong" },
        payload: { phone: "5511999999999", message: "olá" },
      });
      expect(res.statusCode).toBe(401);
      await app.close();
    });

    it("retorna 401 quando INTERNAL_API_TOKEN não está configurado (fail closed)", async () => {
      delete process.env["INTERNAL_API_TOKEN"];
      const { app } = await buildTestApp();
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/internal/messages/whatsapp",
        headers: { "x-internal-token": "" },
        payload: { phone: "5511999999999", message: "olá" },
      });
      expect(res.statusCode).toBe(401);
      await app.close();
    });
  });

  describe("POST /messages/whatsapp", () => {
    it("envia via WhatsAppAdapter e retorna messageId", async () => {
      const { app, container } = await buildTestApp();
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/internal/messages/whatsapp",
        headers: { "x-internal-token": TOKEN },
        payload: { phone: "5511999999999", message: "olá lead" },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({ messageId: "wamid_1" });
      expect(container.whatsapp.sendText).toHaveBeenCalledWith(
        expect.objectContaining({
          remoteJid: "5511999999999",
          text: "olá lead",
        }),
      );
      await app.close();
    });

    it("bloqueia envio para lead em opt-out (403, sem chamar adapter)", async () => {
      const { app, container } = await buildTestApp();
      container.optOutRepo.isBlocked.mockResolvedValue(true);

      const res = await app.inject({
        method: "POST",
        url: "/api/v1/internal/messages/whatsapp",
        headers: { "x-internal-token": TOKEN },
        payload: { phone: "5511999999999", message: "olá" },
      });

      expect(res.statusCode).toBe(403);
      expect(container.whatsapp.sendText).not.toHaveBeenCalled();
      await app.close();
    });

    it("retorna 400 para payload inválido", async () => {
      const { app } = await buildTestApp();
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/internal/messages/whatsapp",
        headers: { "x-internal-token": TOKEN },
        payload: { phone: "abc", message: "" },
      });
      expect(res.statusCode).toBe(400);
      await app.close();
    });

    it("retorna 502 quando a Evolution API falha", async () => {
      const { app, container } = await buildTestApp();
      container.whatsapp.sendText.mockRejectedValue(
        new Error("Evolution API Error [500]"),
      );

      const res = await app.inject({
        method: "POST",
        url: "/api/v1/internal/messages/whatsapp",
        headers: { "x-internal-token": TOKEN },
        payload: { phone: "5511999999999", message: "olá" },
      });
      expect(res.statusCode).toBe(502);
      await app.close();
    });
  });

  describe("POST /messages/email", () => {
    it("enfileira o email e retorna 202", async () => {
      const { app, container } = await buildTestApp();
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/internal/messages/email",
        headers: { "x-internal-token": TOKEN },
        payload: {
          to: "lead@example.com",
          subject: "Proposta",
          htmlContent: "<p>olá</p>",
        },
      });

      expect(res.statusCode).toBe(202);
      expect(container.queue.enqueueEmail).toHaveBeenCalledWith(
        "lead@example.com",
        "Proposta",
        "<p>olá</p>",
      );
      await app.close();
    });

    it("retorna 400 para email inválido", async () => {
      const { app } = await buildTestApp();
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/internal/messages/email",
        headers: { "x-internal-token": TOKEN },
        payload: { to: "not-an-email", subject: "x", htmlContent: "y" },
      });
      expect(res.statusCode).toBe(400);
      await app.close();
    });
  });
});
