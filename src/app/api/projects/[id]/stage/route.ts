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
  mergeDecisions,
  nextStage,
  previousStage,
  readFlowState,
  recordStageEntry,
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

      // Atualiza o estado do fluxo (decisões + histórico de etapas).
      let flowState = readFlowState(project.outputData);
      flowState = mergeDecisions(flowState, decisions);
      if (toStage !== fromStage) {
        flowState = recordStageEntry(flowState, toStage);
      }

      const updated = await prisma.$transaction(
        async (tx: Prisma.TransactionClient) => {
          const result = await tx.project.update({
            where: { id },
            data: {
              currentStage: toStage,
              outputData: flowState as unknown as Prisma.InputJsonValue,
            },
            select: {
              id: true,
              currentStage: true,
              outputData: true,
            },
          });

          if (toStage !== fromStage) {
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

          return result;
        }
      );

      return NextResponse.json(
        buildStatePayload(updated.currentStage, readFlowState(updated.outputData))
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
