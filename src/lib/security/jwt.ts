/**
 * Utilitários de JWT (JSON Web Tokens)
 * 
 * Gerencia geração e validação de access tokens e refresh tokens
 * 
 * @module security/jwt
 */

import jwt from 'jsonwebtoken';
import type { UserRole } from '@prisma/client';

/**
 * Payload do JWT
 */
export interface JWTPayload {
  userId: string;
  email: string;
  role: UserRole;
}

/**
 * Resultado da validação do JWT
 */
export interface JWTValidationResult {
  isValid: boolean;
  payload?: JWTPayload;
  error?: string;
}

// Secrets (devem estar no .env)
const ACCESS_TOKEN_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';
const REFRESH_TOKEN_SECRET = process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret-change-in-production';

// Duração dos tokens
const ACCESS_TOKEN_EXPIRES_IN = '15m'; // 15 minutos
const REFRESH_TOKEN_EXPIRES_IN = '7d'; // 7 dias

/**
 * Gera access token (curta duração)
 * 
 * @param payload - Dados do usuário
 * @returns JWT access token
 * 
 * @example
 * const token = generateAccessToken({
 *   userId: user.id,
 *   email: user.email,
 *   role: user.role,
 * });
 */
export function generateAccessToken(payload: JWTPayload): string {
  return jwt.sign(payload, ACCESS_TOKEN_SECRET, {
    expiresIn: ACCESS_TOKEN_EXPIRES_IN,
  });
}

/**
 * Gera refresh token (longa duração)
 * 
 * @param payload - Dados do usuário
 * @returns JWT refresh token
 * 
 * @example
 * const refreshToken = generateRefreshToken({
 *   userId: user.id,
 *   email: user.email,
 *   role: user.role,
 * });
 */
export function generateRefreshToken(payload: JWTPayload): string {
  return jwt.sign(payload, REFRESH_TOKEN_SECRET, {
    expiresIn: REFRESH_TOKEN_EXPIRES_IN,
  });
}

/**
 * Gera ambos os tokens de uma vez
 * 
 * @param payload - Dados do usuário
 * @returns Objeto com accessToken e refreshToken
 */
export function generateTokens(payload: JWTPayload): {
  accessToken: string;
  refreshToken: string;
} {
  return {
    accessToken: generateAccessToken(payload),
    refreshToken: generateRefreshToken(payload),
  };
}

/**
 * Valida access token
 * 
 * @param token - JWT access token
 * @returns Resultado da validação com payload ou erro
 * 
 * @example
 * const result = verifyAccessToken(token);
 * if (result.isValid) {
 *   console.log('User ID:', result.payload.userId);
 * } else {
 *   console.error('Error:', result.error);
 * }
 */
export function verifyAccessToken(token: string): JWTValidationResult {
  try {
    const payload = jwt.verify(token, ACCESS_TOKEN_SECRET) as JWTPayload;
    return {
      isValid: true,
      payload,
    };
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      return {
        isValid: false,
        error: 'Token expirado',
      };
    }
    if (error instanceof jwt.JsonWebTokenError) {
      return {
        isValid: false,
        error: 'Token inválido',
      };
    }
    return {
      isValid: false,
      error: 'Erro ao validar token',
    };
  }
}

/**
 * Valida refresh token
 * 
 * @param token - JWT refresh token
 * @returns Resultado da validação com payload ou erro
 */
export function verifyRefreshToken(token: string): JWTValidationResult {
  try {
    const payload = jwt.verify(token, REFRESH_TOKEN_SECRET) as JWTPayload;
    return {
      isValid: true,
      payload,
    };
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      return {
        isValid: false,
        error: 'Refresh token expirado',
      };
    }
    if (error instanceof jwt.JsonWebTokenError) {
      return {
        isValid: false,
        error: 'Refresh token inválido',
      };
    }
    return {
      isValid: false,
      error: 'Erro ao validar refresh token',
    };
  }
}

/**
 * Decodifica token sem validar (útil para debug)
 * 
 * @param token - JWT token
 * @returns Payload decodificado ou null
 */
export function decodeToken(token: string): JWTPayload | null {
  try {
    return jwt.decode(token) as JWTPayload;
  } catch {
    return null;
  }
}
