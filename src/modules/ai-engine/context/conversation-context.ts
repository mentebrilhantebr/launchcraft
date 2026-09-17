/**
 * Conversation Context
 *
 * Loads and persists conversation state from the database (Prisma).
 * Messages are stored as JSONB arrays of { role, content, timestamp } inside
 * the Conversations table, one row per project stage.
 *
 * @module ai-engine/context/conversation-context
 */

import { prisma } from '@/modules/database';
import type { Message, MessageRole } from '../providers/base-provider';

/**
 * A stored message including a timestamp (persisted shape).
 */
export interface StoredMessage {
  role: MessageRole;
  content: string;
  timestamp: string;
}

/**
 * Full context needed to run a chat turn for a project.
 */
export interface ConversationContext {
  projectId: string;
  userId: string;
  stage: number;
  messages: Message[];
  projectData: Record<string, unknown> | null;
}

/**
 * Type guard for a single stored message coming from JSONB.
 */
function isStoredMessage(value: unknown): value is StoredMessage {
  if (typeof value !== 'object' || value === null) return false;
  const record = value as Record<string, unknown>;
  return (
    (record.role === 'system' ||
      record.role === 'user' ||
      record.role === 'assistant') &&
    typeof record.content === 'string'
  );
}

/**
 * Safely parses a JSONB value into an array of stored messages.
 */
function parseMessages(value: unknown): StoredMessage[] {
  if (!Array.isArray(value)) return [];
  const result: StoredMessage[] = [];
  for (const item of value) {
    if (isStoredMessage(item)) {
      result.push({
        role: item.role,
        content: item.content,
        timestamp:
          typeof (item as StoredMessage).timestamp === 'string'
            ? (item as StoredMessage).timestamp
            : new Date().toISOString(),
      });
    }
  }
  return result;
}

/**
 * Loads the full conversation context for a project, verifying ownership.
 *
 * @throws {Error} When the project doesn't exist or doesn't belong to the user.
 */
export async function loadContext(
  projectId: string,
  userId: string
): Promise<ConversationContext> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      id: true,
      userId: true,
      currentStage: true,
      outputData: true,
      conversations: {
        orderBy: { createdAt: 'asc' },
        select: { messages: true },
      },
    },
  });

  if (!project) {
    throw new Error('Projeto não encontrado.');
  }

  if (project.userId !== userId) {
    throw new Error('Você não tem acesso a este projeto.');
  }

  // Flatten all stored messages across the project's conversations in order.
  const messages: Message[] = [];
  for (const conversation of project.conversations) {
    for (const stored of parseMessages(conversation.messages)) {
      messages.push({ role: stored.role, content: stored.content });
    }
  }

  return {
    projectId: project.id,
    userId: project.userId,
    stage: project.currentStage,
    messages,
    projectData:
      project.outputData && typeof project.outputData === 'object'
        ? (project.outputData as Record<string, unknown>)
        : null,
  };
}

/**
 * Appends a message to the project's conversation for its current stage,
 * creating the conversation row if it doesn't exist yet.
 */
export async function saveMessage(
  projectId: string,
  role: 'user' | 'assistant',
  content: string
): Promise<void> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true, userId: true, currentStage: true },
  });

  if (!project) {
    throw new Error('Projeto não encontrado.');
  }

  const newMessage: StoredMessage = {
    role,
    content,
    timestamp: new Date().toISOString(),
  };

  // Find the conversation for the current stage (most recent one).
  const existing = await prisma.conversation.findFirst({
    where: { projectId: project.id, stage: project.currentStage },
    orderBy: { createdAt: 'desc' },
    select: { id: true, messages: true },
  });

  if (existing) {
    const current = parseMessages(existing.messages);
    current.push(newMessage);
    await prisma.conversation.update({
      where: { id: existing.id },
      data: { messages: current as unknown as object[] },
    });
    return;
  }

  await prisma.conversation.create({
    data: {
      projectId: project.id,
      userId: project.userId,
      stage: project.currentStage,
      messages: [newMessage] as unknown as object[],
    },
  });
}
