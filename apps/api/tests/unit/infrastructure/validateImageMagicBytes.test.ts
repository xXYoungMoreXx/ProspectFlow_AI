import { describe, it, expect } from "vitest";
import {
  validateImageMagicBytes,
  MediaGenerationError,
} from "../../../src/infrastructure/media/MediaGenerationRouter.js";

describe("validateImageMagicBytes", () => {
  it("aceita JPEG válido (FFD8FF)", () => {
    const buf = Buffer.from([
      0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
    ]);
    expect(validateImageMagicBytes(buf)).toBe("jpeg");
  });

  it("aceita PNG válido (89504E47)", () => {
    const buf = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
    ]);
    expect(validateImageMagicBytes(buf)).toBe("png");
  });

  it("aceita WebP válido (RIFF....WEBP)", () => {
    // Bytes 0-3: RIFF, bytes 4-7: file size (arbitrary), bytes 8-11: WEBP
    const buf = Buffer.from([
      0x52,
      0x49,
      0x46,
      0x46, // RIFF
      0x24,
      0x00,
      0x00,
      0x00, // file size
      0x57,
      0x45,
      0x42,
      0x50, // WEBP
    ]);
    expect(validateImageMagicBytes(buf)).toBe("webp");
  });

  it("rejeita buffer com bytes inválidos — lança MediaGenerationError", () => {
    const buf = Buffer.from([
      0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0x0a, 0x0b,
    ]);
    expect(() => validateImageMagicBytes(buf)).toThrow(MediaGenerationError);
  });

  it("erro tem code INVALID_IMAGE_MAGIC_BYTES", () => {
    const buf = Buffer.from([0x00, 0x01, 0x02, 0x03]);
    expect(() => validateImageMagicBytes(buf)).toThrow(
      expect.objectContaining({ code: "INVALID_IMAGE_MAGIC_BYTES" }),
    );
  });

  it("rejeita buffer vazio — lança MediaGenerationError", () => {
    const buf = Buffer.alloc(0);
    expect(() => validateImageMagicBytes(buf)).toThrow(MediaGenerationError);
  });

  it("rejeita buffer com apenas 2 bytes — insuficiente para JPEG", () => {
    const buf = Buffer.from([0xff, 0xd8]);
    // Only 2 bytes — JPEG needs 3 matching bytes (FF D8 FF)
    expect(() => validateImageMagicBytes(buf)).toThrow(MediaGenerationError);
  });
});
