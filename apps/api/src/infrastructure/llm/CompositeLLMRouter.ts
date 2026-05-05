import type { LLMRouter, LLMCompletionRequest, LLMCompletionResponse } from './LLMRouter.js';
import { OllamaAdapter } from './OllamaAdapter.js';
import { OpenAIAdapter } from './OpenAIAdapter.js';
import { AnthropicAdapter } from './AnthropicAdapter.js';
import { GoogleAdapter } from './GoogleAdapter.js';
import type { SecretsProvider } from '../secrets/SecretsProvider.js';

/**
 * Composite LLM Router — dispatches to the correct adapter based on provider.
 * Factory pattern with lazy initialization.
 */
export class CompositeLLMRouter implements LLMRouter {
  private readonly adapters: Map<string, LLMRouter> = new Map();

  constructor(secrets: SecretsProvider) {
    this.adapters.set('OLLAMA', new OllamaAdapter());
    this.adapters.set('OPENAI', new OpenAIAdapter(secrets));
    this.adapters.set('GROQ', new OpenAIAdapter(secrets)); // Groq is OpenAI-compatible
    this.adapters.set('ANTHROPIC', new AnthropicAdapter(secrets));
    this.adapters.set('GOOGLE', new GoogleAdapter(secrets));
  }

  async complete(request: LLMCompletionRequest): Promise<LLMCompletionResponse> {
    const adapter = this.adapters.get(request.provider.toUpperCase());
    if (!adapter) {
      throw new Error(`Unsupported LLM provider: ${request.provider}`);
    }
    return adapter.complete(request);
  }

  async isAvailable(provider: string): Promise<boolean> {
    const adapter = this.adapters.get(provider.toUpperCase());
    if (!adapter) return false;
    return adapter.isAvailable(provider);
  }
}
