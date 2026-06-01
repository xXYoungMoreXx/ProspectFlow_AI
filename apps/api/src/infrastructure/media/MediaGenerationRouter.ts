/**
 * SPEC-10: MediaGenerationRouter — NanaBanana → DALL-E → OllamaVision fallback chain.
 *
 * CONTRATO CRÍTICO: magic bytes validados em TODA imagem retornada.
 * Formatos aceitos: JPEG (FFD8FF), PNG (89504E47), WebP (RIFF????WEBP)
 * Imagem inválida → throws MediaGenerationError com code INVALID_IMAGE_MAGIC_BYTES.
 */

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

// ─── NanaBanana ──────────────────────────────────────────────────────────────

async function generateViaNanaBanana(
  input: GenerateImageInput,
  apiKey: string,
): Promise<Buffer> {
  const res = await fetch("https://api.nanabanana.ai/v1/generate", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      prompt: input.prompt,
      width: input.width ?? 1024,
      height: input.height ?? 1024,
      output_format: "webp",
    }),
    signal: AbortSignal.timeout(60_000),
  });

  if (!res.ok)
    throw new MediaGenerationError(
      `NanaBanana ${res.status}`,
      "NANABANANA_ERROR",
    );
  const data = (await res.json()) as {
    image_url?: string;
    image_base64?: string;
  };

  if (data.image_base64) return Buffer.from(data.image_base64, "base64");
  if (data.image_url) {
    const img = await fetch(data.image_url, {
      signal: AbortSignal.timeout(30_000),
    });
    return Buffer.from(await img.arrayBuffer());
  }
  throw new MediaGenerationError(
    "NanaBanana returned no image",
    "NANABANANA_ERROR",
  );
}

// ─── DALL-E ──────────────────────────────────────────────────────────────────

async function generateViaDalle(
  input: GenerateImageInput,
  apiKey: string,
): Promise<Buffer> {
  const res = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "dall-e-3",
      prompt: input.prompt,
      size: `${input.width ?? 1024}x${input.height ?? 1024}`,
      response_format: "b64_json",
      n: 1,
    }),
    signal: AbortSignal.timeout(90_000),
  });

  if (!res.ok)
    throw new MediaGenerationError(`DALL-E ${res.status}`, "DALLE_ERROR");
  const data = (await res.json()) as {
    data?: Array<{ b64_json?: string; url?: string }>;
  };
  const item = data.data?.[0];
  if (!item)
    throw new MediaGenerationError("DALL-E returned no image", "DALLE_ERROR");

  if (item.b64_json) return Buffer.from(item.b64_json, "base64");
  if (item.url) {
    const img = await fetch(item.url, { signal: AbortSignal.timeout(30_000) });
    return Buffer.from(await img.arrayBuffer());
  }
  throw new MediaGenerationError(
    "DALL-E returned no usable image",
    "DALLE_ERROR",
  );
}

// ─── Ollama Vision (local fallback) ──────────────────────────────────────────

async function generateViaOllama(input: GenerateImageInput): Promise<Buffer> {
  const ollamaUrl = process.env["OLLAMA_BASE_URL"] ?? "http://localhost:11434";
  const res = await fetch(`${ollamaUrl}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "llava:7b",
      prompt: `Generate image: ${input.prompt}. Return ONLY base64 PNG data, no explanation.`,
      stream: false,
    }),
    signal: AbortSignal.timeout(120_000),
  });

  if (!res.ok)
    throw new MediaGenerationError(`Ollama ${res.status}`, "OLLAMA_ERROR");
  const data = (await res.json()) as { response?: string };
  const b64 = data.response?.trim();
  if (!b64)
    throw new MediaGenerationError(
      "Ollama returned no image data",
      "OLLAMA_ERROR",
    );

  return Buffer.from(b64, "base64");
}

// ─── Router (fallback chain) ──────────────────────────────────────────────────

export interface MediaGenSecrets {
  getNanaBananaKey(): Promise<string | null>;
  getDalleKey(): Promise<string | null>;
}

export class MediaGenerationRouter {
  constructor(private readonly secrets: MediaGenSecrets) {}

  async generate(input: GenerateImageInput): Promise<GeneratedImage> {
    const providers: Array<{ name: string; fn: () => Promise<Buffer> }> = [];

    const nanaKey = await this.secrets.getNanaBananaKey();
    if (nanaKey) {
      providers.push({
        name: "NanaBanana",
        fn: () => generateViaNanaBanana(input, nanaKey),
      });
    }

    const dalleKey = await this.secrets.getDalleKey();
    if (dalleKey) {
      providers.push({
        name: "DALL-E",
        fn: () => generateViaDalle(input, dalleKey),
      });
    }

    providers.push({
      name: "OllamaVision",
      fn: () => generateViaOllama(input),
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
          // Provider returned invalid image — try next
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
