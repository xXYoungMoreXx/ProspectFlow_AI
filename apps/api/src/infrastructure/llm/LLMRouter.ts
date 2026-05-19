/**
 * LLM Router Port — domain-level interface for LLM calls.
 * Implementations switch based on provider (Ollama, OpenAI, Anthropic, Groq).
 */
export interface LLMMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface LLMCompletionRequest {
  provider: string;
  model: string;
  baseUrl?: string;
  apiKeyRef?: string;
  messages: LLMMessage[];
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
}

export interface LLMCompletionResponse {
  content: string;
  tokensUsed: number;
  finishReason: "stop" | "length" | "error";
  latencyMs: number;
}

export interface LLMRouter {
  complete(request: LLMCompletionRequest): Promise<LLMCompletionResponse>;
  isAvailable(provider: string): Promise<boolean>;
}
