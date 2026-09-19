/**
 * API Route: Progresso de geração em tempo real via SSE (Etapa 7)
 *
 * GET /api/projects/:id/generate/progress?jobId=<id>
 *
 * Abre uma stream SSE (Server-Sent Events) que emite eventos de progresso do
 * job de geração assíncrona. Usa BullMQ QueueEvents ligado ao Redis para
 * receber em tempo real os eventos publicados pelo worker em outro processo —
 * sem polling, sem WebSockets.
 *
 * Citação do Prompt de Construção (tabela Stack, linha "Tempo real"):
 *   "SSE (Server-Sent Events) — apenas isso, não usar WebSockets nesta fase"
 *
 * Citação Doc 02, seção 9:
 *   "Enquanto trabalha, a IA informa o progresso. Exemplos:
 *    Analisando sua ideia... Organizando as páginas...
 *    Criando a estrutura do negócio... Gerando descrições...
 *    Preparando SEO... Finalizando seu projeto..."
 *
 * Auth: Bearer token obrigatório (mesmo padrão de /api/chat).
 * O cliente NÃO usa EventSource nativo (que não suporta headers custom);
 * usa fetch() + ReadableStream reader — igual ao handleSend no chat.
 *
 * Eventos emitidos ao cliente:
 *   { type: 'progress', progress: number, message: string }
 *   { type: 'completed', content: string }
 *   { type: 'error', error: string }
 *   data: [DONE]
 *
 * @module api/projects/[id]/generate/progress
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/modules/database';
import { withAuth } from '@/lib/security';
import { AI_GENERATION_QUEUE, getAIGenerationJob } from '@/lib/queue';
import { createQueueEvents } from '@/lib/queue/queue-events';
import {
  createSSEStream,
  sendChunk,
  sendDone,
  SSE_HEADERS,
} from '@/modules/ai-engine/streaming/sse-stream';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Rótulo textual do progresso — exemplos literais do Doc 02, seção 9.
 * "O usuário sempre saberá em que etapa está."
 */
function progressLabel(p: number): string {
  if (p <= 10) return 'Analisando sua ideia...';
  if (p <= 30) return 'Organizando as páginas...';
  if (p <= 80) return 'Criando a estrutura do negócio...';
  if (p < 100) return 'Finalizando seu projeto...';
  return 'Concluído!';
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(request, async (req) => {
    const userId = req.user?.userId;
    const { id } = await params;

    const jobId = request.nextUrl.searchParams.get('jobId');
    if (!jobId) {
      return NextResponse.json(
        { error: "Parâmetro 'jobId' é obrigatório." },
        { status: 400 }
      );
    }

    // Verificar ownership do projeto (segurança: nunca expor jobs de outros).
    const project = await prisma.project.findUnique({
      where: { id },
      select: { userId: true },
    });

    if (!project) {
      return NextResponse.json(
        { error: 'Projeto não encontrado.' },
        { status: 404 }
      );
    }

    if (project.userId !== userId) {
      return NextResponse.json(
        { error: 'Você não tem acesso a este projeto.' },
        { status: 403 }
      );
    }

    // Checar se o job existe antes de abrir qualquer stream.
    const status = await getAIGenerationJob(jobId);
    if (!status) {
      return NextResponse.json(
        { error: 'Job não encontrado.' },
        { status: 404 }
      );
    }

    const { stream, controller } = createSSEStream();

    // ── Job já concluído: emitir resultado sem abrir QueueEvents ──────────
    if (status.state === 'completed') {
      sendChunk(controller, {
        type: 'progress',
        progress: 100,
        message: 'Concluído!',
      });
      sendChunk(controller, {
        type: 'completed',
        content: status.result ?? '',
      });
      sendDone(controller);
      try { controller.close(); } catch { /* já fechado */ }
      return new NextResponse(stream, { status: 200, headers: SSE_HEADERS });
    }

    if (status.state === 'failed') {
      sendChunk(controller, {
        type: 'error',
        error: status.failedReason ?? 'Geração falhou.',
      });
      sendDone(controller);
      try { controller.close(); } catch { /* já fechado */ }
      return new NextResponse(stream, { status: 200, headers: SSE_HEADERS });
    }

    // ── Job em andamento: emitir progresso atual e ouvir eventos futuros ──
    if (status.progress > 0) {
      sendChunk(controller, {
        type: 'progress',
        progress: status.progress,
        message: progressLabel(status.progress),
      });
    }

    const queueEvents = createQueueEvents(AI_GENERATION_QUEUE);
    let closed = false;

    const cleanup = () => {
      if (closed) return;
      closed = true;
      clearTimeout(timeout);
      queueEvents.close().catch(() => { /* ignorar erros no close */ });
      try { controller.close(); } catch { /* já fechado */ }
    };

    // Guarda contra jobs travados — Doc 08: evitar telas paradas.
    const timeout = setTimeout(() => {
      sendChunk(controller, {
        type: 'error',
        error: 'Tempo limite excedido aguardando a geração.',
      });
      sendDone(controller);
      cleanup();
    }, 5 * 60 * 1000);

    // Erros de conexão Redis: sem handler, Node.js lança unhandled error event.
    queueEvents.on('error', (err: Error) => {
      console.error('[SSE progress] QueueEvents error:', err?.message);
      if (!closed) {
        sendChunk(controller, {
          type: 'error',
          error: 'Erro na conexão com a fila. Tente novamente.',
        });
        sendDone(controller);
        cleanup();
      }
    });

    // Progresso incremental do worker (job.updateProgress(n)).
    queueEvents.on('progress', ({ jobId: evtId, data }) => {
      if (evtId !== jobId || closed) return;
      const progress = typeof data === 'number' ? data : 0;
      sendChunk(controller, {
        type: 'progress',
        progress,
        message: progressLabel(progress),
      });
    });

    // Conclusão do job — returnvalue já parseado pelo BullMQ v6 (JSON.parse interno).
    queueEvents.on('completed', ({ jobId: evtId, returnvalue }) => {
      if (evtId !== jobId || closed) return;
      const result = returnvalue as { content?: string } | null | undefined;
      const content = result?.content ?? '';
      sendChunk(controller, {
        type: 'progress',
        progress: 100,
        message: 'Concluído!',
      });
      sendChunk(controller, {
        type: 'completed',
        content,
      });
      sendDone(controller);
      cleanup();
    });

    // Falha do job.
    queueEvents.on('failed', ({ jobId: evtId, failedReason }) => {
      if (evtId !== jobId || closed) return;
      sendChunk(controller, {
        type: 'error',
        error: failedReason ?? 'Geração falhou.',
      });
      sendDone(controller);
      cleanup();
    });

    // Detectar desconexão do cliente e liberar recursos.
    request.signal.addEventListener('abort', cleanup);

    return new NextResponse(stream, { status: 200, headers: SSE_HEADERS });
  });
}
