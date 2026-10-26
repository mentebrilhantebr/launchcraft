/**
 * AI Generation Worker (BullMQ)
 *
 * Processes long-running AI content generation jobs OUTSIDE the synchronous
 * HTTP request. This enforces the Prompt de Construção rule:
 *
 *   "Toda chamada de IA que gera conteúdo deve passar pela fila — nunca
 *    processar geração de conteúdo na mesma requisição HTTP síncrona, para
 *    evitar timeout e erro 500"
 *
 * The worker runs in a separate, long-lived process (see src/lib/queue/worker.ts),
 * never inside a Next.js request lifecycle. It:
 *   1. Loads the project context (verifying ownership).
 *   2. Builds the system prompt from the current stage + decisions.
 *   3. Calls the isolated LLM orchestration layer (provider.generate).
 *   4. Persists the result inside Project.outputData (flow state) so the user
 *      recovers it exactly where they left off (Doc 08: "Recuperação de Projetos").
 *   5. Records a History entry (Doc 08: logs for the admin panel).
 *
 * @module lib/queue/workers/ai-generation-worker
 */

import type { Job, Worker } from 'bullmq';
import { prisma } from '@/modules/database';
import type { Prisma } from '@prisma/client';
import {
  buildSystemPrompt,
  getDefaultGenerateConfig,
  getPrimaryProvider,
  loadContext,
  readFlowState,
} from '@/modules/ai-engine';
import { createWorker } from '../queue-client';
import {
  AI_GENERATION_QUEUE,
  type AIGenerationJob,
} from '../jobs/ai-generation';

/**
 * Result returned by the worker for a completed generation job.
 */
export interface AIGenerationResult {
  content: string;
}

/**
 * Processes a single AI generation job.
 */
async function processAIGenerationJob(
  job: Job<AIGenerationJob, AIGenerationResult>
): Promise<AIGenerationResult> {
  const { userId, projectId, stage, kind, prompt } = job.data;

  await job.updateProgress(10);

  // 1. Load context (also verifies the project belongs to the user).
  const context = await loadContext(projectId, userId);

  // 2. Build the system prompt from the stage + decisions collected so far.
  const flowStateForPrompt = readFlowState(context.projectData);
  const systemPrompt = buildSystemPrompt(stage, flowStateForPrompt.decisions);

  await job.updateProgress(30);

  // 3. Generate through the isolated orchestration layer (never streamed here).
  const provider = getPrimaryProvider();
  if (!provider || !provider.isConfigured()) {
    throw new Error(
      'Nenhum provedor de IA está configurado. Defina a chave de API do LLM nas variáveis de ambiente para gerar conteúdo.'
    );
  }

  const { maxTokens, temperature } = getDefaultGenerateConfig();
  const content = await provider.generate({
    messages: [{ role: 'user', content: prompt }],
    systemPrompt,
    maxTokens,
    temperature,
  });

  await job.updateProgress(80);

  // 4. Persist the generated content inside the project's flow state.
  //    CONDIÇÃO DE CORRIDA (correção aprovada): em vez de ler o outputData e
  //    regravá-lo inteiro (o que apagaria um upload concorrente), gravamos
  //    APENAS a subchave {generations} com append atômico via jsonb_set
  //    parametrizado. O WHERE com user_id reforça o isolamento por usuário.
  const generation = {
    jobId: job.id ?? null,
    kind,
    stage,
    content,
    createdAt: new Date().toISOString(),
  };

  await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    await tx.$executeRaw`
      UPDATE projects
      SET output_data = jsonb_set(
            COALESCE(output_data, '{}'::jsonb),
            '{generations}',
            COALESCE(output_data -> 'generations', '[]'::jsonb) || ${JSON.stringify(
              [generation]
            )}::jsonb,
            true
          ),
          updated_at = now()
      WHERE id = ${projectId}::uuid AND user_id = ${userId}::uuid
    `;

    // 5. Log for the admin panel (Doc 08: logs são exclusivos do admin).
    await tx.history.create({
      data: {
        userId,
        projectId,
        action: 'content_generated',
        metadata: { kind, stage, jobId: job.id ?? null },
      },
    });
  });

  await job.updateProgress(100);

  return { content };
}

/**
 * Creates and returns the AI generation worker bound to the shared Redis
 * connection. Call this once from the dedicated worker process.
 */
export function createAIGenerationWorker(): Worker<
  AIGenerationJob,
  AIGenerationResult
> {
  return createWorker<AIGenerationJob, AIGenerationResult>(
    AI_GENERATION_QUEUE,
    processAIGenerationJob
  );
}
