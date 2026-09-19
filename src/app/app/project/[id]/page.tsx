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

// ── Geração de conteúdo (Etapa 7) ────────────────────────────────────────────

const GEN_KINDS = [
  { value: 'sales_page',        label: 'Página de Vendas' },
  { value: 'course_structure',  label: 'Estrutura do Curso' },
  { value: 'module_content',    label: 'Conteúdo de Módulo' },
  { value: 'launch_plan',       label: 'Plano de Lançamento' },
] as const;

type GenKind = (typeof GEN_KINDS)[number]['value'];

/**
 * Rótulo textual do progresso — exemplos literais do Doc 02, seção 9:
 * "Enquanto trabalha, a IA informa o progresso."
 */
function progressLabel(p: number): string {
  if (p <= 10) return 'Analisando sua ideia...';
  if (p <= 30) return 'Organizando as páginas...';
  if (p <= 80) return 'Criando a estrutura do negócio...';
  if (p < 100) return 'Finalizando seu projeto...';
  return 'Concluído!';
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

  // ── Estado da geração assíncrona via fila (Etapa 7) ──────────────────────
  const [genKind, setGenKind] = useState<GenKind>('sales_page');
  const [genPrompt, setGenPrompt] = useState('');
  const [generating, setGenerating] = useState(false);
  const [genProgress, setGenProgress] = useState(0);
  const [genStatusMsg, setGenStatusMsg] = useState('');
  const [genContent, setGenContent] = useState<string | null>(null);
  const [genError, setGenError] = useState<string | null>(null);

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

  // ── Geração assíncrona com progresso SSE (Etapa 7) ──────────────────────
  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    if (!genPrompt.trim() || generating) return;
    setGenError(null);
    setGenContent(null);
    setGenProgress(0);
    setGenStatusMsg('Iniciando...');
    setGenerating(true);

    try {
      // Garantir access token válido antes de fazer fetch autenticado.
      if (!getAccessToken()) await refresh();
      const token = getAccessToken();
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      };

      // 1. Enfileirar o job de geração — POST retorna 202 + jobId.
      const postRes = await fetch(`/api/projects/${projectId}/generate`, {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify({
          kind: genKind,
          prompt: genPrompt.trim(),
          stage: stageData?.currentStage ?? 1,
        }),
      });

      if (!postRes.ok) {
        const errData = await postRes.json().catch(() => ({})) as { error?: string };
        throw new Error(errData?.error || 'Falha ao enfileirar a geração.');
      }

      const { jobId } = await postRes.json() as { jobId: string };

      // 2. Abrir stream SSE de progresso (fetch + ReadableStream — mesmo padrão do /api/chat).
      const sseRes = await fetch(
        `/api/projects/${projectId}/generate/progress?jobId=${jobId}`,
        { headers, credentials: 'include' }
      );

      if (!sseRes.ok || !sseRes.body) {
        throw new Error('Falha ao abrir stream de progresso.');
      }

      const reader = sseRes.body.getReader();
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
            const parsed = JSON.parse(payload) as {
              type: string;
              progress?: number;
              message?: string;
              content?: string;
              error?: string;
            };
            if (parsed.type === 'progress') {
              setGenProgress(parsed.progress ?? 0);
              setGenStatusMsg(parsed.message ?? progressLabel(parsed.progress ?? 0));
            } else if (parsed.type === 'completed') {
              setGenProgress(100);
              setGenStatusMsg('Concluído!');
              setGenContent(parsed.content ?? '');
            } else if (parsed.type === 'error') {
              setGenError(parsed.error || 'Erro na geração.');
            }
          } catch {
            // Ignora payloads não-JSON.
          }
        }
      }
    } catch (err) {
      setGenError(err instanceof Error ? err.message : 'Erro inesperado.');
    } finally {
      setGenerating(false);
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

      {/* ── Geração de conteúdo com SSE (Etapa 7) ─────────────────────────────
          Doc 02, seção 18: "O usuário nunca deve ficar sem saber o que está acontecendo."
          Doc 08: "A interface deve atualizar automaticamente. Mostrar progresso." */}
      <section style={{ marginTop: 24 }}>
        <h2>Geração de conteúdo (tempo real)</h2>
        <form
          onSubmit={handleGenerate}
          style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
        >
          <label>
            Tipo de conteúdo:
            <select
              value={genKind}
              onChange={(e) => setGenKind(e.target.value as GenKind)}
              disabled={generating}
              style={{ marginLeft: 8 }}
            >
              {GEN_KINDS.map((k) => (
                <option key={k.value} value={k.value}>
                  {k.label}
                </option>
              ))}
            </select>
          </label>

          <textarea
            value={genPrompt}
            onChange={(e) => setGenPrompt(e.target.value)}
            placeholder="Descreva o conteúdo que deseja gerar..."
            rows={4}
            style={{ width: '100%' }}
            disabled={generating}
          />

          <button
            type="submit"
            disabled={generating || !genPrompt.trim()}
            style={{ alignSelf: 'flex-start' }}
          >
            {generating ? 'Gerando...' : 'Gerar conteúdo'}
          </button>
        </form>

        {/* Barra de progresso em tempo real — Doc 02, seção 9 */}
        {(generating || genProgress > 0) && genContent === null && (
          <div style={{ marginTop: 12 }}>
            <progress
              value={genProgress}
              max={100}
              style={{ width: '100%' }}
            />
            <p style={{ margin: '4px 0', fontSize: 14 }}>
              {genStatusMsg || progressLabel(genProgress)}
            </p>
          </div>
        )}

        {genError && (
          <p style={{ color: 'red', marginTop: 8 }}>{genError}</p>
        )}

        {genContent !== null && (
          <div style={{ marginTop: 12 }}>
            <strong>Conteúdo gerado:</strong>
            <pre
              style={{
                border: '1px solid #ccc',
                padding: 8,
                overflowX: 'auto',
                whiteSpace: 'pre-wrap',
                fontSize: 13,
                marginTop: 4,
              }}
            >
              {genContent}
            </pre>
          </div>
        )}
      </section>
    </main>
  );
}
