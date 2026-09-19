/**
 * Stage machine
 *
 * Enforces the navigation rules between the 12 stages of Documento 04.
 *
 * Rule (Doc 04): the flow is sequential — "A IA nunca começa criando páginas
 * imediatamente. Primeiro ela entende. Depois planeja. Depois organiza. Depois
 * constrói." Therefore the user cannot skip stages forward; advancing moves
 * exactly one stage at a time. Going back is allowed (to make adjustments).
 *
 * @module ai-engine/flow/stage-machine
 */

import { FIRST_STAGE, LAST_STAGE, isValidStage } from './stages';

/**
 * Can we advance from `stage` (i.e. it is valid and not the last one)?
 */
export function canAdvance(stage: number): boolean {
  return isValidStage(stage) && stage < LAST_STAGE;
}

/**
 * Can we go back from `stage` (i.e. it is valid and not the first one)?
 */
export function canGoBack(stage: number): boolean {
  return isValidStage(stage) && stage > FIRST_STAGE;
}

/**
 * Returns the next stage, or null when already at the last stage / invalid.
 */
export function nextStage(stage: number): number | null {
  return canAdvance(stage) ? stage + 1 : null;
}

/**
 * Returns the previous stage, or null when already at the first stage / invalid.
 */
export function previousStage(stage: number): number | null {
  return canGoBack(stage) ? stage - 1 : null;
}

/**
 * Validates that a transition from `from` to `to` is a single sequential step
 * forward. Used to reject attempts to skip stages ("nunca pule etapas").
 */
export function isSequentialAdvance(from: number, to: number): boolean {
  return isValidStage(from) && isValidStage(to) && to === from + 1;
}
