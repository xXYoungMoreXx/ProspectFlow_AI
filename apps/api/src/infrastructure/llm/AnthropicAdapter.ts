import type { LLMRouter, LLMCompletionRequest, LLMCompletionResponse } from './LLMRouter.js';
import type { SecretsProvider } from '../secrets/SecretsProvider.js';

/**
 * Anthropic adapter — uses Anthropic Messages API (v2024-01-01+).
 */
export class AnthropicAdapter implements LLMRouter {
  constructor(private readonly secrets: SecretsProvider) {}

  async complete(request: LLMCompletionRequest): Promise<LLMCompletionResponse> {
    const apiKey = request.apiKeyRef
      ? await this.secrets.get(request.apiKeyRef)
      : await this.secrets.get('ANTHROPIC_API_KEY');

    const start = performance.now();

    // Anthropic requires system message separate from messages array
    const systemMessage = request.messages.find((m) => m.role === 'system')?.content;
    const nonSystemMessages = request.messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({ role: m.role, content: m.content }));

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2024-01-01',
      },
      body: JSON.stringify({
        model: request.model,
        max_tokens: request.maxTokens ?? 4096,
        temperature: request.temperature ?? 0.7,
        system: systemMessage,
        messages: nonSystemMessages,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Anthropic API error ${response.status}: ${error}`);
    }

    const data = (await response.json()) as {
      content: Array<{ type: string; text: string }>;
      usage: { input_tokens: number; output_tokens: number };
      stop_reason: string;
    };

    const latencyMs = Math.round(performance.now() - start);
    const textContent = data.content.find((c) => c.type === 'text')?.text ?? '';

    return {
      content: textContent,
      tokensUsed: data.usage.input_tokens + data.usage.output_tokens,
      finishReason: data.stop_reason === 'end_turn' ? 'stop' : 'length',
      latencyMs,
    };
  }

  async isAvailable(): Promise<boolean> {
    try {
      const apiKey = await this.secrets.getOptional('ANTHROPIC_API_KEY');
      return !!apiKey;
    } catch {
      return false;
    }
  }
}
