/**
 * Dashboard — lista e criação de projetos
 *
 * Lógica da Etapa 5; visual aplicado na Etapa 9 (Tailwind).
 */

'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { authFetch, logout, refresh } from '@/lib/client/auth-client';
import Brand from '@/components/Brand';
import ThemeToggle from '@/components/ThemeToggle';

interface ProjectListItem {
  id: string;
  name: string;
  niche: string;
  status: string;
  currentStage: number;
}

export default function DashboardPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [projects, setProjects] = useState<ProjectListItem[]>([]);
  const [name, setName] = useState('');
  const [niche, setNiche] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const loadProjects = useCallback(async () => {
    const res = await authFetch('/api/projects');
    if (!res.ok) {
      setError('Não foi possível carregar os projetos.');
      return;
    }
    const data = await res.json();
    setProjects(data.projects ?? []);
  }, []);

  useEffect(() => {
    (async () => {
      const ok = await refresh();
      if (!ok) {
        router.replace('/login');
        return;
      }
      await loadProjects();
      setReady(true);
    })();
  }, [router, loadProjects]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setCreating(true);
    try {
      const res = await authFetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, niche }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || 'Erro ao criar projeto');
      }
      setName('');
      setNiche('');
      await loadProjects();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro inesperado');
    } finally {
      setCreating(false);
    }
  }

  async function handleLogout() {
    await logout();
    router.replace('/login');
  }

  if (!ready) {
    return (
      <main className="flex min-h-screen items-center justify-center text-muted">
        <span className="animate-soft-pulse">Carregando...</span>
      </main>
    );
  }

  return (
    <div className="min-h-screen">
      <header className="mx-auto flex max-w-3xl items-center justify-between px-4 py-5">
        <Brand />
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <button type="button" onClick={handleLogout} className="btn-ghost">
            Sair
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-6 px-4 pb-12">
        <h1 className="text-2xl font-semibold tracking-tight">Meus projetos</h1>

        <section className="glass rounded-2xl p-6">
          <h2 className="mb-4 text-lg font-medium">Novo projeto</h2>
          <form onSubmit={handleCreate} className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm text-muted">
              Nome
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="field mt-1"
              />
            </label>
            <label className="block text-sm text-muted">
              Nicho
              <input
                type="text"
                value={niche}
                onChange={(e) => setNiche(e.target.value)}
                required
                className="field mt-1"
              />
            </label>
            <div className="sm:col-span-2">
              <button type="submit" disabled={creating} className="btn-primary">
                {creating ? 'Criando...' : 'Criar projeto'}
              </button>
            </div>
          </form>
        </section>

        {error && (
          <p className="rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger">
            {error}
          </p>
        )}

        <section>
          <h2 className="mb-3 text-lg font-medium">Projetos existentes</h2>
          {projects.length === 0 ? (
            <p className="text-muted">Nenhum projeto ainda.</p>
          ) : (
            <ul className="grid gap-3">
              {projects.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => router.push(`/app/project/${p.id}`)}
                    className="glass w-full rounded-2xl p-4 text-left transition hover:border-primary/40"
                  >
                    <span className="block font-medium">{p.name}</span>
                    <span className="mt-1 block text-sm text-muted">
                      {p.niche} · etapa {p.currentStage}/12 · {p.status}
                    </span>
                    <span className="mt-3 block h-1.5 w-full overflow-hidden rounded-full bg-surface">
                      <span
                        className="block h-full rounded-full bg-primary"
                        style={{ width: `${Math.round((p.currentStage / 12) * 100)}%` }}
                      />
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}
