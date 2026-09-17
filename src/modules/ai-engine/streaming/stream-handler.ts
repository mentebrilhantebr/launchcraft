/**
 * Stream Handler
 *
 * Bridges an LLM provider's streaming output to an SSE controller, forwarding
 * each delta chunk and accumulating the full response text.
 *
 * @module ai-engine/streaming/stream-handler
 */

import type {
  GenerateOptions,
  LLMProvider,
} from '../providers/base-provider';
import { sendChunk } from './sse-stream';

/**
 * Streams a provider response to the given SSE controller.
 *
 * Forwards each delta as `{ type: 'delta', content }`. Does NOT send the
 * terminal `[DONE]` event — the caller decides when the whole request is
 * complete (e.g. after persisting the message).
 *
 * @returns The full accumulated response text.
 * @throws Rethrows provider errors so the caller can attempt a fallback.
 */
export async function streamLLMResponse(
  provider: LLMProvider,
  options: GenerateOptions,
  sseController: ReadableStreamDefaultController<Uint8Array>
): Promise<string> {
  let fullText = '';

  for await (const chunk of provider.generateStream(options)) {
    if (chunk.type === 'delta' && chunk.content) {
      fullText += chunk.content;
      sendChunk(sseController, { type: 'delta', content: chunk.content });
    } else if (chunk.type === 'error') {
      // Let the provider's generator throw; this is a safety net.
      throw new Error(chunk.error ?? 'Erro no streaming do provedor de IA.');
    }
  }

  return fullText;
}
