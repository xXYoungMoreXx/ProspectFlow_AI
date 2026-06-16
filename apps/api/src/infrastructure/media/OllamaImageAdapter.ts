/**
 * Ollama local image generation adapter (last-resort fallback).
 * Uses llava:7b model — note Ollama doesn't truly generate images;
 * this returns a base64 PNG described in text, best-effort only.
 */
import {
  GenerateImageInput,
  MediaGenerationError,
} from "./MediaGenerationRouter.js";

interface OllamaResponse {
  response?: string;
}

export class OllamaImageAdapter {
  private readonly baseUrl: string;

  constructor(baseUrl?: string) {
    this.baseUrl =
      baseUrl ?? process.env["OLLAMA_BASE_URL"] ?? "http://localhost:11434";
  }

  async generate(input: GenerateImageInput): Promise<Buffer> {
    const res = await fetch(`${this.baseUrl}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "llava:7b",
        prompt: `Generate image: ${input.prompt}. Return ONLY base64 PNG data, no explanation.`,
        stream: false,
      }),
      signal: AbortSignal.timeout(120_000),
    });

    if (!res.ok) {
      throw new MediaGenerationError(`Ollama ${res.status}`, "OLLAMA_ERROR");
    }

    const data = (await res.json()) as OllamaResponse;
    const b64 = data.response?.trim();
    if (!b64) {
      throw new MediaGenerationError(
        "Ollama returned no image data",
        "OLLAMA_ERROR",
      );
    }

    return Buffer.from(b64, "base64");
  }
}
