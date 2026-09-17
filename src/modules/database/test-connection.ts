/**
 * Script de Teste de Conexão ao Banco
 * 
 * Verifica se o PostgreSQL está acessível e se o schema está correto
 * 
 * Uso: npx tsx src/modules/database/test-connection.ts
 */

import { prisma, connect, disconnect, healthCheck } from './client';

async function testConnection() {
  console.log('🧪 Testando conexão com PostgreSQL...\n');

  try {
    // Teste 1: Conectar
    console.log('1️⃣ Conectando ao banco...');
    await connect();

    // Teste 2: Health check
    console.log('2️⃣ Verificando saúde da conexão...');
    const isHealthy = await healthCheck();
    if (!isHealthy) {
      throw new Error('Health check falhou');
    }
    console.log('✅ Health check OK\n');

    // Teste 3: Verificar tabelas
    console.log('3️⃣ Verificando schema (tabelas esperadas)...');
    const tables = await prisma.$queryRaw<Array<{ tablename: string }>>`
      SELECT tablename 
      FROM pg_tables 
      WHERE schemaname = 'public'
      ORDER BY tablename;
    `;
    
    const expectedTables = [
      'configurations',
      'conversations',
      'feedbacks',
      'history',
      'plans',
      'projects',
      'templates',
      'users',
    ];

    const tableNames = tables.map((t: { tablename: string }) => t.tablename);
    const missingTables = expectedTables.filter((t: string) => !tableNames.includes(t));
    const extraTables = tableNames.filter((t: string) => !expectedTables.includes(t) && !t.startsWith('_'));

    console.log(`   Tabelas encontradas: ${tableNames.length}`);
    tableNames.forEach((name: string) => console.log(`   - ${name}`));

    if (missingTables.length > 0) {
      console.log('\n⚠️  Tabelas faltando:', missingTables);
      console.log('   Execute: npx prisma migrate deploy');
    }

    if (extraTables.length > 0) {
      console.log('\n⚠️  Tabelas extras (não esperadas):', extraTables);
    }

    if (missingTables.length === 0 && extraTables.length === 0) {
      console.log('\n✅ Schema OK - todas as 8 tabelas presentes\n');
    }

    // Teste 4: Verificar se pode executar queries básicas
    console.log('4️⃣ Testando query básica...');
    const planCount = await prisma.plan.count();
    console.log(`   Planos cadastrados: ${planCount}`);
    
    const userCount = await prisma.user.count();
    console.log(`   Usuários cadastrados: ${userCount}\n`);

    console.log('✅ Todos os testes passaram!\n');
    console.log('📊 Resumo:');
    console.log(`   - Conexão: OK`);
    console.log(`   - Health check: OK`);
    console.log(`   - Schema: ${missingTables.length === 0 ? 'OK' : 'PENDENTE'}`);
    console.log(`   - Queries: OK\n`);

  } catch (error) {
    console.error('\n❌ Erro durante os testes:');
    if (error instanceof Error) {
      console.error(`   ${error.message}`);
      
      // Mensagens específicas de erro
      if (error.message.includes('connect')) {
        console.error('\n💡 Dica: Certifique-se de que o PostgreSQL está rodando');
        console.error('   docker-compose up -d postgres');
      } else if (error.message.includes('does not exist')) {
        console.error('\n💡 Dica: Execute as migrations primeiro');
        console.error('   npx prisma migrate deploy');
      }
    } else {
      console.error(error);
    }
    process.exit(1);
  } finally {
    // Desconectar
    await disconnect();
    console.log('🔌 Desconectado do banco');
  }
}

// Executar testes
testConnection();
