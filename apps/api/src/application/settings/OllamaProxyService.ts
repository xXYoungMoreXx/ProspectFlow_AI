import type { CompositeSecretsProvider } from "../../infrastructure/secrets/CompositeSecretsProvider.js";

export interface OllamaModel {
  name: string;
  model: string;
  modifiedAt: string;
  size: number;
  digest: string;
  details: {
    parentModel: string;
    format: string;
    family: string;
    parameterSize: string;
    quantizationLevel: string;
  };
}

export interface OllamaPullProgress {
  status: string;
  digest?: string;
  total?: number;
  completed?: number;
}

export interface OllamaStatus {
  running: boolean;
  url: string;
  models: OllamaModel[];
  runningModels: Array<{
    name: string;
    model: string;
    size: number;
    expiresAt: string;
  }>;
  gpuDetected: boolean;
  gpuInfo: string | null;
}

/**
 * Proxy service for Ollama container management.
 * Communicates with the Ollama REST API inside Docker.
 */
export class OllamaProxyService {
  constructor(private readonly secrets: CompositeSecretsProvider) {}

  private async getBaseUrl(): Promise<string> {
    return (
      (await this.secrets.getOptional("OLLAMA_BASE_URL")) ??
      "http://ollama:11434"
    );
  }

  async getStatus(): Promise<OllamaStatus> {
    const url = await this.getBaseUrl();
    const result: OllamaStatus = {
      running: false,
      url,
      models: [],
      runningModels: [],
      gpuDetected: false,
      gpuInfo: null,
    };

    try {
      // Check if Ollama is running
      const tagsRes = await fetch(`${url}/api/tags`, {
        signal: AbortSignal.timeout(3000),
      });
      if (!tagsRes.ok) return result;

      result.running = true;
      const tagsData = (await tagsRes.json()) as { models: OllamaModel[] };
      result.models = tagsData.models ?? [];

      // Check running models (loaded in memory)
      try {
        const psRes = await fetch(`${url}/api/ps`, {
          signal: AbortSignal.timeout(3000),
        });
        if (psRes.ok) {
          const psData = (await psRes.json()) as {
            models: Array<{
              name: string;
              model: string;
              size: number;
              expires_at: string;
            }>;
          };
          result.runningModels = (psData.models ?? []).map((m) => ({
            name: m.name,
            model: m.model,
            size: m.size,
            expiresAt: m.expires_at,
          }));
        }
      } catch {
        // ps endpoint may not be available in older versions
      }

      // Detect GPU by checking Ollama version/show endpoint
      try {
        const versionRes = await fetch(`${url}/api/version`, {
          signal: AbortSignal.timeout(2000),
        });
        if (versionRes.ok) {
          // GPU detection: if any model is loaded and using GPU layers
          if (result.models.length > 0) {
            const firstModel = result.models[0]!;
            const showRes = await fetch(`${url}/api/show`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ model: firstModel.name }),
              signal: AbortSignal.timeout(3000),
            });
            if (showRes.ok) {
              const showData = (await showRes.json()) as {
                details?: { gpu_layers?: number };
                model_info?: Record<string, unknown>;
              };
              if (
                showData.details?.gpu_layers &&
                showData.details.gpu_layers > 0
              ) {
                result.gpuDetected = true;
                result.gpuInfo = `${showData.details.gpu_layers} GPU layers active`;
              }
            }
          }
        }
      } catch {
        // GPU detection is best-effort
      }

      return result;
    } catch {
      return result;
    }
  }

  async listModels(): Promise<OllamaModel[]> {
    const url = await this.getBaseUrl();
    const res = await fetch(`${url}/api/tags`, {
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) {
      throw new Error(`Ollama not available: HTTP ${res.status}`);
    }

    const data = (await res.json()) as { models: OllamaModel[] };
    return data.models ?? [];
  }

  /**
   * Pull a model — returns an async iterator of progress updates.
   * The caller can stream these to the frontend via SSE.
   */
  async *pullModel(modelName: string): AsyncGenerator<OllamaPullProgress> {
    const url = await this.getBaseUrl();
    const res = await fetch(`${url}/api/pull`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: modelName, stream: true }),
    });

    if (!res.ok) {
      throw new Error(`Failed to pull model: HTTP ${res.status}`);
    }

    if (!res.body) {
      throw new Error("No response body from Ollama");
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (line.trim()) {
            try {
              const progress = JSON.parse(line) as OllamaPullProgress;
              yield progress;
            } catch {
              // Skip malformed JSON lines
            }
          }
        }
      }

      // Process remaining buffer
      if (buffer.trim()) {
        try {
          yield JSON.parse(buffer) as OllamaPullProgress;
        } catch {
          // Skip
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  async deleteModel(modelName: string): Promise<void> {
    const url = await this.getBaseUrl();
    const res = await fetch(`${url}/api/delete`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: modelName }),
    });

    if (!res.ok) {
      const error = await res.text();
      throw new Error(`Failed to delete model '${modelName}': ${error}`);
    }
  }

  /**
   * List available models from the Ollama library (popular ones).
   * This is a curated list since Ollama doesn't have a search API.
   */
  getAvailableModels(): Array<{ name: string; description: string; size: string }> {
    return [
      { name: "llama3.1", description: "Meta's Llama 3.1 (8B)", size: "4.7 GB" },
      { name: "llama3.1:70b", description: "Meta's Llama 3.1 (70B)", size: "40 GB" },
      { name: "gemma2", description: "Google's Gemma 2 (9B)", size: "5.4 GB" },
      { name: "gemma2:27b", description: "Google's Gemma 2 (27B)", size: "16 GB" },
      { name: "mistral", description: "Mistral 7B", size: "4.1 GB" },
      { name: "mixtral", description: "Mixtral 8x7B MoE", size: "26 GB" },
      { name: "codellama", description: "Meta's Code Llama (7B)", size: "3.8 GB" },
      { name: "qwen2.5", description: "Alibaba Qwen 2.5 (7B)", size: "4.7 GB" },
      { name: "qwen2.5:72b", description: "Alibaba Qwen 2.5 (72B)", size: "41 GB" },
      { name: "deepseek-r1", description: "DeepSeek R1 (7B)", size: "4.7 GB" },
      { name: "phi3", description: "Microsoft Phi-3 (3.8B)", size: "2.3 GB" },
      { name: "nomic-embed-text", description: "Nomic Embed Text (137M)", size: "274 MB" },
    ];
  }
}
