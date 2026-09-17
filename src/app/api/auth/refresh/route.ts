/**
 * API Route: Refresh Token
 * 
 * POST /api/auth/refresh
 * 
 * Renova access token usando refresh token do cookie
 * 
 * @module api/auth/refresh
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyRefreshToken, generateTokens } from '@/lib/security';
import { prisma } from '@/modules/database';

/**
 * Renovar access token
 */
export async function POST(request: NextRequest) {
  try {
    // Obter refresh token do cookie
    const refreshToken = request.cookies.get('refreshToken')?.value;

    if (!refreshToken) {
      return NextResponse.json(
        { error: 'Refresh token não encontrado' },
        { status: 401 }
      );
    }

    // Validar refresh token
    const validation = verifyRefreshToken(refreshToken);
    if (!validation.isValid || !validation.payload) {
      return NextResponse.json(
        { error: validation.error || 'Refresh token inválido' },
        { status: 401 }
      );
    }

    // Verificar se usuário ainda existe e está ativo
    const user = await prisma.user.findUnique({
      where: { id: validation.payload.userId },
      select: {
        id: true,
        email: true,
        role: true,
        plan: {
          select: {
            id: true,
            name: true,
            maxProjects: true,
          },
        },
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'Usuário não encontrado' },
        { status: 401 }
      );
    }

    // Gerar novos tokens
    const tokens = generateTokens({
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    // Criar resposta com novo access token
    const response = NextResponse.json(
      {
        message: 'Token renovado com sucesso',
        accessToken: tokens.accessToken,
        user,
      },
      { status: 200 }
    );

    // Atualizar refresh token no cookie (refresh token rotation)
    response.cookies.set('refreshToken', tokens.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60, // 7 dias
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('Erro ao renovar token:', error);
    return NextResponse.json(
      { error: 'Erro ao renovar token' },
      { status: 500 }
    );
  }
}
