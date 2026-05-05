import type { LLMRouter, LLMCompletionRequest, LLMCompletionResponse } from './LLMRouter.js';
import type { SecretsProvider } from '../secrets/SecretsProvider.js';

/**
 * Google Gemini adapter — uses the Gemini REST API (v1beta).
 * Supports Gemini 3.1 Pro, 3.1 Flash, 3.0 Ultra and compatible models.
 */
export class GoogleAdapter implements LLMRouter {
  constructor(private readonly secrets: SecretsProvider) {}

  async complete(request: LLMCompletionRequest): Promise<LLMCompletionResponse> {
    const apiKey = request.apiKeyRef
      ? await this.secrets.get(request.apiKeyRef)
      : await this.secrets.get('GOOGLE_API_KEY');

    const baseUrl = request.baseUrl ?? 'https://generativelanguage.googleapis.com/v1beta';
    const start = performance.now();

    // Separate system instruction from conversation messages
    const systemMessage = request.messages.find((m) => m.role === 'system')?.content;
    const conversationMessages = request.messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      }));

    const body: Record<string, unknown> = {
      contents: conversationMessages,
      generationConfig: {
        temperature: request.temperature ?? 0.7,
        maxOutputTokens: request.maxTokens ?? 8192,
      },
    };

    if (systemMessage) {
      body['systemInstruction'] = {
        parts: [{ text: systemMessage }],
      };
    }

    const response = await fetch(
      `${baseUrl}/models/${request.model}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      },
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Google Gemini API error ${response.status}: ${error}`);
    }

    const data = (await response.json()) as {
      candidates: Array<{
        content: { parts: Array<{ text: string }> };
        finishReason: string;
      }>;
      usageMetadata: {
        promptTokenCount: number;
        candidatesTokenCount: number;
        totalTokenCount: number;
      };
    };

    const latencyMs = Math.round(performance.now() - start);
    const candidate = data.candidates?.[0];
    const textContent = candidate?.content?.parts?.map((p) => p.text).join('') ?? '';

    return {
      content: textContent,
      tokensUsed: data.usageMetadata?.totalTokenCount ?? 0,
      finishReason: candidate?.finishReason === 'STOP' ? 'stop' : 'length',
      latencyMs,
    };
  }

  async isAvailable(): Promise<boolean> {
    try {
      const apiKey = await this.secrets.getOptional('GOOGLE_API_KEY');
      return !!apiKey;
    } catch {
      return false;
    }
  }
}
