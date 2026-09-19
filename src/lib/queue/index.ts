/**
 * Queue module barrel export
 *
 * @module lib/queue
 */

export {
  getRedisConnection,
  createQueue,
  createWorker,
} from './queue-client';
export {
  AI_GENERATION_QUEUE,
  addAIGenerationJob,
  getAIGenerationJob,
  type AIGenerationJob,
  type AIGenerationKind,
  type AIGenerationJobStatus,
} from './jobs/ai-generation';
export { createAIGenerationWorker } from './workers/ai-generation-worker';
export { createQueueEvents } from './queue-events';
