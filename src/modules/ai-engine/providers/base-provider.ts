/**
 * Base LLM Provider - Contract for all providers
 *
 * Defines the abstract interface that every LLM provider (OpenAI, Anthropic, ...)
 * must implement so the orchestrator can stay vendor-agnostic.
 *
 * @module ai-engine/providers/base-provider
 */

/**
 * Role of a message in the conversation.
 */
export type MessageRole = 'system' | 'user' | 'assistant';

/**
 * A single message in the conversation.
 */
export interface Message {
  role: MessageRole;
  content: string;
}

/**
 * Options passed to a provider to generate a response.
 */
export interface GenerateOptions {
  /** Ordered conversation messages (excluding system prompt). */
  messages: Message[];
  /** Optional system prompt sent separately from messages. */
  systemPrompt?: string;
  /** Maximum number of tokens to generate. */
  maxTokens?: number;
  /** Sampling temperature (0-2). */
  temperature?: number;
  /** Optional explicit model override. */
  model?: string;
}

/**
 * A chunk emitted while streaming a response.
 * - `delta`: incremental piece of generated text (`content`).
 * - `done`: stream finished successfully.
 * - `error`: stream failed (`error` holds a human-readable message).
 */
export interface StreamChunk {
  type: 'delta' | 'done' | 'error';
  content?: string;
  error?: string;
}

/**
 * Contract implemented by every LLM provider.
 */
export interface LLMProvider {
  /** Provider identifier (e.g. "openai", "anthropic"). */
  readonly name: string;

  /** Whether the provider is configured (API key present). */
  isConfigured(): boolean;

  /**
   * Streams the generated response as an async generator of chunks.
   */
  generateStream(options: GenerateOptions): AsyncGenerator<StreamChunk>;

  /**
   * Generates a full (non-streamed) response and returns the text.
   */
  generate(options: GenerateOptions): Promise<string>;

  /**
   * Approximates the number of tokens for a piece of text.
   */
  countTokens(text: string): number;
}

/**
 * Default generation configuration read from environment variables.
 */
export function getDefaultGenerateConfig(): {
  maxTokens: number;
  temperature: number;
} {
  const maxTokens = Number.parseInt(process.env.LLM_MAX_TOKENS ?? '', 10);
  const temperature = Number.parseFloat(process.env.LLM_TEMPERATURE ?? '');

  return {
    maxTokens: Number.isFinite(maxTokens) ? maxTokens : 4096,
    temperature: Number.isFinite(temperature) ? temperature : 0.7,
  };
}
