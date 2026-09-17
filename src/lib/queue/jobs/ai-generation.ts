/**
 * AI Generation Job
 *
 * Defines the job type and enqueue helper for long-running AI content
 * generation tasks (e.g. generating a full sales page or course structure).
 * This is a base structure that can be expanded as generation grows heavier.
 *
 * @module lib/queue/jobs/ai-generation
 */

import type { Job } from 'bullmq';
import { createQueue } from '../queue-client';

/**
 * Name of the AI generation queue.
 */
export const AI_GENERATION_QUEUE = 'ai-generation';

/**
 * Kinds of long-running generation tasks supported.
 */
export type AIGenerationKind =
  | 'sales_page'
  | 'course_structure'
  | 'module_content'
  | 'launch_plan';

/**
 * Payload for an AI generation job.
 */
export interface AIGenerationJob {
  userId: string;
  projectId: string;
  stage: number;
  kind: AIGenerationKind;
  /** Free-form instruction / prompt context for the generation. */
  prompt: string;
  /** Optional extra parameters for the generation. */
  params?: Record<string, unknown>;
}

// Lazily created queue so importing this module doesn't require Redis at build.
let queue: ReturnType<typeof createQueue<AIGenerationJob>> | null = null;

function getQueue() {
  if (!queue) {
    queue = createQueue<AIGenerationJob>(AI_GENERATION_QUEUE);
  }
  return queue;
}

/**
 * Adds an AI generation job to the queue.
 */
export async function addAIGenerationJob(
  data: AIGenerationJob
): Promise<Job<AIGenerationJob>> {
  return getQueue().add(data.kind, data, {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: 100,
    removeOnFail: 500,
  });
}
