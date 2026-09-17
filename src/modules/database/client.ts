/**
 * Cliente Prisma - Singleton Pattern
 * 
 * Gerencia conexão com PostgreSQL via Prisma ORM
 * Compatível com PgBouncer (connection pooling)
 * 
 * @module database/client
 */

import { PrismaClient } from '@prisma/client';

// Tipos globais para TypeScript
declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
}

/**
 * Instância única do Prisma Client
 * Em desenvolvimento, reutiliza a instância global para evitar múltiplas conexões
 * Em produção, cria nova instância a cada deploy
 * 
 * NOTA: Para usar PgBouncer em produção, será necessário instanciar com driver adapter:
 * 
 * ```typescript
 * import { PrismaPg } from '@prisma/adapter-pg';
 * const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
 * const prisma = new PrismaClient({ adapter });
 * ```
 * 
 * Isso será implementado quando deployar em produção (pós-MVP).
 */
export const prisma = global.prisma || new PrismaClient({
  log: process.env.NODE_ENV === 'development' 
    ? ['query', 'error', 'warn'] 
    : ['error'],
});

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
