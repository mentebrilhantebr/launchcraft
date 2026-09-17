/**
 * OpenAI LLM Provider
 *
 * Implements the LLMProvider contract using the `openai` SDK.
 * Primary model: gpt-4o. Internal fallback: gpt-4o-mini.
 *
 * @module ai-engine/providers/openai-provider
 */

import OpenAI from 'openai';
import type {
  ChatCompletionMessageParam,
} from 'openai/resources/chat/completions';
import {
  type GenerateOptions,
  type LLMProvider,
  type Message,
  type StreamChunk,
  getDefaultGenerateConfig,
} from './base-provider';

const PRIMARY_MODEL = 'gpt-4o';
const FALLBACK_MODEL = 'gpt-4o-mini';

/**
 * Provider backed by OpenAI Chat Completions API.
 */
export class OpenAIProvider implements LLMProvider {
  public readonly name = 'openai';
  private client: OpenAI | null = null;

  constructor() {
    const apiKey = process.env.OPENAI_API_KEY;
    if (apiKey) {
      this.client = new OpenAI({ apiKey });
    }
  }

  public isConfigured(): boolean {
    return Boolean(process.env.OPENAI_API_KEY);
  }

  private getClient(): OpenAI {
    if (!this.client) {
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) {
        throw new Error('OPENAI_API_KEY não configurada.');
      }
      this.client = new OpenAI({ apiKey });
    }
    return this.client;
  }

  /**
   * Maps generic messages + optional system prompt to OpenAI message params.
   */
  private buildMessages(
    messages: Message[],
    systemPrompt?: string
  ): ChatCompletionMessageParam[] {
    const result: ChatCompletionMessageParam[] = [];

    if (systemPrompt) {
      result.push({ role: 'system', content: systemPrompt });
    }

    for (const message of messages) {
      result.push({ role: message.role, content: message.content });
    }

    return result;
  }

  public async *generateStream(
    options: GenerateOptions
  ): AsyncGenerator<StreamChunk> {
    const defaults = getDefaultGenerateConfig();
    const model = options.model ?? PRIMARY_MODEL;

    try {
      const client = this.getClient();
      const stream = await client.chat.completions.create({
        model,
        messages: this.buildMessages(options.messages, options.systemPrompt),
        max_tokens: options.maxTokens ?? defaults.maxTokens,
        temperature: options.temperature ?? defaults.temperature,
        stream: true,
      });

      for await (const part of stream) {
        const delta = part.choices[0]?.delta?.content;
        if (delta) {
          yield { type: 'delta', content: delta };
        }
      }

      yield { type: 'done' };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Erro desconhecido no OpenAI';
      yield { type: 'error', error: message };
      throw error;
    }
  }

  public async generate(options: GenerateOptions): Promise<string> {
    const defaults = getDefaultGenerateConfig();
    const model = options.model ?? PRIMARY_MODEL;

    const client = this.getClient();
    const completion = await client.chat.completions.create({
      model,
      messages: this.buildMessages(options.messages, options.systemPrompt),
      max_tokens: options.maxTokens ?? defaults.maxTokens,
      temperature: options.temperature ?? defaults.temperature,
      stream: false,
    });

    return completion.choices[0]?.message?.content ?? '';
  }

  public countTokens(text: string): number {
    // Simple approximation: ~4 characters per token.
    return Math.ceil(text.length / 4);
  }
}

export { PRIMARY_MODEL as OPENAI_PRIMARY_MODEL, FALLBACK_MODEL as OPENAI_FALLBACK_MODEL };
