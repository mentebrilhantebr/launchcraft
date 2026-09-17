/**
 * Token Counter
 *
 * Provides a lightweight token estimation without pulling in a full tokenizer.
 * Uses the common ~4 characters per token heuristic for OpenAI/Anthropic.
 *
 * @module ai-engine/context/token-counter
 */

import type { Message } from '../providers/base-provider';

const CHARS_PER_TOKEN = 4;
// Rough per-message overhead (role markers, formatting) in tokens.
const MESSAGE_OVERHEAD_TOKENS = 4;

/**
 * Approximates the number of tokens in a text string.
 */
export function countTokensApprox(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

/**
 * Approximates the number of tokens for a single message including overhead.
 */
export function countMessageTokens(message: Message): number {
  return countTokensApprox(message.content) + MESSAGE_OVERHEAD_TOKENS;
}

/**
 * Approximates the total number of tokens for an array of messages.
 */
export function countMessagesTokens(messages: Message[]): number {
  return messages.reduce((total, message) => total + countMessageTokens(message), 0);
}
