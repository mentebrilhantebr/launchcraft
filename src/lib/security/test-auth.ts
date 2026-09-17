/**
 * Script de Teste de Autenticação
 * 
 * Testa todos os fluxos de autenticação
 * 
 * Uso: npx tsx src/lib/security/test-auth.ts
 */

import { hashPassword, verifyPassword, validatePasswordStrength } from './hash';
import { generateTokens, verifyAccessToken, verifyRefreshToken } from './jwt';

async function testAuth() {
  console.log('🧪 Testando Autenticação...\n');

  let testsPassed = 0;
  let testsFailed = 0;

  // ============================================
  // Teste 1: Hash de Senha
  // ============================================
  console.log('1️⃣ Testando hash de senha...');
  try {
    const password = 'MinhaSenh@123';
    const hash = await hashPassword(password);
    
    console.log(`   Senha: ${password}`);
    console.log(`   Hash: ${hash.substring(0, 20)}...`);
    
    // Verificar senha correta
    const isValid = await verifyPassword(password, hash);
    if (!isValid) {
      throw new Error('Senha válida não foi reconhecida');
    }
    
    // Verificar senha incorreta
    const isInvalid = await verifyPassword('SenhaErrada', hash);
    if (isInvalid) {
      throw new Error('Senha inválida foi aceita');
    }
    
    console.log('   ✅ Hash funcionando corretamente\n');
    testsPassed++;
  } catch (error) {
    console.error('   ❌ Erro:', error instanceof Error ? error.message : error);
    testsFailed++;
  }

  // ============================================
  // Teste 2: Validação de Força de Senha
  // ============================================
  console.log('2️⃣ Testando validação de força de senha...');
  try {
    const tests = [
      { password: '123', shouldFail: true, reason: 'muito curta' },
      { password: 'senhafraca', shouldFail: true, reason: 'sem maiúscula, número e especial' },
      { password: 'SenhaFraca', shouldFail: true, reason: 'sem número e especial' },
      { password: 'SenhaFraca1', shouldFail: true, reason: 'sem especial' },
      { password: 'Senh@Fr4ca', shouldFail: false, reason: 'válida' },
    ];

    for (const test of tests) {
      const result = validatePasswordStrength(test.password);
      if (test.shouldFail && result.isValid) {
        throw new Error(`Senha "${test.password}" (${test.reason}) foi aceita incorretamente`);
      }
      if (!test.shouldFail && !result.isValid) {
        throw new Error(`Senha "${test.password}" (${test.reason}) foi rejeitada: ${result.error}`);
      }
      console.log(`   ${test.shouldFail ? '❌' : '✅'} "${test.password}" - ${test.reason}`);
    }
    
    console.log('   ✅ Validação funcionando corretamente\n');
    testsPassed++;
  } catch (error) {
    console.error('   ❌ Erro:', error instanceof Error ? error.message : error);
    testsFailed++;
  }

  // ============================================
  // Teste 3: JWT - Access Token
  // ============================================
  console.log('3️⃣ Testando JWT access token...');
  try {
    const payload = {
      userId: '123e4567-e89b-12d3-a456-426614174000',
      email: 'teste@exemplo.com',
      role: 'USER' as const,
    };

    const accessToken = generateTokens(payload).accessToken;
    console.log(`   Token: ${accessToken.substring(0, 30)}...`);

    // Verificar token válido
    const validation = verifyAccessToken(accessToken);
    if (!validation.isValid || !validation.payload) {
      throw new Error('Token válido não foi reconhecido');
    }

    if (validation.payload.userId !== payload.userId) {
      throw new Error('Payload do token não corresponde');
    }

    // Token inválido
    const invalidValidation = verifyAccessToken('token.invalido.aqui');
    if (invalidValidation.isValid) {
      throw new Error('Token inválido foi aceito');
    }

    console.log('   ✅ Access token funcionando corretamente\n');
    testsPassed++;
  } catch (error) {
    console.error('   ❌ Erro:', error instanceof Error ? error.message : error);
    testsFailed++;
  }

  // ============================================
  // Teste 4: JWT - Refresh Token
  // ============================================
  console.log('4️⃣ Testando JWT refresh token...');
  try {
    const payload = {
      userId: '123e4567-e89b-12d3-a456-426614174000',
      email: 'teste@exemplo.com',
      role: 'USER' as const,
    };

    const refreshToken = generateTokens(payload).refreshToken;
    console.log(`   Token: ${refreshToken.substring(0, 30)}...`);

    // Verificar token válido
    const validation = verifyRefreshToken(refreshToken);
    if (!validation.isValid || !validation.payload) {
      throw new Error('Refresh token válido não foi reconhecido');
    }

    if (validation.payload.userId !== payload.userId) {
      throw new Error('Payload do refresh token não corresponde');
    }

    console.log('   ✅ Refresh token funcionando corretamente\n');
    testsPassed++;
  } catch (error) {
    console.error('   ❌ Erro:', error instanceof Error ? error.message : error);
    testsFailed++;
  }

  // ============================================
  // Resumo
  // ============================================
  console.log('📊 Resumo dos Testes:');
  console.log(`   ✅ Passaram: ${testsPassed}`);
  console.log(`   ❌ Falharam: ${testsFailed}`);
  console.log(`   Total: ${testsPassed + testsFailed}\n`);

  if (testsFailed > 0) {
    console.log('❌ Alguns testes falharam!\n');
    process.exit(1);
  } else {
    console.log('✅ Todos os testes passaram!\n');
  }
}

// Executar testes
testAuth();
