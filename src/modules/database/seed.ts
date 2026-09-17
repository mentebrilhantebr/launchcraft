/**
 * Script de Seed - Dados Iniciais
 * 
 * Popula o banco com dados iniciais necessários para o MVP
 * 
 * Uso: npm run db:seed
 */

import { prisma } from './client';

async function seed() {
  console.log('🌱 Iniciando seed do banco de dados...\n');

  try {
    // 1. Criar Planos
    console.log('1️⃣ Criando planos...');
    
    const planoGratuito = await prisma.plan.upsert({
      where: { id: '00000000-0000-0000-0000-000000000001' },
      update: {},
      create: {
        id: '00000000-0000-0000-0000-000000000001',
        name: 'Gratuito',
        priceCents: 0,
        features: [
          'Até 3 projetos simultâneos',
          'IA para estruturação de curso',
          'IA para página de vendas',
          'Templates básicos',
          'Suporte por email',
        ],
        maxProjects: 3,
        isActive: true,
      },
    });
    console.log(`   ✅ Plano criado: ${planoGratuito.name}`);

    // Plano Pro (para quando implementar pagamentos na Etapa 10)
    const planoPro = await prisma.plan.upsert({
      where: { id: '00000000-0000-0000-0000-000000000002' },
      update: {},
      create: {
        id: '00000000-0000-0000-0000-000000000002',
        name: 'Pro',
        priceCents: 9900, // R$ 99,00
        stripePriceId: null, // Será configurado na Etapa 10
        features: [
          'Projetos ilimitados',
          'IA avançada para criação de conteúdo',
          'Templates premium',
          'Pré-visualização em tempo real',
          'Editor avançado',
          'Suporte prioritário',
          'Exportação em múltiplos formatos',
        ],
        maxProjects: null, // Ilimitado
        isActive: false, // Desativado até Etapa 10
      },
    });
    console.log(`   ✅ Plano criado: ${planoPro.name} (inativo)\n`);

    // 2. Criar Configurações Globais
    console.log('2️⃣ Criando configurações globais...');
    
    await prisma.configuration.upsert({
      where: { key: 'app.name' },
      update: {},
      create: {
        key: 'app.name',
        value: 'LaunchCraft',
        scope: 'GLOBAL',
        description: 'Nome do aplicativo',
      },
    });
    
    await prisma.configuration.upsert({
      where: { key: 'app.version' },
      update: {},
      create: {
        key: 'app.version',
        value: '1.0.0-mvp',
        scope: 'GLOBAL',
        description: 'Versão atual do aplicativo',
      },
    });

    await prisma.configuration.upsert({
      where: { key: 'features.registration' },
      update: {},
      create: {
        key: 'features.registration',
        value: true,
        scope: 'GLOBAL',
        description: 'Permitir novos cadastros',
      },
    });

    console.log('   ✅ Configurações globais criadas\n');

    // 3. Criar Templates Básicos
    console.log('3️⃣ Criando templates básicos...');
    
    await prisma.template.upsert({
      where: { id: '00000000-0000-0000-0000-000000000101' },
      update: {},
      create: {
        id: '00000000-0000-0000-0000-000000000101',
        name: 'Página de Vendas - Padrão',
        category: 'página de vendas',
        niche: null, // Genérico
        content: {
          sections: [
            'hero',
            'problema',
            'solucao',
            'beneficios',
            'depoimentos',
            'preco',
            'garantia',
            'faq',
            'cta'
          ],
          style: 'moderno',
        },
        isActive: true,
      },
    });

    await prisma.template.upsert({
      where: { id: '00000000-0000-0000-0000-000000000102' },
      update: {},
      create: {
        id: '00000000-0000-0000-0000-000000000102',
        name: 'Estrutura de Curso - Básica',
        category: 'estrutura de curso',
        niche: null, // Genérico
        content: {
          format: 'modulos-e-aulas',
          structure: [
            { modulo: 1, nome: 'Introdução', aulas: 3 },
            { modulo: 2, nome: 'Fundamentos', aulas: 5 },
            { modulo: 3, nome: 'Prática', aulas: 5 },
            { modulo: 4, nome: 'Avançado', aulas: 4 },
            { modulo: 5, nome: 'Conclusão', aulas: 2 },
          ],
        },
        isActive: true,
      },
    });

    console.log('   ✅ Templates básicos criados\n');

    console.log('✅ Seed concluído com sucesso!\n');
    console.log('📊 Resumo:');
    console.log(`   - Planos: 2 (1 ativo)`);
    console.log(`   - Configurações: 3`);
    console.log(`   - Templates: 2\n`);

  } catch (error) {
    console.error('❌ Erro durante o seed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Executar seed
seed()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
