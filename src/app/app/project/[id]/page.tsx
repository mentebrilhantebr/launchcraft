/**
 * Página do projeto — fluxo de construção em 12 etapas (Doc 04)
 *
 * Núcleo da Etapa 5: indicador de etapa (X de 12 + título), lista das 12
 * etapas com a atual destacada, chat com streaming SSE, botões avançar/voltar
 * e visualização das decisões + histórico de etapas.
 *
 * UI mínima funcional (Etapa 5). Visual completo será feito na Etapa 9.
 */

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { authFetch, getAccessToken, refresh } from '@/lib/client/auth-client';

interface StageMeta {
  stage: number;
  title: string;
  kind: 'user' | 'internal';
}

interface StageHistoryEntry {
  stage: number;
  enteredAt: string;
}

interface FlowState {
  decisions: Record<string, unknown>;
  stageHistory: StageHistoryEntry[];
}

interface StageResponse {
  currentStage: number;
  totalStages: number;
  stageMeta: StageMeta | null;
  canAdvance: boolean;
  canGoBack: boolean;
  flowState: FlowState;
  allStages: StageMeta[];
}

interface ChatMessage {
  role: string;
  content: string;
  timestamp?: string;
}

export default function ProjectPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const projectId = params.id;

  const [ready, setReady] = useState(false);
  const [projectName, setProjectName] = useState('');
  const [stageData, setStageData] = useState<StageResponse | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const streamingRef = useRef('');

  const loadStage = useCallback(async () => {
    const res = await authFetch(`/api/projects/${projectId}/stage`);
    if (res.ok) {
      setStageData(await res.json());
    }
  }, [projectId]);

  const loadProject = useCallback(async () => {
    const res = await authFetch(`/api/projects/${projectId}`);
    if (!res.ok) {
      setError('Não foi possível carregar o projeto.');
      return;
    }
    const data = await res.json();
    setProjectName(data.project?.name ?? '');
    // Achata as mensagens de todas as conversas em ordem.
    const all: ChatMessage[] = [];
    for (const conv of data.project?.conversations ?? []) {
      if (Array.isArray(conv.messages)) {
        all.push(...(conv.messages as ChatMessage[]));
      }
    }
    all.sort((a, b) =>
      (a.timestamp ?? '').localeCompare(b.timestamp ?? '')
    );
    setMessages(all);
  }, [projectId]);

  useEffect(() => {
    (async () => {
      const ok = await refresh();
      if (!ok) {
        router.replace('/login');
        return;
      }
      await Promise.all([loadProject(), loadStage()]);
      setReady(true);
    })();
  }, [router, loadProject, loadStage]);

  async function handleStageAction(action: 'advance' | 'back') {
    setError(null);
    const res = await authFetch(`/api/projects/${projectId}/stage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data?.error || 'Erro ao mudar de etapa');
      return;
    }
    setStageData(data);
  }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || streaming) return;
    setError(null);

    const userMessage = input.trim();
    setInput('');
    setMessages((prev) => [...prev, { role: 'user', content: userMessage }]);
    setStreaming(true);
    streamingRef.current = '';
    setMessages((prev) => [...prev, { role: 'assistant', content: '' }]);

    try {
      // Garante um access token válido antes de abrir o stream.
      if (!getAccessToken()) {
        await refresh();
      }
      const token = getAccessToken();

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        credentials: 'include',
        body: JSON.stringify({
          projectId,
          message: userMessage,
          stage: stageData?.currentStage ?? 1,
        }),
      });

      if (!res.ok || !res.body) {
        throw new Error('Falha ao iniciar a conversa com a IA.');
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const events = buffer.split('\n\n');
        buffer = events.pop() ?? '';

        for (const evt of events) {
          const line = evt.trim();
          if (!line.startsWith('data:')) continue;
          const payload = line.slice(5).trim();
          if (payload === '[DONE]') continue;
          try {
            const parsed = JSON.parse(payload);
            if (parsed.type === 'delta' && parsed.content) {
              streamingRef.current += parsed.content;
              const current = streamingRef.current;
              setMessages((prev) => {
                const copy = [...prev];
                copy[copy.length - 1] = {
                  role: 'assistant',
                  content: current,
                };
                return copy;
              });
            } else if (parsed.type === 'error') {
              setError(parsed.error || 'Erro na geração da IA.');
            }
          } catch {
            // Ignora payloads não-JSON.
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro inesperado');
    } finally {
      setStreaming(false);
      // Recarrega estado da etapa (decisões podem ter sido registradas).
      await loadStage();
    }
  }

  if (!ready) {
    return <main style={{ padding: 16 }}>Carregando...</main>;
  }

  const current = stageData?.currentStage ?? 1;
  const total = stageData?.totalStages ?? 12;
  const meta = stageData?.stageMeta;

  return (
    <main style={{ maxWidth: 760, margin: '24px auto', padding: 16 }}>
      <button type="button" onClick={() => router.push('/app')}>
        ← Voltar aos projetos
      </button>
      <h1>{projectName}</h1>

      {/* Indicador de etapa */}
      <section style={{ marginTop: 12 }}>
        <strong>
          Etapa {current} de {total}
          {meta ? ` — ${meta.title}` : ''}
          {meta?.kind === 'internal' ? ' (interna)' : ''}
        </strong>
        <ol style={{ marginTop: 8 }}>
          {(stageData?.allStages ?? []).map((s) => (
            <li
              key={s.stage}
              style={{
                fontWeight: s.stage === current ? 'bold' : 'normal',
              }}
            >
              {s.stage}. {s.title}
              {s.kind === 'internal' ? ' (interna)' : ''}
              {s.stage === current ? '  ← atual' : ''}
            </li>
          ))}
        </ol>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            type="button"
            onClick={() => handleStageAction('back')}
            disabled={!stageData?.canGoBack}
          >
            ◀ Etapa anterior
          </button>
          <button
            type="button"
            onClick={() => handleStageAction('advance')}
            disabled={!stageData?.canAdvance}
          >
            Próxima etapa ▶
          </button>
        </div>
      </section>

      {error && <p style={{ color: 'red' }}>{error}</p>}

      {/* Chat */}
      <section style={{ marginTop: 24 }}>
        <h2>Conversa</h2>
        <div
          style={{
            border: '1px solid #ccc',
            padding: 8,
            minHeight: 160,
            maxHeight: 360,
            overflowY: 'auto',
          }}
        >
          {messages.length === 0 ? (
            <p>Descreva sua ideia e nós construiremos seu negócio digital.</p>
          ) : (
            messages.map((m, i) => (
              <p key={i}>
                <strong>{m.role === 'user' ? 'Você' : 'IA'}:</strong>{' '}
                {m.content}
              </p>
            ))
          )}
        </div>
        <form onSubmit={handleSend} style={{ marginTop: 8, display: 'flex', gap: 8 }}>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Digite sua mensagem..."
            style={{ flex: 1 }}
            disabled={streaming}
          />
          <button type="submit" disabled={streaming || !input.trim()}>
            {streaming ? 'Gerando...' : 'Enviar'}
          </button>
        </form>
      </section>

      {/* Estado do fluxo (decisões + histórico) */}
      <section style={{ marginTop: 24 }}>
        <h2>Estado do projeto (decisões registradas)</h2>
        <pre
          style={{
            border: '1px solid #ccc',
            padding: 8,
            overflowX: 'auto',
            fontSize: 12,
          }}
        >
          {JSON.stringify(stageData?.flowState ?? {}, null, 2)}
        </pre>
      </section>
    </main>
  );
}
