/**
 * API Route: Cadastro de Usuário
 * 
 * POST /api/auth/signup
 * 
 * Cria novo usuário no sistema com validação de dados
 * 
 * @module api/auth/signup
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/modules/database';
import { hashPassword, validatePasswordStrength } from '@/lib/security';
import { generateTokens } from '@/lib/security';

/**
 * Cadastro de novo usuário
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password, name } = body;

    // Validação de campos obrigatórios
    if (!email || !password || !name) {
      return NextResponse.json(
        { error: 'Email, senha e nome são obrigatórios' },
        { status: 400 }
      );
    }

    // Validação de email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Email inválido' },
        { status: 400 }
      );
    }

    // Validação de força da senha
    const passwordValidation = validatePasswordStrength(password);
    if (!passwordValidation.isValid) {
      return NextResponse.json(
        { error: passwordValidation.error },
        { status: 400 }
      );
    }

    // Verificar se email já existe
    const existingUser = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: 'Email já cadastrado' },
        { status: 409 }
      );
    }

    // Buscar plano gratuito padrão
    const freePlan = await prisma.plan.findFirst({
      where: {
        priceCents: 0,
        isActive: true,
      },
    });

    // Hash da senha
    const passwordHash = await hashPassword(password);

    // Criar usuário
    const user = await prisma.user.create({
      data: {
        email: email.toLowerCase(),
        passwordHash,
        name,
        role: 'USER',
        planId: freePlan?.id || null,
        emailVerified: false, // Será implementado verificação por email depois
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        emailVerified: true,
        createdAt: true,
        plan: {
          select: {
            id: true,
            name: true,
            maxProjects: true,
          },
        },
      },
    });

    // Registrar no histórico
    await prisma.history.create({
      data: {
        userId: user.id,
        action: 'user_registered',
        metadata: {
          email: user.email,
          method: 'email_password',
        },
      },
    });

    // Gerar tokens JWT
    const tokens = generateTokens({
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    // Criar resposta com cookie httpOnly para refresh token
    const response = NextResponse.json(
      {
        message: 'Cadastro realizado com sucesso',
        user,
        accessToken: tokens.accessToken,
      },
      { status: 201 }
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
    console.error('Erro no cadastro:', error);
    return NextResponse.json(
      { error: 'Erro ao criar usuário' },
      { status: 500 }
    );
  }
}
