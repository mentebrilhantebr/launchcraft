/**
 * Flow submodule - public exports
 *
 * The construction flow logic for the 12 stages of Documento 04. Lives inside
 * ai-engine (Doc 08: "Nunca criar módulos desnecessários" — this is a submodule,
 * not a new top-level module).
 *
 * @module ai-engine/flow
 */

export {
  FLOW_STAGES,
  FIRST_STAGE,
  LAST_STAGE,
  isValidStage,
  getStageMeta,
  type StageMeta,
} from './stages';

export {
  canAdvance,
  canGoBack,
  nextStage,
  previousStage,
  isSequentialAdvance,
} from './stage-machine';

export {
  emptyFlowState,
  readFlowState,
  mergeDecisions,
  recordStageEntry,
  type ProjectDecisions,
  type ProjectFlowState,
  type StageHistoryEntry,
} from './project-state';
