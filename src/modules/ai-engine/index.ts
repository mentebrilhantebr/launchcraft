/**
 * AI Engine - public module exports
 *
 * Central orchestration layer for LaunchCraft's conversational AI.
 *
 * @module ai-engine
 */

// Orchestrator (main entry point)
export { AIOrchestrator, orchestrator, type ChatInput } from './orchestrator';

// Providers
export {
  getProvider,
  getPrimaryProvider,
  getFallbackProvider,
  OpenAIProvider,
  AnthropicProvider,
  getDefaultGenerateConfig,
  type LLMProvider,
  type Message,
  type MessageRole,
  type GenerateOptions,
  type StreamChunk,
  type ProviderName,
} from './providers';

// Prompts
export {
  LAUNCHCRAFT_SYSTEM_PROMPT,
  STAGE_PROMPTS,
  TOTAL_STAGES,
  getStagePrompt,
  buildSystemPrompt,
  buildMessages,
  type StagePrompt,
  type StageKind,
} from './prompts';

// Flow (12-stage construction logic - Doc 04)
export {
  FLOW_STAGES,
  FIRST_STAGE,
  LAST_STAGE,
  isValidStage,
  getStageMeta,
  canAdvance,
  canGoBack,
  nextStage,
  previousStage,
  isSequentialAdvance,
  emptyFlowState,
  readFlowState,
  mergeDecisions,
  recordStageEntry,
  type StageMeta,
  type ProjectDecisions,
  type ProjectFlowState,
  type StageHistoryEntry,
} from './flow';

// Context
export {
  loadContext,
  saveMessage,
  trimToContextWindow,
  countTokensApprox,
  countMessagesTokens,
  type ConversationContext,
  type StoredMessage,
} from './context';

// Streaming
export {
  createSSEStream,
  sendChunk,
  sendDone,
  sendError,
  SSE_HEADERS,
  streamLLMResponse,
  type SSEStream,
} from './streaming';
