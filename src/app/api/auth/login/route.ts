/**
 * API Route: Login
 * 
 * POST /api/auth/login
 * 
 * Autentica usuário e retorna tokens JWT
 * 
 * @module api/auth/login
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/modules/database';
import { verifyPassword } from '@/lib/security';
import { generateTokens } from '@/lib/security';

/**
 * Login de usuário
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password } = body;

    // Validação de campos obrigatórios
    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email e senha são obrigatórios' },
        { status: 400 }
      );
    }

    // Buscar usuário por email
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      select: {
        id: true,
        email: true,
        passwordHash: true,
        name: true,
        role: true,
        emailVerified: true,
        plan: {
          select: {
            id: true,
            name: true,
            maxProjects: true,
          },
        },
      },
    });

    // Verificar se usuário existe
    if (!user) {
      return NextResponse.json(
        { error: 'Email ou senha incorretos' },
        { status: 401 }
      );
    }

    // Verificar senha
    const isPasswordValid = await verifyPassword(password, user.passwordHash);
    if (!isPasswordValid) {
      return NextResponse.json(
        { error: 'Email ou senha incorretos' },
        { status: 401 }
      );
    }

    // Registrar no histórico
    await prisma.history.create({
      data: {
        userId: user.id,
        action: 'user_login',
        metadata: {
          email: user.email,
          timestamp: new Date().toISOString(),
        },
      },
    });

    // Gerar tokens JWT
    const tokens = generateTokens({
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    // Remover passwordHash da resposta
    const { passwordHash, ...userWithoutPassword } = user;

    // Criar resposta com cookie httpOnly para refresh token
    const response = NextResponse.json(
      {
        message: 'Login realizado com sucesso',
        user: userWithoutPassword,
        accessToken: tokens.accessToken,
      },
      { status: 200 }
    );

    // Adicionar refresh token como cookie seguro
    response.cookies.set('refreshToken', tokens.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60, // 7 dias
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('Erro no login:', error);
    return NextResponse.json(
      { error: 'Erro ao realizar login' },
      { status: 500 }
    );
  }
}
