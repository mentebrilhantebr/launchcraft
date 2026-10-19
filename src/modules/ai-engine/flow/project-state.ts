/**
 * Project flow state
 *
 * The project state stores WHAT WAS DECIDED along the conversation — never form
 * answers (Doc 03 / Doc 09: "A IA nunca cria perguntas fixas. Não existe um
 * formulário padrão"). Decisions are a flexible, open-ended bag keyed by
 * whatever concepts the AI actually decided, not a rigid schema.
 *
 * This state is persisted inside Project.outputData (Json) so no schema
 * migration is needed.
 *
 * @module ai-engine/flow/project-state
 */

import { isValidStage } from './stages';

/**
 * Flexible bag of decisions made during the conversation. Keys are arbitrary
 * (e.g. "tipoDeNegocio", "publico", "planoDePaginas") — intentionally NOT a
 * fixed set of fields.
 */
export type ProjectDecisions = Record<string, unknown>;

/**
 * A record of the project entering a given stage.
 */
export interface StageHistoryEntry {
  stage: number;
  /** ISO timestamp of when the stage was entered. */
  enteredAt: string;
}

/**
 * A piece of content produced by the AI generation queue (Etapa 6).
 *
 * Generation of heavy content (sales page, course structure, etc.) never runs
 * inside the synchronous HTTP request — it is processed by the BullMQ worker
 * and the result is persisted back here, inside Project.outputData, so it is
 * recovered exactly where the user left off (Doc 08: "Recuperação de Projetos").
 */
export interface GenerationResult {
  /** BullMQ job id that produced this result (for traceability / polling). */
  jobId?: string;
  /** Kind of generation (matches AIGenerationKind of the queue). */
  kind: string;
  /** Stage the generation belongs to. */
  stage: number;
  /** The generated content itself. */
  content: string;
  /** ISO timestamp of when the content was generated. */
  createdAt: string;
}

/**
 * A reference to a file uploaded by the user and associated to the project
 * (Etapa 8, Opção A — "upload e associação a projetos").
 *
 * Doc 08: "A plataforma deve manter todos os arquivos organizados por
 * categorias." e "Todo projeto deve ser salvo automaticamente. Caso o usuário
 * saia da plataforma, ao retornar deverá encontrar seu projeto exatamente onde
 * parou." Por isso a referência vive aqui, dentro de Project.outputData, junto
 * das gerações — sobrevive à navegação entre etapas.
 *
 * IMPORTANTE: guardamos APENAS dados estáveis. NUNCA guardamos a URL assinada,
 * pois ela expira (~1h); a URL é gerada na hora da consulta (ver a rota
 * GET /api/projects/:id/files). Doc 08 (Segurança): "Nunca expor: Tokens.
 * Chaves. Dados internos. ... Informações privadas."
 */
export interface UploadReference {
  /** Chave (caminho) do objeto no bucket S3. */
  key: string;
  /** Nome original do arquivo enviado pelo usuário. */
  name: string;
  /** MIME type REAL detectado pelo conteúdo (magic bytes), não o do browser. */
  type: string;
  /** Tamanho em bytes. */
  size: number;
  /** Regra de acesso resolvida pelo tipo: imagens 'public', documentos 'private'. */
  visibility: 'public' | 'private';
  /** ISO timestamp do upload. */
  uploadedAt: string;
}

/**
 * The full flow state persisted in Project.outputData.
 */
export interface ProjectFlowState {
  decisions: ProjectDecisions;
  stageHistory: StageHistoryEntry[];
  /** Content produced by the generation queue (Etapa 6). */
  generations: GenerationResult[];
  /** Files uploaded by the user and associated to the project (Etapa 8). */
  uploads: UploadReference[];
}

/**
 * Returns an empty flow state.
 */
export function emptyFlowState(): ProjectFlowState {
  return { decisions: {}, stageHistory: [], generations: [], uploads: [] };
}

/**
 * Type guard for a single persisted UploadReference coming from JSONB.
 */
export function isUploadReference(value: unknown): value is UploadReference {
  if (!value || typeof value !== 'object') return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.key === 'string' &&
    typeof record.name === 'string' &&
    typeof record.type === 'string' &&
    typeof record.size === 'number' &&
    (record.visibility === 'public' || record.visibility === 'private') &&
    typeof record.uploadedAt === 'string'
  );
}

/**
 * Type guard for a single persisted GenerationResult coming from JSONB.
 */
function isGenerationResult(value: unknown): value is GenerationResult {
  if (!value || typeof value !== 'object') return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.kind === 'string' &&
    typeof record.stage === 'number' &&
    typeof record.content === 'string' &&
    typeof record.createdAt === 'string'
  );
}

/**
 * Safely reads a ProjectFlowState from an arbitrary Project.outputData value.
 * Unknown/missing/corrupt shapes degrade gracefully to an empty state, while
 * preserving any pre-existing outputData keys that are not part of the flow
 * state is NOT done here — callers should spread the result back if needed.
 */
export function readFlowState(outputData: unknown): ProjectFlowState {
  if (!outputData || typeof outputData !== 'object') {
    return emptyFlowState();
  }

  const data = outputData as Record<string, unknown>;

  const decisions =
    data.decisions && typeof data.decisions === 'object'
      ? (data.decisions as ProjectDecisions)
      : {};

  const stageHistory = Array.isArray(data.stageHistory)
    ? (data.stageHistory as unknown[]).filter(
        (entry): entry is StageHistoryEntry =>
          !!entry &&
          typeof entry === 'object' &&
          isValidStage((entry as StageHistoryEntry).stage) &&
          typeof (entry as StageHistoryEntry).enteredAt === 'string'
      )
    : [];

  const generations = Array.isArray(data.generations)
    ? (data.generations as unknown[]).filter(isGenerationResult)
    : [];

  const uploads = Array.isArray(data.uploads)
    ? (data.uploads as unknown[]).filter(isUploadReference)
    : [];

  return { decisions, stageHistory, generations, uploads };
}

/**
 * Merges a partial set of decisions into the flow state, returning a NEW state
 * (does not mutate the input). Later keys overwrite earlier ones.
 */
export function mergeDecisions(
  state: ProjectFlowState,
  partial?: ProjectDecisions
): ProjectFlowState {
  if (!partial || typeof partial !== 'object') {
    return state;
  }
  return {
    ...state,
    decisions: { ...state.decisions, ...partial },
  };
}

/**
 * Appends a stage-entry record (with the current timestamp) to the flow state,
 * returning a NEW state. Avoids duplicating consecutive identical entries.
 */
export function recordStageEntry(
  state: ProjectFlowState,
  stage: number
): ProjectFlowState {
  if (!isValidStage(stage)) {
    return state;
  }
  const last = state.stageHistory[state.stageHistory.length - 1];
  if (last && last.stage === stage) {
    return state;
  }
  return {
    ...state,
    stageHistory: [
      ...state.stageHistory,
      { stage, enteredAt: new Date().toISOString() },
    ],
  };
}

/**
 * Appends a generation result to the flow state, returning a NEW state (does
 * not mutate the input). Called by the BullMQ worker after content is produced
 * so results are persisted inside Project.outputData alongside decisions and
 * stage history. Because mergeDecisions/recordStageEntry spread `...state`, the
 * generations array survives subsequent stage navigation writes.
 */
export function appendGeneration(
  state: ProjectFlowState,
  result: GenerationResult
): ProjectFlowState {
  return {
    ...state,
    generations: [...state.generations, result],
  };
}

/**
 * Appends an upload reference to the flow state, returning a NEW state (does not
 * mutate the input). Mesmo padrão de `appendGeneration`: o spread `...state`
 * preserva decisions/stageHistory/generations, de modo que gravar o estado de
 * volta (ex.: na rota de etapas) nunca apaga os uploads — e vice-versa.
 *
 * ATENÇÃO sobre concorrência: este helper é um read-modify-write em memória.
 * Para o caminho de upload da API, a gravação é feita por um append ATÔMICO em
 * JSONB no banco (ver src/app/api/upload/route.ts), que é seguro contra dois
 * uploads simultâneos no mesmo projeto. Este helper existe para consistência de
 * tipos e usos não concorrentes.
 */
export function appendUpload(
  state: ProjectFlowState,
  ref: UploadReference
): ProjectFlowState {
  return {
    ...state,
    uploads: [...state.uploads, ref],
  };
}
