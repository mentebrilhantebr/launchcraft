/**
 * Flow stages metadata
 *
 * Lightweight view over the 12 stages of Documento 04, derived from
 * STAGE_PROMPTS (single source of truth). This exposes just the metadata the
 * flow logic and the API/UI need (number, title, kind), without the full
 * prompt instructions.
 *
 * @module ai-engine/flow/stages
 */

import { STAGE_PROMPTS, TOTAL_STAGES, type StageKind } from '../prompts';

/**
 * Public metadata for a single stage.
 */
export interface StageMeta {
  /** Stage number (1-12). */
  stage: number;
  /** Literal stage title from Documento 04. */
  title: string;
  /** Whether the stage is user-facing or internal. */
  kind: StageKind;
}

/** First stage of the flow (Recepção). */
export const FIRST_STAGE = 1;

/** Last stage of the flow (Finalização). */
export const LAST_STAGE = TOTAL_STAGES;

/**
 * Ordered list of the 12 stages (metadata only), built from STAGE_PROMPTS.
 */
export const FLOW_STAGES: StageMeta[] = Object.values(STAGE_PROMPTS)
  .sort((a, b) => a.stage - b.stage)
  .map(({ stage, title, kind }) => ({ stage, title, kind }));

/**
 * Returns true when `stage` is an integer within the valid 1-12 range.
 */
export function isValidStage(stage: number): boolean {
  return (
    typeof stage === 'number' &&
    Number.isInteger(stage) &&
    stage >= FIRST_STAGE &&
    stage <= LAST_STAGE
  );
}

/**
 * Returns the metadata for a stage, or null when the number is out of range.
 */
export function getStageMeta(stage: number): StageMeta | null {
  if (!isValidStage(stage)) {
    return null;
  }
  const prompt = STAGE_PROMPTS[stage];
  return { stage: prompt.stage, title: prompt.title, kind: prompt.kind };
}
