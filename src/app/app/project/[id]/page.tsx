/**
 * Página do projeto — fluxo de construção em 12 etapas (Doc 04)
 *
 * Núcleo da Etapa 5: indicador de etapa (X de 12 + título), lista das 12
 * etapas com a atual destacada, chat com streaming SSE, botões avançar/voltar
 * e visualização das decisões + histórico de etapas.
 *
 * Lógica das Etapas 5–7; visual aplicado na Etapa 9 (Tailwind).
 */

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { authFetch, getAccessToken, refresh } from '@/lib/client/auth-client';
import Brand from '@/components/Brand';
import ThemeToggle from '@/components/ThemeToggle';

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

/** Arquivo anexado — formato devolvido por GET /api/projects/:id/files (sem key interna). */
interface ProjectFile {
  name: string;
  type: string;
  size: number;
  visibility: 'public' | 'private';
  uploadedAt: string;
  url: string;
}

const IMAGE_ACCEPT = 'image/jpeg,image/png,image/gif,image/webp,image/svg+xml';
const DOC_ACCEPT =
  '.pdf,.doc,.docx,.txt,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain';

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

  // ── Anexos (Etapa 8) ─────────────────────────────────────────────────────
  // Doc 02: "Botão "+" Ao lado da caixa de mensagem existe apenas um botão.
  // Esse botão expande pequenas opções." Implementadas apenas as opções com
  // backend: "Adicionar imagem" e "Adicionar documento".
  const [attachMenuOpen, setAttachMenuOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [files, setFiles] = useState<ProjectFile[]>([]);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);

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

  const loadFiles = useCallback(async () => {
    const res = await authFetch(`/api/projects/${projectId}/files`);
    if (res.ok) {
      const data = await res.json();
      setFiles(Array.isArray(data.files) ? (data.files as ProjectFile[]) : []);
    }
  }, [projectId]);

  async function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const input = e.target;
    const file = input.files?.[0];
    setAttachMenuOpen(false);
    if (!file) return;
    setError(null);
    setUploading(true);
    try {
      let token = getAccessToken();
      if (!token) {
        const ok = await refresh();
        token = ok ? getAccessToken() : null;
      }
      if (!token) {
        router.replace('/login');
        return;
      }
      const form = new FormData();
      form.append('file', file);
      form.append('projectId', projectId);
      // Sem Content-Type manual: o navegador define o boundary do multipart.
      const res = await fetch('/api/upload', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        credentials: 'include',
        body: form,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? 'Não foi possível enviar o arquivo.');
        return;
      }
      await loadFiles();
    } catch {
      setError('Não foi possível enviar o arquivo.');
    } finally {
      setUploading(false);
      input.value = '';
    }
  }

  useEffect(() => {
    (async () => {
      const ok = await refresh();
      if (!ok) {
        router.replace('/login');
        return;
      }
      await Promise.all([loadProject(), loadStage(), loadFiles()]);
      setReady(true);
    })();
  }, [router, loadProject, loadStage, loadFiles]);

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
    return (
      <main className="flex min-h-screen items-center justify-center text-muted">
        <span className="animate-soft-pulse">Carregando...</span>
      </main>
    );
  }

  const current = stageData?.currentStage ?? 1;
  const total = stageData?.totalStages ?? 12;
  const meta = stageData?.stageMeta;

  return (
    <div className="min-h-screen">
      <header className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            onClick={() => router.push('/app')}
            className="btn-ghost shrink-0"
          >
            ← Voltar aos projetos
          </button>
          <h1 className="truncate text-lg font-semibold">{projectName}</h1>
        </div>
        <div className="flex items-center gap-3">
          <Brand className="hidden sm:inline-flex" />
          <ThemeToggle />
        </div>
      </header>

      <main className="mx-auto grid max-w-6xl gap-6 px-4 pb-10 lg:grid-cols-[minmax(0,1fr)_340px]">
        {/* Chat — Doc 02, seção 18: "O chat é sempre o centro da experiência." */}
        <section className="glass flex min-h-[70vh] flex-col rounded-2xl">
          <div className="border-b border-border px-5 py-3 text-sm text-muted">
            Etapa {current} de {total}
            {meta ? ` — ${meta.title}` : ''}
            {meta?.kind === 'internal' ? ' (interna)' : ''}
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto px-5 py-4 lg:max-h-[60vh]">
            {messages.length === 0 ? (
              <p className="mt-10 text-center text-muted">
                Descreva sua ideia e nós construiremos seu negócio digital.
              </p>
            ) : (
              messages.map((m, i) => (
                <div
                  key={i}
                  className={m.role === 'user' ? 'flex justify-end' : 'flex justify-start'}
                >
                  <div
                    className={
                      m.role === 'user'
                        ? 'max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-primary px-4 py-2.5 text-white'
                        : 'max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-bl-md border border-border bg-surface px-4 py-2.5'
                    }
                  >
                    <span className="mb-0.5 block text-xs opacity-70">
                      {m.role === 'user' ? 'Você' : 'IA'}
                    </span>
                    {m.content ? (
                      m.content
                    ) : (
                      <span className="animate-soft-pulse">…</span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          {error && (
            <p className="mx-5 mb-2 rounded-xl bg-danger/10 px-4 py-2 text-sm text-danger">
              {error}
            </p>
          )}

          <form onSubmit={handleSend} className="flex gap-2 border-t border-border p-4">
            {/* Botão "+" — Doc 02: "Ao lado da caixa de mensagem existe apenas um botão." */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setAttachMenuOpen((v) => !v)}
                disabled={uploading}
                aria-label="Adicionar anexo"
                aria-expanded={attachMenuOpen}
                className="flex h-10 w-10 items-center justify-center rounded-full border border-border text-lg font-semibold hover:bg-primary-soft disabled:opacity-50"
              >
                {uploading ? '…' : '+'}
              </button>
              {attachMenuOpen && (
                <div className="glass absolute bottom-12 left-0 z-10 w-48 rounded-xl p-1 text-sm shadow-lg">
                  <button
                    type="button"
                    onClick={() => imageInputRef.current?.click()}
                    className="block w-full rounded-lg px-3 py-2 text-left hover:bg-primary-soft"
                  >
                    Adicionar imagem
                  </button>
                  <button
                    type="button"
                    onClick={() => docInputRef.current?.click()}
                    className="block w-full rounded-lg px-3 py-2 text-left hover:bg-primary-soft"
                  >
                    Adicionar documento
                  </button>
                </div>
              )}
              <input
                ref={imageInputRef}
                type="file"
                accept={IMAGE_ACCEPT}
                className="hidden"
                onChange={handleFileSelected}
              />
              <input
                ref={docInputRef}
                type="file"
                accept={DOC_ACCEPT}
                className="hidden"
                onChange={handleFileSelected}
              />
            </div>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Digite sua mensagem..."
              className="field flex-1 rounded-full"
              disabled={streaming}
            />
            <button
              type="submit"
              disabled={streaming || !input.trim()}
              className="btn-primary rounded-full"
            >
              {streaming ? 'Gerando...' : 'Enviar'}
            </button>
          </form>
        </section>

        {/* Painel lateral — Doc 02: "Esse painel mostra o negócio nascendo." */}
        <aside className="space-y-6">
          {/* Anexos do projeto (Etapa 8) */}
          <section className="glass rounded-2xl p-5">
            <h2 className="mb-3 text-sm font-medium text-muted">Anexos</h2>
            {files.length === 0 ? (
              <p className="text-sm text-muted">Nenhum arquivo anexado.</p>
            ) : (
              <ul className="space-y-1.5 text-sm">
                {files.map((f) => (
                  <li key={`${f.uploadedAt}-${f.name}`} className="truncate">
                    <a
                      href={f.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline hover:opacity-80"
                    >
                      {f.name}
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Barra de progresso por etapas — "Ela deve mostrar etapas." */}
          <section className="glass rounded-2xl p-5">
            <h2 className="mb-3 text-sm font-medium text-muted">Progresso</h2>
            <ol className="space-y-1.5">
              {(stageData?.allStages ?? []).map((s) => {
                const done = s.stage < current;
                const isCurrent = s.stage === current;
                return (
                  <li
                    key={s.stage}
                    className={
                      isCurrent
                        ? 'flex items-center gap-2 rounded-lg bg-primary-soft px-2 py-1 text-sm font-semibold'
                        : done
                          ? 'flex items-center gap-2 px-2 py-1 text-sm'
                          : 'flex items-center gap-2 px-2 py-1 text-sm text-muted'
                    }
                  >
                    <span
                      className={
                        done
                          ? 'flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] text-white'
                          : isCurrent
                            ? 'flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 border-primary text-[10px]'
                            : 'flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-border text-[10px]'
                      }
                    >
                      {done ? '✔' : s.stage}
                    </span>
                    <span className="truncate">
                      {s.title}
                      {s.kind === 'internal' ? ' (interna)' : ''}
                    </span>
                  </li>
                );
              })}
            </ol>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => handleStageAction('back')}
                disabled={!stageData?.canGoBack}
                className="btn-ghost flex-1 text-sm"
              >
                ◀ Etapa anterior
              </button>
              <button
                type="button"
                onClick={() => handleStageAction('advance')}
                disabled={!stageData?.canAdvance}
                className="btn-primary flex-1 text-sm"
              >
                Próxima etapa ▶
              </button>
            </div>
          </section>

          {/* Estado do fluxo (decisões + histórico) */}
          <section className="glass rounded-2xl p-5">
            <details>
              <summary className="cursor-pointer text-sm font-medium text-muted">
                Estado do projeto (decisões registradas)
              </summary>
              <pre className="mt-3 max-h-64 overflow-auto rounded-lg bg-surface p-3 text-xs">
                {JSON.stringify(stageData?.flowState ?? {}, null, 2)}
              </pre>
            </details>
          </section>

          {/* ── Geração de conteúdo com SSE (Etapa 7) ─────────────────────────
              Doc 02, seção 18: "O usuário nunca deve ficar sem saber o que está acontecendo."
              Doc 08: "A interface deve atualizar automaticamente. Mostrar progresso." */}
          <section className="glass rounded-2xl p-5">
            <h2 className="mb-3 text-sm font-medium text-muted">
              Geração de conteúdo (tempo real)
            </h2>
            <form onSubmit={handleGenerate} className="flex flex-col gap-3">
              <label className="block text-sm text-muted">
                Tipo de conteúdo:
                <select
                  value={genKind}
                  onChange={(e) => setGenKind(e.target.value as GenKind)}
                  disabled={generating}
                  className="field mt-1"
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
                className="field resize-y"
                disabled={generating}
              />

              <button
                type="submit"
                disabled={generating || !genPrompt.trim()}
                className="btn-primary self-start text-sm"
              >
                {generating ? 'Gerando...' : 'Gerar conteúdo'}
              </button>
            </form>

            {/* Barra de progresso em tempo real — Doc 02, seção 9 */}
            {(generating || genProgress > 0) && genContent === null && (
              <div className="mt-4">
                <div
                  className="h-2 w-full overflow-hidden rounded-full bg-surface"
                  role="progressbar"
                  aria-valuenow={genProgress}
                  aria-valuemin={0}
                  aria-valuemax={100}
                >
                  <div
                    className="h-full rounded-full bg-primary transition-all duration-500"
                    style={{ width: `${genProgress}%` }}
                  />
                </div>
                <p className="mt-2 text-sm text-muted">
                  {genStatusMsg || progressLabel(genProgress)}
                </p>
              </div>
            )}

            {genError && (
              <p className="mt-3 rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger">
                {genError}
              </p>
            )}

            {genContent !== null && (
              <div className="mt-4">
                <strong className="text-sm">Conteúdo gerado:</strong>
                <pre className="mt-2 max-h-80 overflow-auto whitespace-pre-wrap rounded-lg bg-surface p-3 text-xs">
                  {genContent}
                </pre>
              </div>
            )}
          </section>
        </aside>
      </main>
    </div>
  );
}
