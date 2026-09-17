/**
 * API Route: Projeto individual
 *
 * GET    /api/projects/:id  - detalhes do projeto (verifica ownership)
 * PATCH  /api/projects/:id  - atualiza projeto (name, status, current_stage, output_data)
 * DELETE /api/projects/:id  - deleta projeto (verifica ownership)
 *
 * @module api/projects/[id]
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/modules/database';
import { withAuth } from '@/lib/security';
import { TOTAL_STAGES } from '@/modules/ai-engine';

export const runtime = 'nodejs';

const VALID_STATUSES = ['DRAFT', 'IN_PROGRESS', 'COMPLETED', 'PUBLISHED'] as const;
type ProjectStatusValue = (typeof VALID_STATUSES)[number];

/**
 * GET /api/projects/:id
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
        include: {
          conversations: {
            orderBy: { createdAt: 'asc' },
            select: {
              id: true,
              stage: true,
              messages: true,
              createdAt: true,
              updatedAt: true,
            },
          },
        },
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

      return NextResponse.json({ project });
    } catch (error) {
      console.error('Erro ao buscar projeto:', error);
      return NextResponse.json(
        { error: 'Erro ao buscar projeto' },
        { status: 500 }
      );
    }
  });
}

/**
 * PATCH /api/projects/:id
 * Body: { name?, status?, currentStage?, outputData? }
 */
export async function PATCH(
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

    const { name, status, currentStage, outputData } = (body ?? {}) as {
      name?: string;
      status?: string;
      currentStage?: number;
      outputData?: unknown;
    };

    // Ownership check.
    try {
      const existing = await prisma.project.findUnique({
        where: { id },
        select: { userId: true },
      });

      if (!existing) {
        return NextResponse.json(
          { error: 'Projeto não encontrado' },
          { status: 404 }
        );
      }

      if (existing.userId !== userId) {
        return NextResponse.json(
          { error: 'Você não tem acesso a este projeto' },
          { status: 403 }
        );
      }

      // Build update payload with validation.
      const data: {
        name?: string;
        status?: ProjectStatusValue;
        currentStage?: number;
        outputData?: object | null;
      } = {};

      if (name !== undefined) {
        if (typeof name !== 'string' || name.trim() === '') {
          return NextResponse.json(
            { error: 'Nome inválido' },
            { status: 400 }
          );
        }
        data.name = name.trim();
      }

      if (status !== undefined) {
        if (!VALID_STATUSES.includes(status as ProjectStatusValue)) {
          return NextResponse.json(
            { error: 'Status inválido' },
            { status: 400 }
          );
        }
        data.status = status as ProjectStatusValue;
      }

      if (currentStage !== undefined) {
        if (
          typeof currentStage !== 'number' ||
          !Number.isInteger(currentStage) ||
          currentStage < 1 ||
          currentStage > TOTAL_STAGES
        ) {
          return NextResponse.json(
            { error: `O estágio deve estar entre 1 e ${TOTAL_STAGES}` },
            { status: 400 }
          );
        }
        data.currentStage = currentStage;
      }

      if (outputData !== undefined) {
        data.outputData =
          outputData === null ? null : (outputData as object);
      }

      if (Object.keys(data).length === 0) {
        return NextResponse.json(
          { error: 'Nenhum campo para atualizar' },
          { status: 400 }
        );
      }

      const updated = await prisma.project.update({
        where: { id },
        data,
        select: {
          id: true,
          name: true,
          niche: true,
          status: true,
          currentStage: true,
          outputData: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      return NextResponse.json({ project: updated });
    } catch (error) {
      console.error('Erro ao atualizar projeto:', error);
      return NextResponse.json(
        { error: 'Erro ao atualizar projeto' },
        { status: 500 }
      );
    }
  });
}

/**
 * DELETE /api/projects/:id
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(request, async (req) => {
    const userId = req.user?.userId;
    const { id } = await params;

    try {
      const existing = await prisma.project.findUnique({
        where: { id },
        select: { userId: true },
      });

      if (!existing) {
        return NextResponse.json(
          { error: 'Projeto não encontrado' },
          { status: 404 }
        );
      }

      if (existing.userId !== userId) {
        return NextResponse.json(
          { error: 'Você não tem acesso a este projeto' },
          { status: 403 }
        );
      }

      // Hard delete (cascata remove conversas, feedbacks, history relacionados).
      await prisma.project.delete({ where: { id } });

      return NextResponse.json({ message: 'Projeto removido com sucesso' });
    } catch (error) {
      console.error('Erro ao deletar projeto:', error);
      return NextResponse.json(
        { error: 'Erro ao deletar projeto' },
        { status: 500 }
      );
    }
  });
}
