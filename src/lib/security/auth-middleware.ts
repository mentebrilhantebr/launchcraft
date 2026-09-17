/**
 * Middleware de Autenticação
 * 
 * Valida JWT e protege rotas
 * 
 * @module security/auth-middleware
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken, type JWTPayload } from './jwt';

/**
 * Request com usuário autenticado
 */
export interface AuthenticatedRequest extends NextRequest {
  user?: JWTPayload;
}

/**
 * Resultado da autenticação
 */
export interface AuthResult {
  isAuthenticated: boolean;
  user?: JWTPayload;
  error?: string;
}

/**
 * Extrai e valida token do header Authorization
 * 
 * @param request - Request do Next.js
 * @returns Resultado da autenticação
 * 
 * @example
 * const auth = await authenticateRequest(request);
 * if (!auth.isAuthenticated) {
 *   return NextResponse.json({ error: auth.error }, { status: 401 });
 * }
 */
export function authenticateRequest(request: NextRequest): AuthResult {
  try {
    // Obter token do header Authorization
    const authHeader = request.headers.get('authorization');
    
    if (!authHeader) {
      return {
        isAuthenticated: false,
        error: 'Token de autenticação não fornecido',
      };
    }

    // Extrair token (formato: "Bearer <token>")
    const token = authHeader.replace('Bearer ', '');
    
    if (!token) {
      return {
        isAuthenticated: false,
        error: 'Token inválido',
      };
    }

    // Validar token
    const validation = verifyAccessToken(token);
    
    if (!validation.isValid || !validation.payload) {
      return {
        isAuthenticated: false,
        error: validation.error || 'Token inválido',
      };
    }

    return {
      isAuthenticated: true,
      user: validation.payload,
    };
  } catch (error) {
    return {
      isAuthenticated: false,
      error: 'Erro ao validar autenticação',
    };
  }
}

/**
 * Middleware de autenticação obrigatória
 * 
 * Retorna erro 401 se não autenticado
 * 
 * @param request - Request do Next.js
 * @param handler - Handler da rota a executar se autenticado
 * @returns Response do handler ou erro 401
 * 
 * @example
 * // Em uma API route
 * export async function GET(request: NextRequest) {
 *   return withAuth(request, async (req) => {
 *     const user = req.user; // Usuário autenticado
 *     // ... lógica da rota
 *   });
 * }
 */
export async function withAuth(
  request: NextRequest,
  handler: (req: AuthenticatedRequest) => Promise<NextResponse>
): Promise<NextResponse> {
  const auth = authenticateRequest(request);

  if (!auth.isAuthenticated) {
    return NextResponse.json(
      { error: auth.error || 'Não autenticado' },
      { status: 401 }
    );
  }

  // Adicionar user ao request
  const authenticatedRequest = request as AuthenticatedRequest;
  authenticatedRequest.user = auth.user;

  return handler(authenticatedRequest);
}

/**
 * Middleware de autenticação de admin
 * 
 * Retorna erro 403 se não for admin
 * 
 * @param request - Request do Next.js
 * @param handler - Handler da rota a executar se admin
 * @returns Response do handler ou erro 401/403
 * 
 * @example
 * // Em uma API route de admin
 * export async function DELETE(request: NextRequest) {
 *   return withAdminAuth(request, async (req) => {
 *     // Apenas admins chegam aqui
 *     // ... lógica da rota
 *   });
 * }
 */
export async function withAdminAuth(
  request: NextRequest,
  handler: (req: AuthenticatedRequest) => Promise<NextResponse>
): Promise<NextResponse> {
  const auth = authenticateRequest(request);

  if (!auth.isAuthenticated) {
    return NextResponse.json(
      { error: auth.error || 'Não autenticado' },
      { status: 401 }
    );
  }

  // Verificar se é admin
  if (auth.user?.role !== 'ADMIN') {
    return NextResponse.json(
      { error: 'Acesso negado. Apenas administradores.' },
      { status: 403 }
    );
  }

  // Adicionar user ao request
  const authenticatedRequest = request as AuthenticatedRequest;
  authenticatedRequest.user = auth.user;

  return handler(authenticatedRequest);
}

/**
 * Middleware de autenticação opcional
 * 
 * Não retorna erro se não autenticado, apenas adiciona user se disponível
 * 
 * @param request - Request do Next.js
 * @param handler - Handler da rota
 * @returns Response do handler
 * 
 * @example
 * // Rota pública que pode ter comportamento diferente se autenticado
 * export async function GET(request: NextRequest) {
 *   return withOptionalAuth(request, async (req) => {
 *     if (req.user) {
 *       // Usuário autenticado
 *     } else {
 *       // Usuário anônimo
 *     }
 *   });
 * }
 */
export async function withOptionalAuth(
  request: NextRequest,
  handler: (req: AuthenticatedRequest) => Promise<NextResponse>
): Promise<NextResponse> {
  const auth = authenticateRequest(request);

  const authenticatedRequest = request as AuthenticatedRequest;
  if (auth.isAuthenticated) {
    authenticatedRequest.user = auth.user;
  }

  return handler(authenticatedRequest);
}
