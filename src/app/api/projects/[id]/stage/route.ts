/**
 * API Route: Navegação de etapas do fluxo de construção (Doc 04)
 *
 * GET  /api/projects/:id/stage  - estado atual do fluxo (etapa, metadados,
 *                                 decisões, histórico e o que é permitido)
 * POST /api/projects/:id/stage  - avança/volta uma etapa e/ou registra decisões
 *
 * Regras (Doc 04): o fluxo é sequencial — nunca pule etapas. Avançar move
 * exatamente uma etapa. Voltar é permitido (para ajustes). O estado guarda o
 * que foi DECIDIDO na conversa (bag flexível), nunca respostas de formulário.
 *
 * @module api/projects/[id]/stage
 */

import { NextRequest, NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/modules/database';
import { withAuth } from '@/lib/security';
import {
  FLOW_STAGES,
  TOTAL_STAGES,
  canAdvance,
  canGoBack,
  getStageMeta,
  isSequentialAdvance,
  nextStage,
  previousStage,
  readFlowState,
  type ProjectDecisions,
  type ProjectFlowState,
} from '@/modules/ai-engine';

export const runtime = 'nodejs';

/**
 * Serializa o estado do fluxo + metadados para a resposta.
 */
function buildStatePayload(currentStage: number, flowState: ProjectFlowState) {
  return {
    currentStage,
    totalStages: TOTAL_STAGES,
    stageMeta: getStageMeta(currentStage),
    canAdvance: canAdvance(currentStage),
    canGoBack: canGoBack(currentStage),
    flowState,
    allStages: FLOW_STAGES,
  };
}

/**
 * GET /api/projects/:id/stage
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(request, async (req) => {
    const userId = req.user?.userId;
    const { id } = await params;

    try {
      const project = await prisma.project.findUnique({
        where: { id },
        select: { userId: true, currentStage: true, outputData: true },
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

      const flowState = readFlowState(project.outputData);
      return NextResponse.json(
        buildStatePayload(project.currentStage, flowState)
      );
    } catch (error) {
      console.error('Erro ao buscar etapa do projeto:', error);
      return NextResponse.json(
        { error: 'Erro ao buscar a etapa do projeto' },
        { status: 500 }
      );
    }
  });
}

/**
 * POST /api/projects/:id/stage
 * Body: { action?: 'advance' | 'back', decisions?: Record<string, unknown> }
 *
 * - Se `decisions` vier, é mesclado ao estado (mesmo sem mudar de etapa).
 * - `action: 'advance'` avança exatamente uma etapa (sequencial).
 * - `action: 'back'` volta uma etapa.
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

    const { action, decisions } = (body ?? {}) as {
      action?: string;
      decisions?: ProjectDecisions;
    };

    if (action !== undefined && action !== 'advance' && action !== 'back') {
      return NextResponse.json(
        { error: "Ação inválida. Use 'advance' ou 'back'." },
        { status: 400 }
      );
    }

    if (
      decisions !== undefined &&
      (typeof decisions !== 'object' ||
        decisions === null ||
        Array.isArray(decisions))
    ) {
      return NextResponse.json(
        { error: 'O campo decisions deve ser um objeto.' },
        { status: 400 }
      );
    }

    if (action === undefined && decisions === undefined) {
      return NextResponse.json(
        { error: 'Nada para atualizar. Envie uma ação e/ou decisions.' },
        { status: 400 }
      );
    }

    try {
      const project = await prisma.project.findUnique({
        where: { id },
        select: { userId: true, currentStage: true, outputData: true },
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

      const fromStage = project.currentStage;
      let toStage = fromStage;

      if (action === 'advance') {
        const next = nextStage(fromStage);
        if (next === null || !isSequentialAdvance(fromStage, next)) {
          return NextResponse.json(
            {
              error: `Você já está na última etapa (${TOTAL_STAGES}) ou o avanço não é permitido. Não é possível pular etapas.`,
            },
            { status: 409 }
          );
        }
        toStage = next;
      } else if (action === 'back') {
        const prev = previousStage(fromStage);
        if (prev === null) {
          return NextResponse.json(
            { error: 'Você já está na primeira etapa.' },
            { status: 409 }
          );
        }
        toStage = prev;
      }

      // CONDIÇÃO DE CORRIDA (correção aprovada): nunca regravamos o outputData
      // inteiro. Gravamos APENAS a própria subchave com jsonb_set parametrizado,
      // de modo que um upload concorrente (que faz append em `uploads`) jamais é
      // sobrescrito. `current_stage` continua em atualização normal de coluna.
      // Sem trava de linha (SELECT ... FOR UPDATE), por decisão do usuário.
      const stageChanged = toStage !== fromStage;
      const hasDecisions =
        decisions !== undefined && Object.keys(decisions).length > 0;

      const updated = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        // 1) Mescla decisions na subchave {decisions} (|| entre objetos jsonb).
        if (hasDecisions) {
          await tx.$executeRaw`
            UPDATE projects
            SET output_data = jsonb_set(
                  COALESCE(output_data, '{}'::jsonb),
                  '{decisions}',
                  COALESCE(output_data -> 'decisions', '{}'::jsonb) || ${JSON.stringify(
                    decisions
                  )}::jsonb,
                  true
                ),
                updated_at = now()
            WHERE id = ${id}::uuid AND user_id = ${userId}::uuid
          `;
        }

        // 2) Mudança de etapa: atualiza current_stage + append em {stageHistory}.
        if (stageChanged) {
          const entry = { stage: toStage, enteredAt: new Date().toISOString() };
          await tx.$executeRaw`
            UPDATE projects
            SET current_stage = ${toStage},
                output_data = jsonb_set(
                  COALESCE(output_data, '{}'::jsonb),
                  '{stageHistory}',
                  COALESCE(output_data -> 'stageHistory', '[]'::jsonb) || ${JSON.stringify(
                    [entry]
                  )}::jsonb,
                  true
                ),
                updated_at = now()
            WHERE id = ${id}::uuid AND user_id = ${userId}::uuid
          `;

          await tx.history.create({
            data: {
              userId: userId!,
              projectId: id,
              action:
                action === 'advance' ? 'stage_advanced' : 'stage_reverted',
              metadata: { fromStage, toStage },
            },
          });
        }

        // 3) Lê o estado final já consolidado para a resposta.
        return tx.project.findUnique({
          where: { id },
          select: { currentStage: true, outputData: true },
        });
      });

      return NextResponse.json(
        buildStatePayload(
          updated?.currentStage ?? toStage,
          readFlowState(updated?.outputData)
        )
      );
    } catch (error) {
      console.error('Erro ao atualizar etapa do projeto:', error);
      return NextResponse.json(
        { error: 'Erro ao atualizar a etapa do projeto' },
        { status: 500 }
      );
    }
  });
}
