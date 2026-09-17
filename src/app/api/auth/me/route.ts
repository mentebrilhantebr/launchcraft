/**
 * API Route: Usuário Atual
 * 
 * GET /api/auth/me
 * 
 * Retorna dados do usuário autenticado (requer autenticação)
 * 
 * @module api/auth/me
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/security';
import { getCurrentUser } from '@/lib/security';

/**
 * Obter dados do usuário autenticado
 */
export async function GET(request: NextRequest) {
  return withAuth(request, async (req) => {
    if (!req.user) {
      return NextResponse.json(
        { error: 'Usuário não encontrado' },
        { status: 404 }
      );
    }

    // Obter dados completos do usuário
    const user = await getCurrentUser(req.user);

    if (!user) {
      return NextResponse.json(
        { error: 'Usuário não encontrado' },
        { status: 404 }
      );
    }

    return NextResponse.json({ user }, { status: 200 });
  });
}
