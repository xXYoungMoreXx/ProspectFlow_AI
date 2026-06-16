/**
 * Google Imagen 4.0 adapter — Gemini API endpoint.
 * Requires GOOGLE_IMAGEN_API_KEY (Google AI Studio key with Imagen access).
 * Model: imagen-4.0-generate-001
 */
import {
  GenerateImageInput,
  MediaGenerationError,
} from "./MediaGenerationRouter.js";

const IMAGEN_MODEL = "imagen-4.0-generate-001";
const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

interface ImagenResponse {
  generatedImages?: Array<{
    image?: { imageBytes?: string; mimeType?: string };
    raiFilteredReason?: string;
  }>;
}

export class ImagenAdapter {
  constructor(private readonly apiKey: string) {}

  async generate(input: GenerateImageInput): Promise<Buffer> {
    const res = await fetch(
      `${GEMINI_BASE}/${IMAGEN_MODEL}:generateImages?key=${this.apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: input.prompt,
          config: {
            numberOfImages: 1,
            outputMimeType: "image/png",
            aspectRatio:
              input.width && input.height && input.width !== input.height
                ? input.width > input.height
                  ? "16:9"
                  : "9:16"
                : "1:1",
          },
        }),
        signal: AbortSignal.timeout(90_000),
      },
    );

    if (!res.ok) {
      throw new MediaGenerationError(
        `Imagen ${res.status}: ${await res.text()}`,
        "IMAGEN_ERROR",
      );
    }

    const data = (await res.json()) as ImagenResponse;
    const imageBytes = data.generatedImages?.[0]?.image?.imageBytes;
    if (!imageBytes) {
      const reason = data.generatedImages?.[0]?.raiFilteredReason;
      throw new MediaGenerationError(
        `Imagen returned no image${reason ? `: ${reason}` : ""}`,
        "IMAGEN_ERROR",
      );
    }

    return Buffer.from(imageBytes, "base64");
  }
}
