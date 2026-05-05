import type { LLMRouter, LLMCompletionRequest, LLMCompletionResponse } from './LLMRouter.js';

/**
 * OllamaAdapter — connects to local Ollama instance.
 * No API key required. Uses standard /api/chat endpoint.
 */
export class OllamaAdapter implements LLMRouter {
  constructor(
    private readonly baseUrl: string = 'http://localhost:11434',
  ) {}

  async complete(request: LLMCompletionRequest): Promise<LLMCompletionResponse> {
    const url = `${request.baseUrl ?? this.baseUrl}/api/chat`;
    const start = performance.now();

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: request.model,
        messages: request.messages,
        stream: false,
        options: {
          temperature: request.temperature ?? 0.7,
          num_predict: request.maxTokens ?? 4096,
        },
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Ollama error ${response.status}: ${error}`);
    }

    const data = (await response.json()) as {
      message: { content: string };
      eval_count?: number;
      prompt_eval_count?: number;
    };

    const latencyMs = Math.round(performance.now() - start);
    const tokensUsed = (data.eval_count ?? 0) + (data.prompt_eval_count ?? 0);

    return {
      content: data.message.content,
      tokensUsed,
      finishReason: 'stop',
      latencyMs,
    };
  }

  async isAvailable(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`, { signal: AbortSignal.timeout(2000) });
      return response.ok;
    } catch {
      return false;
    }
  }
}
