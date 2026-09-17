/**
 * AI Orchestrator
 *
 * Coordinates the full chat flow for LaunchCraft:
 *   load context -> build prompt -> stream from primary provider
 *   (fallback to secondary on failure) -> persist user + assistant messages.
 *
 * @module ai-engine/orchestrator
 */

import {
  loadContext,
  saveMessage,
  trimToContextWindow,
} from './context';
import { buildMessages, buildSystemPrompt } from './prompts';
import {
  getDefaultGenerateConfig,
  getFallbackProvider,
  getPrimaryProvider,
  type GenerateOptions,
} from './providers';
import {
  createSSEStream,
  sendDone,
  sendError,
  streamLLMResponse,
} from './streaming';

/**
 * Input for a single chat turn.
 */
export interface ChatInput {
  userId: string;
  projectId: string;
  message: string;
  stage: number;
}

// Reserve headroom for the model's response within a conservative context size.
const CONTEXT_TOKEN_BUDGET = 12000;

/**
 * Main orchestrator that drives the conversational flow.
 */
export class AIOrchestrator {
  /**
   * Runs a chat turn and returns a ReadableStream of SSE events.
   *
   * The heavy lifting happens asynchronously after the stream is returned so
   * the API route can respond immediately with the streaming body.
   */
  public async chat(input: ChatInput): Promise<ReadableStream<Uint8Array>> {
    const { stream, controller } = createSSEStream();

    // Kick off processing without blocking the returned stream.
    void this.process(input, controller);

    return stream;
  }

  /**
   * Internal processing pipeline. Always closes the controller.
   */
  private async process(
    input: ChatInput,
    controller: ReadableStreamDefaultController<Uint8Array>
  ): Promise<void> {
    const defaults = getDefaultGenerateConfig();

    try {
      // 1. Load conversation context (verifies ownership).
      const context = await loadContext(input.projectId, input.userId);

      // Use the stage from the request, falling back to the stored stage.
      const stage = input.stage || context.stage;

      // 2. Build system prompt + message array.
      const systemPrompt = buildSystemPrompt(
        stage,
        context.projectData ?? undefined
      );
      const history = buildMessages(context.messages, input.message);
      const trimmedHistory = trimToContextWindow(
        history,
        CONTEXT_TOKEN_BUDGET
      );

      const options: GenerateOptions = {
        messages: trimmedHistory,
        systemPrompt,
        maxTokens: defaults.maxTokens,
        temperature: defaults.temperature,
      };

      // 3. Stream with primary provider, fallback on failure.
      const fullResponse = await this.streamWithFallback(options, controller);

      // 4. Persist user message + assistant response.
      await saveMessage(input.projectId, 'user', input.message);
      await saveMessage(input.projectId, 'assistant', fullResponse);

      // 5. Signal completion.
      sendDone(controller);
    } catch (error) {
      const message = this.toUserFacingError(error);
      sendError(controller, message);
      sendDone(controller);
    } finally {
      try {
        controller.close();
      } catch {
        // Controller may already be closed; ignore.
      }
    }
  }

  /**
   * Attempts the primary provider first; if it fails before producing any
   * output, transparently retries with the fallback provider. If the primary
   * already streamed partial content, the error is surfaced instead of
   * duplicating output.
   */
  private async streamWithFallback(
    options: GenerateOptions,
    controller: ReadableStreamDefaultController<Uint8Array>
  ): Promise<string> {
    const primary = getPrimaryProvider();
    const fallback = getFallbackProvider();

    // A wrapper controller that tracks whether any delta was emitted.
    let emittedBeforeFailure = false;
    const trackingController = this.wrapController(controller, () => {
      emittedBeforeFailure = true;
    });

    try {
      if (!primary.isConfigured()) {
        throw new Error('Provedor primário de IA não configurado.');
      }
      return await streamLLMResponse(primary, options, trackingController);
    } catch (primaryError) {
      // If content was already streamed, we can't safely restart.
      if (emittedBeforeFailure) {
        throw primaryError;
      }

      // Try the fallback provider (must differ and be configured).
      if (
        fallback &&
        fallback.name !== primary.name &&
        fallback.isConfigured()
      ) {
        try {
          return await streamLLMResponse(fallback, options, controller);
        } catch {
          throw new Error(
            'Os provedores de IA estão indisponíveis no momento. Tente novamente em instantes.'
          );
        }
      }

      throw primaryError;
    }
  }

  /**
   * Wraps a controller so we can observe when the first delta is enqueued.
   */
  private wrapController(
    controller: ReadableStreamDefaultController<Uint8Array>,
    onEnqueue: () => void
  ): ReadableStreamDefaultController<Uint8Array> {
    return new Proxy(controller, {
      get(target, prop, receiver) {
        if (prop === 'enqueue') {
          return (chunk: Uint8Array) => {
            onEnqueue();
            return target.enqueue(chunk);
          };
        }
        const value = Reflect.get(target, prop, receiver);
        return typeof value === 'function' ? value.bind(target) : value;
      },
    });
  }

  /**
   * Converts internal errors into safe, user-facing Portuguese messages.
   */
  private toUserFacingError(error: unknown): string {
    if (error instanceof Error) {
      // Pass through our own domain messages (ownership / not found / config).
      if (
        error.message.includes('Projeto não encontrado') ||
        error.message.includes('não tem acesso') ||
        error.message.includes('indisponíveis') ||
        error.message.includes('não configurad')
      ) {
        return error.message;
      }
    }
    return 'Não foi possível gerar a resposta da IA. Tente novamente.';
  }
}

/**
 * Shared orchestrator instance.
 */
export const orchestrator = new AIOrchestrator();
