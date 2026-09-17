/**
 * Prompt Builder
 *
 * Assembles the full system prompt (base persona + stage context + optional
 * project data) and prepares message arrays for the providers.
 *
 * @module ai-engine/prompts/prompt-builder
 */

import type { Message } from '../providers/base-provider';
import { getStagePrompt } from './stage-prompts';
import { LAUNCHCRAFT_SYSTEM_PROMPT } from './system-prompts';

/**
 * Serializes arbitrary project data into a readable context block.
 * Returns an empty string when there's nothing useful to add.
 */
function formatProjectData(projectData?: Record<string, unknown>): string {
  if (!projectData || Object.keys(projectData).length === 0) {
    return '';
  }

  try {
    const serialized = JSON.stringify(projectData, null, 2);
    return `\n\nDADOS DO PROJETO (contexto já coletado, use como referência):\n${serialized}`;
  } catch {
    return '';
  }
}

/**
 * Builds the complete system prompt combining base persona, current stage
 * guidance and any known project data.
 */
export function buildSystemPrompt(
  stage: number,
  projectData?: Record<string, unknown>
): string {
  const stagePrompt = getStagePrompt(stage);
  const projectContext = formatProjectData(projectData);

  return `${LAUNCHCRAFT_SYSTEM_PROMPT}\n\n${stagePrompt.instructions}${projectContext}`;
}

/**
 * Prepares the ordered array of messages to send to a provider, appending the
 * new user message to the conversation history.
 *
 * Note: the system prompt is passed separately via GenerateOptions.systemPrompt,
 * so it is intentionally not included here.
 */
export function buildMessages(
  conversationHistory: Message[],
  newMessage: string
): Message[] {
  const history = conversationHistory.filter(
    (message) => message.role !== 'system'
  );

  return [...history, { role: 'user', content: newMessage }];
}
