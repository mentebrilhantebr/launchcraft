/**
 * Dashboard — lista e criação de projetos
 *
 * UI mínima funcional (Etapa 5). Visual completo será feito na Etapa 9.
 */

'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { authFetch, logout, refresh } from '@/lib/client/auth-client';

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
    return <main style={{ padding: 16 }}>Carregando...</main>;
  }

  return (
    <main style={{ maxWidth: 640, margin: '24px auto', padding: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <h1>Meus projetos</h1>
        <button type="button" onClick={handleLogout}>
          Sair
        </button>
      </div>

      <section style={{ marginTop: 16 }}>
        <h2>Novo projeto</h2>
        <form onSubmit={handleCreate} style={{ display: 'grid', gap: 8 }}>
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
          <label>
            Nicho
            <input
              type="text"
              value={niche}
              onChange={(e) => setNiche(e.target.value)}
              required
              style={{ display: 'block', width: '100%' }}
            />
          </label>
          <button type="submit" disabled={creating}>
            {creating ? 'Criando...' : 'Criar projeto'}
          </button>
        </form>
      </section>

      {error && <p style={{ color: 'red' }}>{error}</p>}

      <section style={{ marginTop: 24 }}>
        <h2>Projetos existentes</h2>
        {projects.length === 0 ? (
          <p>Nenhum projeto ainda.</p>
        ) : (
          <ul>
            {projects.map((p) => (
              <li key={p.id} style={{ marginBottom: 8 }}>
                <button
                  type="button"
                  onClick={() => router.push(`/app/project/${p.id}`)}
                >
                  {p.name}
                </button>{' '}
                — {p.niche} (etapa {p.currentStage}/12, {p.status})
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
