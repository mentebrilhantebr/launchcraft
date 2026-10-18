/**
 * Página de Login / Cadastro
 *
 * Lógica da Etapa 5 (inalterada). Visual aplicado na Etapa 9.
 */

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { login, signup } from '@/lib/client/auth-client';
import Brand from '@/components/Brand';
import ThemeToggle from '@/components/ThemeToggle';

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
    <div className="flex flex-1 flex-col">
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-5">
        <Link href="/">
          <Brand className="text-lg" />
        </Link>
        <ThemeToggle />
      </header>

      <main className="flex flex-1 items-center justify-center px-6 pb-24">
        <div className="glass w-full max-w-sm rounded-3xl p-8">
          <h1 className="text-2xl font-semibold tracking-tight">
            {mode === 'login' ? 'Entrar' : 'Criar conta'}
          </h1>
          <p className="mt-1 text-sm text-muted">
            {mode === 'login'
              ? 'Continue construindo seu negócio.'
              : 'Comece a construir seu negócio digital.'}
          </p>

          <form onSubmit={handleSubmit} className="mt-6 grid gap-4">
            {mode === 'signup' && (
              <label className="grid gap-1.5 text-sm font-medium">
                Nome
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="field font-normal"
                />
              </label>
            )}
            <label className="grid gap-1.5 text-sm font-medium">
              Email
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="field font-normal"
              />
            </label>
            <label className="grid gap-1.5 text-sm font-medium">
              Senha
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="field font-normal"
              />
            </label>
            <button type="submit" disabled={loading} className="btn-primary mt-2 w-full">
              {loading ? 'Aguarde...' : mode === 'login' ? 'Entrar' : 'Criar conta'}
            </button>
          </form>

          {error && (
            <p className="mt-4 rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>
          )}

          <p className="mt-6 text-center text-sm text-muted">
            {mode === 'login' ? 'Não tem conta?' : 'Já tem conta?'}{' '}
            <button
              type="button"
              className="font-medium text-primary hover:underline"
              onClick={() => {
                setError(null);
                setMode(mode === 'login' ? 'signup' : 'login');
              }}
            >
              {mode === 'login' ? 'Criar conta' : 'Entrar'}
            </button>
          </p>
        </div>
      </main>
    </div>
  );
}
