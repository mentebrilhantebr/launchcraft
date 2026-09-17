/**
 * Cliente Prisma - Singleton Pattern
 * 
 * Gerencia conexão com PostgreSQL via Prisma ORM
 * Usa driver adapter (Prisma 7 requirement)
 * 
 * @module database/client
 */

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

// Tipos globais para TypeScript
declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
}

/**
 * Cria instância do Prisma Client com adapter
 */
function createPrismaClient() {
  // Prisma 7 requer driver adapter
  const connectionString = process.env.DATABASE_URL;
  
  if (!connectionString) {
    // Durante build sem DATABASE_URL, retornar client sem adapter
    // (apenas para compilação, não será usado em runtime)
    console.warn('⚠️ DATABASE_URL não configurado - Prisma Client em modo de build');
    return new PrismaClient({
      log: ['error'],
    }) as any;
  }

  // Criar pool de conexões do PostgreSQL
  const pool = new Pool({ connectionString });
  
  // Criar adapter
  const adapter = new PrismaPg(pool);

  // Criar Prisma Client com adapter
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' 
      ? ['query', 'error', 'warn'] 
      : ['error'],
  });
}

/**
 * Instância única do Prisma Client (singleton)
 * Em desenvolvimento, reutiliza a instância global para evitar múltiplas conexões
 * Em produção, cria nova instância a cada deploy
 */
export const prisma = global.prisma || createPrismaClient();

// Em desenvolvimento, armazena na variável global para Hot Module Replacement
if (process.env.NODE_ENV !== 'production') {
  global.prisma = prisma;
}

/**
 * Desconecta do banco de dados
 * Útil para testes e graceful shutdown
 */
export async function disconnect() {
  await prisma.$disconnect();
}

/**
 * Conecta ao banco e testa a conexão
 * @throws {Error} Se não conseguir conectar
 */
export async function connect() {
  try {
    await prisma.$connect();
    console.log('✅ Conectado ao PostgreSQL');
  } catch (error) {
    console.error('❌ Erro ao conectar ao PostgreSQL:', error);
    throw error;
  }
}

/**
 * Verifica se o banco está acessível
 * @returns {Promise<boolean>} true se conectado
 */
export async function healthCheck(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch (error) {
    console.error('Health check falhou:', error);
    return false;
  }
}

// Exporta tipos do Prisma para uso em toda aplicação
export * from '@prisma/client';
