/**
 * MediaGenerationRouter — Imagen → OpenAI (gpt-image-1/dall-e-3) → Ollama fallback chain.
 *
 * CONTRATO CRÍTICO: magic bytes validados em TODA imagem retornada.
 * Formatos aceitos: JPEG (FFD8FF), PNG (89504E47), WebP (RIFF????WEBP)
 * Imagem inválida → throws MediaGenerationError com code INVALID_IMAGE_MAGIC_BYTES.
 */

import { ImagenAdapter } from "./ImagenAdapter.js";
import { OpenAIImageAdapter } from "./OpenAIImageAdapter.js";
import { OllamaImageAdapter } from "./OllamaImageAdapter.js";

// Magic byte signatures
const MAGIC = {
  JPEG: [0xff, 0xd8, 0xff],
  PNG: [0x89, 0x50, 0x4e, 0x47],
  WEBP_RIFF: [0x52, 0x49, 0x46, 0x46], // "RIFF" header
  WEBP_MARKER: [0x57, 0x45, 0x42, 0x50], // "WEBP" at offset 8
} as const;

export class MediaGenerationError extends Error {
  constructor(
    message: string,
    readonly code: string,
  ) {
    super(message);
    this.name = "MediaGenerationError";
  }
}

export function validateImageMagicBytes(
  buffer: Buffer,
): "jpeg" | "png" | "webp" {
  const bytes = Array.from(buffer.subarray(0, 12));

  if (MAGIC.JPEG.every((b, i) => bytes[i] === b)) return "jpeg";
  if (MAGIC.PNG.every((b, i) => bytes[i] === b)) return "png";
  if (
    MAGIC.WEBP_RIFF.every((b, i) => bytes[i] === b) &&
    MAGIC.WEBP_MARKER.every((b, i) => bytes[i + 8] === b)
  )
    return "webp";

  throw new MediaGenerationError(
    "Image failed magic bytes validation — not JPEG, PNG or WebP",
    "INVALID_IMAGE_MAGIC_BYTES",
  );
}

export interface GenerateImageInput {
  prompt: string;
  width?: number;
  height?: number;
  apiKeyRef?: string;
}

export interface GeneratedImage {
  buffer: Buffer;
  format: "jpeg" | "png" | "webp";
  provider: string;
}

// ─── Router (fallback chain) ──────────────────────────────────────────────────

export interface MediaGenSecrets {
  getImagenKey(): Promise<string | null>;
  getOpenAIKey(): Promise<string | null>;
}

export class MediaGenerationRouter {
  constructor(private readonly secrets: MediaGenSecrets) {}

  async generate(input: GenerateImageInput): Promise<GeneratedImage> {
    const providers: Array<{ name: string; fn: () => Promise<Buffer> }> = [];

    const imagenKey = await this.secrets.getImagenKey();
    if (imagenKey) {
      providers.push({
        name: "Imagen",
        fn: () => new ImagenAdapter(imagenKey).generate(input),
      });
    }

    const openaiKey = await this.secrets.getOpenAIKey();
    if (openaiKey) {
      providers.push({
        name: "OpenAI",
        fn: () => new OpenAIImageAdapter(openaiKey).generate(input),
      });
    }

    providers.push({
      name: "OllamaVision",
      fn: () => new OllamaImageAdapter().generate(input),
    });

    const errors: string[] = [];

    for (const { name, fn } of providers) {
      try {
        const buffer = await fn();
        // CONTRATO CRÍTICO: validate before returning
        const format = validateImageMagicBytes(buffer);
        return { buffer, format, provider: name };
      } catch (e) {
        errors.push(`${name}: ${e instanceof Error ? e.message : String(e)}`);
        if (
          e instanceof MediaGenerationError &&
          e.code === "INVALID_IMAGE_MAGIC_BYTES"
        ) {
          continue;
        }
      }
    }

    throw new MediaGenerationError(
      `All providers failed: ${errors.join(" | ")}`,
      "ALL_PROVIDERS_FAILED",
    );
  }
}
