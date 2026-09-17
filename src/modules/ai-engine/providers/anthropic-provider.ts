/**
 * Anthropic LLM Provider
 *
 * Implements the LLMProvider contract using the `@anthropic-ai/sdk`.
 * Primary model: claude-3-5-sonnet-20241022. Fallback: claude-3-haiku-20240307.
 *
 * @module ai-engine/providers/anthropic-provider
 */

import Anthropic from '@anthropic-ai/sdk';
import {
  type GenerateOptions,
  type LLMProvider,
  type Message,
  type StreamChunk,
  getDefaultGenerateConfig,
} from './base-provider';

const PRIMARY_MODEL = 'claude-3-5-sonnet-20241022';
const FALLBACK_MODEL = 'claude-3-haiku-20240307';

/**
 * Provider backed by Anthropic Messages API.
 */
export class AnthropicProvider implements LLMProvider {
  public readonly name = 'anthropic';
  private client: Anthropic | null = null;

  constructor() {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (apiKey) {
      this.client = new Anthropic({ apiKey });
    }
  }

  public isConfigured(): boolean {
    return Boolean(process.env.ANTHROPIC_API_KEY);
  }

  private getClient(): Anthropic {
    if (!this.client) {
      const apiKey = process.env.ANTHROPIC_API_KEY;
      if (!apiKey) {
        throw new Error('ANTHROPIC_API_KEY não configurada.');
      }
      this.client = new Anthropic({ apiKey });
    }
    return this.client;
  }

  /**
   * Anthropic keeps the system prompt separate from the message list and only
   * accepts `user` / `assistant` roles. Any `system` message in the list is
   * folded into the system prompt.
   */
  private splitMessages(
    messages: Message[],
    systemPrompt?: string
  ): { system: string | undefined; messages: Anthropic.MessageParam[] } {
    const systemParts: string[] = [];
    if (systemPrompt) {
      systemParts.push(systemPrompt);
    }

    const mapped: Anthropic.MessageParam[] = [];
    for (const message of messages) {
      if (message.role === 'system') {
        systemParts.push(message.content);
        continue;
      }
      mapped.push({ role: message.role, content: message.content });
    }

    return {
      system: systemParts.length > 0 ? systemParts.join('\n\n') : undefined,
      messages: mapped,
    };
  }

  public async *generateStream(
    options: GenerateOptions
  ): AsyncGenerator<StreamChunk> {
    const defaults = getDefaultGenerateConfig();
    const model = options.model ?? PRIMARY_MODEL;
    const { system, messages } = this.splitMessages(
      options.messages,
      options.systemPrompt
    );

    try {
      const client = this.getClient();
      const stream = await client.messages.create({
        model,
        system,
        messages,
        max_tokens: options.maxTokens ?? defaults.maxTokens,
        temperature: options.temperature ?? defaults.temperature,
        stream: true,
      });

      for await (const event of stream) {
        if (
          event.type === 'content_block_delta' &&
          event.delta.type === 'text_delta'
        ) {
          yield { type: 'delta', content: event.delta.text };
        }
      }

      yield { type: 'done' };
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Erro desconhecido no Anthropic';
      yield { type: 'error', error: message };
      throw error;
    }
  }

  public async generate(options: GenerateOptions): Promise<string> {
    const defaults = getDefaultGenerateConfig();
    const model = options.model ?? PRIMARY_MODEL;
    const { system, messages } = this.splitMessages(
      options.messages,
      options.systemPrompt
    );

    const client = this.getClient();
    const response = await client.messages.create({
      model,
      system,
      messages,
      max_tokens: options.maxTokens ?? defaults.maxTokens,
      temperature: options.temperature ?? defaults.temperature,
      stream: false,
    });

    return response.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map((block) => block.text)
      .join('');
  }

  public countTokens(text: string): number {
    // Simple approximation: ~4 characters per token.
    return Math.ceil(text.length / 4);
  }
}

export {
  PRIMARY_MODEL as ANTHROPIC_PRIMARY_MODEL,
  FALLBACK_MODEL as ANTHROPIC_FALLBACK_MODEL,
};
