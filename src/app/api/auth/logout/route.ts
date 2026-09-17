/**
 * API Route: Logout
 * 
 * POST /api/auth/logout
 * 
 * Remove refresh token e invalida sessão
 * 
 * @module api/auth/logout
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/modules/database';
import { verifyAccessToken } from '@/lib/security';

/**
 * Logout de usuário
 */
export async function POST(request: NextRequest) {
  try {
    // Obter access token do header
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');

    // Se tiver token válido, registrar logout no histórico
    if (token) {
      const validation = verifyAccessToken(token);
      if (validation.isValid && validation.payload) {
        await prisma.history.create({
          data: {
            userId: validation.payload.userId,
            action: 'user_logout',
            metadata: {
              email: validation.payload.email,
              timestamp: new Date().toISOString(),
            },
          },
        });
      }
    }

    // Criar resposta
    const response = NextResponse.json(
      { message: 'Logout realizado com sucesso' },
      { status: 200 }
    );

    // Remover refresh token do cookie
    response.cookies.set('refreshToken', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 0, // Expira imediatamente
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('Erro no logout:', error);
    return NextResponse.json(
      { error: 'Erro ao realizar logout' },
      { status: 500 }
    );
  }
}
