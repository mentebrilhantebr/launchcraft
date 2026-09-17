/**
 * SSE Stream helpers for Next.js App Router
 *
 * Provides a ReadableStream + controller pair and helpers to format
 * Server-Sent Events chunks.
 *
 * @module ai-engine/streaming/sse-stream
 */

const encoder = new TextEncoder();

/**
 * SSE stream bundle: the ReadableStream to return in a Response and the
 * controller used to push chunks.
 */
export interface SSEStream {
  stream: ReadableStream<Uint8Array>;
  controller: ReadableStreamDefaultController<Uint8Array>;
}

/**
 * Creates a ReadableStream and exposes its controller for pushing SSE events.
 */
export function createSSEStream(): SSEStream {
  let streamController!: ReadableStreamDefaultController<Uint8Array>;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      streamController = controller;
    },
  });

  return { stream, controller: streamController };
}

/**
 * Sends a JSON-serializable data chunk as an SSE `data:` event.
 */
export function sendChunk(
  controller: ReadableStreamDefaultController<Uint8Array>,
  data: object
): void {
  controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
}

/**
 * Sends the terminal `[DONE]` SSE event.
 */
export function sendDone(
  controller: ReadableStreamDefaultController<Uint8Array>
): void {
  controller.enqueue(encoder.encode('data: [DONE]\n\n'));
}

/**
 * Sends an error chunk to the client.
 */
export function sendError(
  controller: ReadableStreamDefaultController<Uint8Array>,
  error: string
): void {
  sendChunk(controller, { type: 'error', error });
}

/**
 * Standard headers required for SSE responses in the Next.js App Router.
 */
export const SSE_HEADERS: Record<string, string> = {
  'Content-Type': 'text/event-stream',
  'Cache-Control': 'no-cache, no-transform',
  Connection: 'keep-alive',
  'X-Accel-Buffering': 'no',
};
