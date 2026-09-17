/**
 * Utilitário para Obter Usuário Atual
 * 
 * Obtém dados completos do usuário autenticado
 * 
 * @module security/get-current-user
 */

import { prisma } from '@/modules/database';
import type { JWTPayload } from './jwt';

/**
 * Dados completos do usuário autenticado
 */
export interface CurrentUser {
  id: string;
  email: string;
  name: string;
  role: 'USER' | 'ADMIN';
  emailVerified: boolean;
  createdAt: Date;
  plan: {
    id: string;
    name: string;
    maxProjects: number | null;
  } | null;
}

/**
 * Obtém dados completos do usuário autenticado
 * 
 * @param jwtPayload - Payload do JWT (obtido do middleware)
 * @returns Dados completos do usuário ou null
 * 
 * @example
 * // Em uma API route com middleware
 * const auth = authenticateRequest(request);
 * if (auth.isAuthenticated && auth.user) {
 *   const user = await getCurrentUser(auth.user);
 *   console.log(user.name);
 * }
 */
export async function getCurrentUser(
  jwtPayload: JWTPayload
): Promise<CurrentUser | null> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: jwtPayload.userId },
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

    return user;
  } catch (error) {
    console.error('Erro ao obter usuário atual:', error);
    return null;
  }
}

/**
 * Verifica se usuário pode criar mais projetos
 * 
 * @param userId - ID do usuário
 * @returns true se pode criar mais projetos
 */
export async function canCreateProject(userId: string): Promise<boolean> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        plan: {
          select: {
            maxProjects: true,
          },
        },
        projects: {
          select: {
            id: true,
          },
        },
      },
    });

    if (!user) return false;

    // Se maxProjects é null, é ilimitado
    if (user.plan?.maxProjects === null) return true;

    // Verificar se não atingiu o limite
    const projectCount = user.projects.length;
    const maxProjects = user.plan?.maxProjects || 0;

    return projectCount < maxProjects;
  } catch (error) {
    console.error('Erro ao verificar limite de projetos:', error);
    return false;
  }
}
