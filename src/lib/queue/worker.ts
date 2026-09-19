/**
 * Worker process entrypoint
 *
 * Long-lived Node process that consumes the BullMQ queues. This is intentionally
 * a SEPARATE process from the Next.js server: content generation must never run
 * inside the synchronous HTTP request (Prompt de Construção, Etapa 6).
 *
 * Run with:  npm run worker
 *
 * Requires Redis to be reachable (REDIS_URL) and an LLM API key configured.
 *
 * @module lib/queue/worker
 */

import { createAIGenerationWorker } from './workers/ai-generation-worker';

const worker = createAIGenerationWorker();

worker.on('ready', () => {
  console.log('[worker] AI generation worker pronto e ouvindo a fila.');
});

worker.on('active', (job) => {
  console.log(`[worker] Job ${job.id} iniciado (${job.name}).`);
});

worker.on('completed', (job) => {
  console.log(`[worker] Job ${job.id} concluído com sucesso.`);
});

worker.on('failed', (job, err) => {
  console.error(`[worker] Job ${job?.id} falhou:`, err?.message ?? err);
});

worker.on('error', (err) => {
  console.error('[worker] Erro no worker:', err?.message ?? err);
});

// Graceful shutdown so in-flight jobs are not lost.
async function shutdown(signal: string): Promise<void> {
  console.log(`[worker] Recebido ${signal}, encerrando worker...`);
  try {
    await worker.close();
  } finally {
    process.exit(0);
  }
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));

console.log('[worker] Inicializando worker de geração de conteúdo...');
