/**
 * Context Window Manager
 *
 * Keeps the conversation within a token budget using a sliding window:
 * the system message (if present) is always preserved, and the most recent
 * messages that fit within the limit are retained.
 *
 * @module ai-engine/context/context-window
 */

import type { Message } from '../providers/base-provider';
import { countMessageTokens } from './token-counter';

/**
 * Trims the messages array so its total token count stays within maxTokens.
 *
 * Strategy:
 * - Always keep the leading system message (if any).
 * - Keep as many of the most recent non-system messages as fit the budget.
 *
 * @param messages - Full ordered list of messages.
 * @param maxTokens - Maximum token budget for the whole message list.
 * @returns A trimmed, order-preserving list of messages.
 */
export function trimToContextWindow(
  messages: Message[],
  maxTokens: number
): Message[] {
  if (messages.length === 0 || maxTokens <= 0) {
    return messages.length === 0 ? [] : messages;
  }

  // Separate a leading system message if present.
  const hasSystem = messages[0]?.role === 'system';
  const systemMessage = hasSystem ? messages[0] : undefined;
  const rest = hasSystem ? messages.slice(1) : messages;

  let budget = maxTokens;
  if (systemMessage) {
    budget -= countMessageTokens(systemMessage);
  }

  // Walk from the newest message backwards, keeping what fits.
  const kept: Message[] = [];
  for (let i = rest.length - 1; i >= 0; i--) {
    const message = rest[i];
    const cost = countMessageTokens(message);
    if (cost > budget) {
      break;
    }
    budget -= cost;
    kept.unshift(message);
  }

  return systemMessage ? [systemMessage, ...kept] : kept;
}
