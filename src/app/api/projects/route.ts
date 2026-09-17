/**
 * API Route: Projetos
 *
 * GET  /api/projects  - lista projetos do usuário autenticado (paginação)
 * POST /api/projects  - cria novo projeto (+ primeira conversa vazia)
 *
 * @module api/projects
 */

import { NextRequest, NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/modules/database';
import { canCreateProject, withAuth } from '@/lib/security';

export const runtime = 'nodejs';

/**
 * GET /api/projects - lista paginada dos projetos do usuário.
 */
export async function GET(request: NextRequest) {
  return withAuth(request, async (req) => {
    const userId = req.user?.userId;
    if (!userId) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const page = Math.max(
      1,
      Number.parseInt(searchParams.get('page') ?? '1', 10) || 1
    );
    const limit = Math.min(
      50,
      Math.max(1, Number.parseInt(searchParams.get('limit') ?? '10', 10) || 10)
    );
    const skip = (page - 1) * limit;

    try {
      const [projects, total] = await Promise.all([
        prisma.project.findMany({
          where: { userId },
          orderBy: { updatedAt: 'desc' },
          skip,
          take: limit,
          select: {
            id: true,
            name: true,
            niche: true,
            status: true,
            currentStage: true,
            createdAt: true,
            updatedAt: true,
          },
        }),
        prisma.project.count({ where: { userId } }),
      ]);

      return NextResponse.json({
        projects,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      });
    } catch (error) {
      console.error('Erro ao listar projetos:', error);
      return NextResponse.json(
        { error: 'Erro ao listar projetos' },
        { status: 500 }
      );
    }
  });
}

/**
 * POST /api/projects - cria um novo projeto.
 * Body: { name: string, niche: string }
 */
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

    const { name, niche } = (body ?? {}) as { name?: string; niche?: string };

    if (!name || typeof name !== 'string' || name.trim() === '') {
      return NextResponse.json(
        { error: 'O nome do projeto é obrigatório' },
        { status: 400 }
      );
    }

    if (!niche || typeof niche !== 'string' || niche.trim() === '') {
      return NextResponse.json(
        { error: 'O nicho do projeto é obrigatório' },
        { status: 400 }
      );
    }

    // Verifica limite do plano.
    const allowed = await canCreateProject(userId);
    if (!allowed) {
      return NextResponse.json(
        {
          error:
            'Você atingiu o limite de projetos do seu plano. Faça upgrade para criar mais.',
        },
        { status: 403 }
      );
    }

    try {
      const project = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        const created = await tx.project.create({
          data: {
            userId,
            name: name.trim(),
            niche: niche.trim(),
            status: 'DRAFT',
            currentStage: 1,
          },
          select: {
            id: true,
            name: true,
            niche: true,
            status: true,
            currentStage: true,
            createdAt: true,
            updatedAt: true,
          },
        });

        // Primeira conversa vazia no estágio 1.
        await tx.conversation.create({
          data: {
            projectId: created.id,
            userId,
            stage: 1,
            messages: [],
          },
        });

        // Registro no histórico.
        await tx.history.create({
          data: {
            userId,
            projectId: created.id,
            action: 'project_created',
            metadata: { name: created.name, niche: created.niche },
          },
        });

        return created;
      });

      return NextResponse.json({ project }, { status: 201 });
    } catch (error) {
      console.error('Erro ao criar projeto:', error);
      return NextResponse.json(
        { error: 'Erro ao criar projeto' },
        { status: 500 }
      );
    }
  });
}
