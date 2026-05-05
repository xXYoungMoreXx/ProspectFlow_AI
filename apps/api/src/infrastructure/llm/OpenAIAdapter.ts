import type { LLMRouter, LLMCompletionRequest, LLMCompletionResponse } from './LLMRouter.js';
import type { SecretsProvider } from '../secrets/SecretsProvider.js';

/**
 * OpenAI-compatible adapter — works with OpenAI API and any OpenAI-compatible endpoint (Groq, etc).
 */
export class OpenAIAdapter implements LLMRouter {
  constructor(private readonly secrets: SecretsProvider) {}

  async complete(request: LLMCompletionRequest): Promise<LLMCompletionResponse> {
    const apiKey = request.apiKeyRef
      ? await this.secrets.get(request.apiKeyRef)
      : await this.secrets.get('OPENAI_API_KEY');

    const baseUrl = request.baseUrl ?? 'https://api.openai.com/v1';
    const start = performance.now();

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: request.model,
        messages: request.messages,
        temperature: request.temperature ?? 0.7,
        max_tokens: request.maxTokens ?? 4096,
        stream: false,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI API error ${response.status}: ${error}`);
    }

    const data = (await response.json()) as {
      choices: Array<{ message: { content: string }; finish_reason: string }>;
      usage: { total_tokens: number };
    };

    const latencyMs = Math.round(performance.now() - start);
    const choice = data.choices[0]!;

    return {
      content: choice.message.content,
      tokensUsed: data.usage.total_tokens,
      finishReason: choice.finish_reason === 'stop' ? 'stop' : 'length',
      latencyMs,
    };
  }

  async isAvailable(): Promise<boolean> {
    try {
      const apiKey = await this.secrets.getOptional('OPENAI_API_KEY');
      return !!apiKey;
    } catch {
      return false;
    }
  }
}
