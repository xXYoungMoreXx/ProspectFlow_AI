import { describe, it, expect } from "vitest";
import { isFinalizationMessage } from "../whatsapp.webhook.routes.js";

describe("isFinalizationMessage", () => {
  it("reconhece 'ok' como finalização", () => {
    expect(isFinalizationMessage("ok")).toBe(true);
  });

  it("reconhece 'PRONTO' case-insensitive", () => {
    expect(isFinalizationMessage("PRONTO")).toBe(true);
  });

  it("reconhece 'sim' como finalização", () => {
    expect(isFinalizationMessage("sim")).toBe(true);
  });

  it("reconhece 'feito' como finalização", () => {
    expect(isFinalizationMessage("feito")).toBe(true);
  });

  it("ignora mensagens longas mesmo com palavra-chave no início", () => {
    expect(isFinalizationMessage("ok, mas tenho mais uma dúvida")).toBe(false);
  });

  it("ignora mensagens longas", () => {
    expect(isFinalizationMessage("qual o horário de funcionamento?")).toBe(
      false,
    );
  });

  it("rejeita string vazia", () => {
    expect(isFinalizationMessage("")).toBe(false);
  });

  it("reconhece mensagem com espaços em torno", () => {
    expect(isFinalizationMessage("  ok  ")).toBe(true);
  });
});
