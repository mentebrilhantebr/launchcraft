/**
 * Utilitários de Hash de Senha
 * 
 * Usa bcrypt para hash seguro de senhas com salt automático
 * 
 * @module security/hash
 */

import bcrypt from 'bcrypt';

/**
 * Número de rounds para gerar o salt
 * Quanto maior, mais seguro mas mais lento
 * 10 = ~10 hashes/segundo (equilibrado)
 * 12 = ~3 hashes/segundo (mais seguro)
 */
const SALT_ROUNDS = 10;

/**
 * Gera hash de uma senha
 * 
 * @param password - Senha em texto plano
 * @returns Hash bcrypt da senha
 * 
 * @example
 * const hash = await hashPassword('minhaSenha123');
 * // $2b$10$...
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

/**
 * Verifica se uma senha corresponde ao hash
 * 
 * @param password - Senha em texto plano
 * @param hash - Hash bcrypt armazenado
 * @returns true se a senha corresponde
 * 
 * @example
 * const isValid = await verifyPassword('minhaSenha123', user.passwordHash);
 * if (isValid) {
 *   // Login permitido
 * }
 */
export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * Valida força de senha
 * 
 * Requisitos:
 * - Mínimo 8 caracteres
 * - Pelo menos uma letra maiúscula
 * - Pelo menos uma letra minúscula
 * - Pelo menos um número
 * - Pelo menos um caractere especial
 * 
 * @param password - Senha a validar
 * @returns Objeto com resultado e mensagem de erro
 */
export function validatePasswordStrength(password: string): {
  isValid: boolean;
  error?: string;
} {
  if (password.length < 8) {
    return {
      isValid: false,
      error: 'A senha deve ter no mínimo 8 caracteres',
    };
  }

  if (!/[A-Z]/.test(password)) {
    return {
      isValid: false,
      error: 'A senha deve ter pelo menos uma letra maiúscula',
    };
  }

  if (!/[a-z]/.test(password)) {
    return {
      isValid: false,
      error: 'A senha deve ter pelo menos uma letra minúscula',
    };
  }

  if (!/[0-9]/.test(password)) {
    return {
      isValid: false,
      error: 'A senha deve ter pelo menos um número',
    };
  }

  if (!/[^A-Za-z0-9]/.test(password)) {
    return {
      isValid: false,
      error: 'A senha deve ter pelo menos um caractere especial',
    };
  }

  return { isValid: true };
}
