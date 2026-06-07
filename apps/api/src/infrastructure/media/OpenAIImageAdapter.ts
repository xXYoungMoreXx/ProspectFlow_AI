/**
 * OpenAI image generation adapter.
 * Primary model: gpt-image-1 (released Apr 2025, superior to dall-e-3).
 * Falls back to dall-e-3 if gpt-image-1 fails (e.g. org not approved).
 * Both use the same /v1/images/generations endpoint.
 */
import {
  GenerateImageInput,
  MediaGenerationError,
} from "./MediaGenerationRouter.js";

const OPENAI_IMAGES_URL = "https://api.openai.com/v1/images/generations";

interface OpenAIImageResponse {
  data?: Array<{ b64_json?: string; url?: string }>;
}

async function callOpenAI(
  apiKey: string,
  body: Record<string, unknown>,
  signal: AbortSignal,
): Promise<Buffer> {
  const res = await fetch(OPENAI_IMAGES_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
    signal,
  });

  if (!res.ok) {
    throw new MediaGenerationError(
      `OpenAI images ${res.status}: ${await res.text()}`,
      "OPENAI_IMAGE_ERROR",
    );
  }

  const data = (await res.json()) as OpenAIImageResponse;
  const item = data.data?.[0];
  if (!item) {
    throw new MediaGenerationError(
      "OpenAI returned no image",
      "OPENAI_IMAGE_ERROR",
    );
  }

  if (item.b64_json) return Buffer.from(item.b64_json, "base64");
  if (item.url) {
    const img = await fetch(item.url, { signal: AbortSignal.timeout(30_000) });
    return Buffer.from(await img.arrayBuffer());
  }
  throw new MediaGenerationError(
    "OpenAI returned no usable image",
    "OPENAI_IMAGE_ERROR",
  );
}

export class OpenAIImageAdapter {
  constructor(private readonly apiKey: string) {}

  async generate(input: GenerateImageInput): Promise<Buffer> {
    // Attempt gpt-image-1 first (better quality, supports output_format)
    try {
      return await callOpenAI(
        this.apiKey,
        {
          model: "gpt-image-1",
          prompt: input.prompt,
          n: 1,
          size: "1024x1024",
          output_format: "png",
        },
        AbortSignal.timeout(90_000),
      );
    } catch (e) {
      // Fall back to dall-e-3 if gpt-image-1 not available for this key
      if (e instanceof MediaGenerationError && e.message.includes("403")) {
        return await callOpenAI(
          this.apiKey,
          {
            model: "dall-e-3",
            prompt: input.prompt,
            n: 1,
            size: "1024x1024",
            response_format: "b64_json",
          },
          AbortSignal.timeout(90_000),
        );
      }
      throw e;
    }
  }
}
