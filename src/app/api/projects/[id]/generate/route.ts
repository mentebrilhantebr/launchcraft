/**
 * API Route: Geração de conteúdo via fila (Etapa 6)
 *
 * POST /api/projects/:id/generate      - enfileira um job de geração de conteúdo
 *                                        (sales_page, course_structure, etc.) e
 *                                        retorna 202 com o jobId. NUNCA gera
 *                                        conteúdo dentro desta requisição HTTP.
 * GET  /api/projects/:id/generate?jobId= - consulta o status/progresso/resultado
 *                                        do job (polling). O tempo real via SSE é
 *                                        a Etapa 7.
 *
 * Regra do Prompt de Construção: "Toda chamada de IA que gera conteúdo deve
 * passar pela fila — nunca processar geração de conteúdo na mesma requisição
 * HTTP síncrona, para evitar timeout e erro 500".
 *
 * @module api/projects/[id]/generate
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/modules/database';
import { withAuth } from '@/lib/security';
import {
  addAIGenerationJob,
  getAIGenerationJob,
  type AIGenerationKind,
} from '@/lib/queue';

export const runtime = 'nodejs';

const VALID_KINDS: readonly AIGenerationKind[] = [
  'sales_page',
  'course_structure',
  'module_content',
  'launch_plan',
];

function isValidKind(value: unknown): value is AIGenerationKind {
  return (
    typeof value === 'string' &&
    (VALID_KINDS as readonly string[]).includes(value)
  );
}

/**
 * Verifica se o projeto existe e pertence ao usuário autenticado.
 * Retorna a etapa atual quando ok, ou uma NextResponse de erro.
 */
async function authorizeProject(
  id: string,
  userId: string | undefined
): Promise<{ currentStage: number } | NextResponse> {
  const project = await prisma.project.findUnique({
    where: { id },
    select: { userId: true, currentStage: true },
  });

  if (!project) {
    return NextResponse.json(
      { error: 'Projeto não encontrado' },
      { status: 404 }
    );
  }

  if (project.userId !== userId) {
    return NextResponse.json(
      { error: 'Você não tem acesso a este projeto' },
      { status: 403 }
    );
  }

  return { currentStage: project.currentStage };
}

/**
 * POST /api/projects/:id/generate
 * Body: { kind: AIGenerationKind, prompt: string, stage?: number, params?: object }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(request, async (req) => {
    const userId = req.user?.userId;
    const { id } = await params;

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { error: 'Corpo da requisição inválido' },
        { status: 400 }
      );
    }

    const { kind, prompt, stage, params: genParams } = (body ?? {}) as {
      kind?: unknown;
      prompt?: unknown;
      stage?: unknown;
      params?: unknown;
    };

    if (!isValidKind(kind)) {
      return NextResponse.json(
        {
          error: `Campo 'kind' inválido. Valores aceitos: ${VALID_KINDS.join(', ')}.`,
        },
        { status: 400 }
      );
    }

    if (typeof prompt !== 'string' || prompt.trim().length === 0) {
      return NextResponse.json(
        { error: "Campo 'prompt' é obrigatório." },
        { status: 400 }
      );
    }

    if (
      stage !== undefined &&
      (typeof stage !== 'number' || !Number.isInteger(stage))
    ) {
      return NextResponse.json(
        { error: "Campo 'stage' deve ser um número inteiro." },
        { status: 400 }
      );
    }

    if (
      genParams !== undefined &&
      (typeof genParams !== 'object' ||
        genParams === null ||
        Array.isArray(genParams))
    ) {
      return NextResponse.json(
        { error: "Campo 'params' deve ser um objeto." },
        { status: 400 }
      );
    }

    try {
      const auth = await authorizeProject(id, userId);
      if (auth instanceof NextResponse) {
        return auth;
      }

      const job = await addAIGenerationJob({
        userId: userId!,
        projectId: id,
        stage: typeof stage === 'number' ? stage : auth.currentStage,
        kind,
        prompt,
        params: genParams as Record<string, unknown> | undefined,
      });

      // 202 Accepted: o trabalho foi aceito e será processado pela fila.
      return NextResponse.json(
        {
          jobId: job.id,
          status: 'queued',
          message:
            'Geração enfileirada. Consulte o status em GET ?jobId= (o progresso em tempo real chega na Etapa 7).',
        },
        { status: 202 }
      );
    } catch (error) {
      // Erro típico aqui: Redis indisponível ao enfileirar.
      console.error('Erro ao enfileirar geração de conteúdo:', error);
      return NextResponse.json(
        {
          error:
            'Não foi possível enfileirar a geração. Verifique se o Redis está disponível.',
        },
        { status: 503 }
      );
    }
  });
}

/**
 * GET /api/projects/:id/generate?jobId=<id>
 * Retorna o status do job de geração (polling). SSE fica para a Etapa 7.
 */
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

    try {
      const auth = await authorizeProject(id, userId);
      if (auth instanceof NextResponse) {
        return auth;
      }

      const status = await getAIGenerationJob(jobId);
      if (!status) {
        return NextResponse.json(
          { error: 'Job não encontrado.' },
          { status: 404 }
        );
      }

      return NextResponse.json(status);
    } catch (error) {
      console.error('Erro ao consultar status da geração:', error);
      return NextResponse.json(
        {
          error:
            'Não foi possível consultar o status. Verifique se o Redis está disponível.',
        },
        { status: 503 }
      );
    }
  });
}
