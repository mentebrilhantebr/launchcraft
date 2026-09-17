/**
 * API Route: Chat com IA (streaming SSE)
 *
 * POST /api/chat
 * Body: { projectId: string, message: string, stage?: number }
 * Auth: obrigatório (withAuth)
 * Resposta: stream SSE (text/event-stream)
 *
 * @module api/chat
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/security';
import { orchestrator, SSE_HEADERS } from '@/modules/ai-engine';

// Streaming requires the Node.js runtime (not Edge) for our DB + SDK usage.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  return withAuth(request, async (req) => {
    const userId = req.user?.userId;
    if (!userId) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { error: 'Corpo da requisição inválido' },
        { status: 400 }
      );
    }

    const { projectId, message, stage } = (body ?? {}) as {
      projectId?: string;
      message?: string;
      stage?: number;
    };

    if (!projectId || typeof projectId !== 'string') {
      return NextResponse.json(
        { error: 'O campo projectId é obrigatório' },
        { status: 400 }
      );
    }

    if (!message || typeof message !== 'string' || message.trim() === '') {
      return NextResponse.json(
        { error: 'A mensagem não pode estar vazia' },
        { status: 400 }
      );
    }

    const stageNumber =
      typeof stage === 'number' && Number.isFinite(stage) ? stage : 0;

    try {
      const stream = await orchestrator.chat({
        userId,
        projectId,
        message: message.trim(),
        stage: stageNumber,
      });

      return new NextResponse(stream, {
        status: 200,
        headers: SSE_HEADERS,
      });
    } catch (error) {
      console.error('Erro ao iniciar chat:', error);
      return NextResponse.json(
        { error: 'Erro ao processar a conversa com a IA' },
        { status: 500 }
      );
    }
  });
}
