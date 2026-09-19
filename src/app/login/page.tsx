/**
 * Página de Login / Cadastro
 *
 * UI mínima funcional (Etapa 5). Visual completo será feito na Etapa 9.
 */

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { login, signup } from '@/lib/client/auth-client';

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (mode === 'login') {
        await login(email, password);
      } else {
        await signup(name, email, password);
      }
      router.push('/app');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro inesperado');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ maxWidth: 360, margin: '40px auto', padding: 16 }}>
      <h1>LaunchCraft — {mode === 'login' ? 'Entrar' : 'Criar conta'}</h1>
      <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 8 }}>
        {mode === 'signup' && (
          <label>
            Nome
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              style={{ display: 'block', width: '100%' }}
            />
          </label>
        )}
        <label>
          Email
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={{ display: 'block', width: '100%' }}
          />
        </label>
        <label>
          Senha
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            style={{ display: 'block', width: '100%' }}
          />
        </label>
        <button type="submit" disabled={loading}>
          {loading ? 'Aguarde...' : mode === 'login' ? 'Entrar' : 'Criar conta'}
        </button>
      </form>
      {error && <p style={{ color: 'red' }}>{error}</p>}
      <p>
        {mode === 'login' ? 'Não tem conta?' : 'Já tem conta?'}{' '}
        <button
          type="button"
          onClick={() => {
            setError(null);
            setMode(mode === 'login' ? 'signup' : 'login');
          }}
        >
          {mode === 'login' ? 'Criar conta' : 'Entrar'}
        </button>
      </p>
    </main>
  );
}
