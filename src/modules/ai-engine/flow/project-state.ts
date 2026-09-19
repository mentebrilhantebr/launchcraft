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
 * The full flow state persisted in Project.outputData.
 */
export interface ProjectFlowState {
  decisions: ProjectDecisions;
  stageHistory: StageHistoryEntry[];
  /** Content produced by the generation queue (Etapa 6). */
  generations: GenerationResult[];
}

/**
 * Returns an empty flow state.
 */
export function emptyFlowState(): ProjectFlowState {
  return { decisions: {}, stageHistory: [], generations: [] };
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

  return { decisions, stageHistory, generations };
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
