/**
 * Módulo Database
 * 
 * Exporta cliente Prisma e utilitários de conexão
 * 
 * @module database
 */

export { prisma, connect, disconnect, healthCheck } from './client';
export * from '@prisma/client';
