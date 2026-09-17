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
  type AIGenerationJob,
  type AIGenerationKind,
} from './jobs/ai-generation';
