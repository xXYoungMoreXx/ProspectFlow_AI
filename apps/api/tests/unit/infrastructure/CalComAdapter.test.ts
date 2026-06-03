import { describe, it, expect, vi, beforeEach } from "vitest";
import { CalComAdapter } from "../../../src/infrastructure/integrations/CalComAdapter.js";
import type { CompositeSecretsProvider } from "../../../src/infrastructure/secrets/CompositeSecretsProvider.js";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

function makeSecrets(
  key: string | null = "test-calcom-key",
): CompositeSecretsProvider {
  return {
    get: vi.fn().mockResolvedValue(key),
  } as unknown as CompositeSecretsProvider;
}

const validInput = {
  eventTypeId: 42,
  name: "João Silva",
  email: "joao@example.com",
  startTime: "2026-07-01T10:00:00Z",
};

const validApiResponse = {
  status: "success",
  data: {
    id: 123,
    uid: "abc-uid-xyz",
    start: "2026-07-01T10:00:00Z",
    end: "2026-07-01T10:30:00Z",
  },
};

describe("CalComAdapter", () => {
  beforeEach(() => mockFetch.mockReset());

  describe("scheduleBooking", () => {
    it("retorna resultado com uid e bookingLink no happy path", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => validApiResponse,
      });

      const adapter = new CalComAdapter(makeSecrets());
      const result = await adapter.scheduleBooking(validInput);

      expect(result.bookingId).toBe(123);
      expect(result.uid).toBe("abc-uid-xyz");
      expect(result.bookingLink).toBe("https://cal.com/booking/abc-uid-xyz");
      expect(result.startTime).toBe("2026-07-01T10:00:00Z");
      expect(result.endTime).toBe("2026-07-01T10:30:00Z");
    });

    it("envia Authorization Bearer com a API key", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => validApiResponse,
      });

      const adapter = new CalComAdapter(makeSecrets("my-secret-key"));
      await adapter.scheduleBooking(validInput);

      const [, options] = mockFetch.mock.calls[0] as [string, RequestInit];
      expect((options.headers as Record<string, string>)["Authorization"]).toBe(
        "Bearer my-secret-key",
      );
    });

    it("usa timezone padrão America/Sao_Paulo quando não fornecido", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => validApiResponse,
      });

      const adapter = new CalComAdapter(makeSecrets());
      await adapter.scheduleBooking(validInput);

      const [, options] = mockFetch.mock.calls[0] as [string, RequestInit];
      const body = JSON.parse(options.body as string) as {
        attendee: { timeZone: string };
      };
      expect(body.attendee.timeZone).toBe("America/Sao_Paulo");
    });

    it("lança erro quando API retorna status não-ok", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 422,
        text: async () => "Unprocessable Entity",
      });

      const adapter = new CalComAdapter(makeSecrets());
      await expect(adapter.scheduleBooking(validInput)).rejects.toThrow(
        "CalCom error [422]",
      );
    });

    it("lança erro quando CALCOM_API_KEY não está configurada", async () => {
      const adapter = new CalComAdapter(makeSecrets(null));
      await expect(adapter.scheduleBooking(validInput)).rejects.toThrow(
        "CALCOM_API_KEY not configured",
      );
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });
});
