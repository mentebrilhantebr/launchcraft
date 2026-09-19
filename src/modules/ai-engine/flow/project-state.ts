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
 * The full flow state persisted in Project.outputData.
 */
export interface ProjectFlowState {
  decisions: ProjectDecisions;
  stageHistory: StageHistoryEntry[];
}

/**
 * Returns an empty flow state.
 */
export function emptyFlowState(): ProjectFlowState {
  return { decisions: {}, stageHistory: [] };
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

  return { decisions, stageHistory };
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
