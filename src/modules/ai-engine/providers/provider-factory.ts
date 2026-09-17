/**
 * Provider Factory
 *
 * Selects and instantiates the appropriate LLM provider based on environment
 * configuration (LLM_PRIMARY_PROVIDER / LLM_FALLBACK_PROVIDER).
 *
 * @module ai-engine/providers/provider-factory
 */

import { AnthropicProvider } from './anthropic-provider';
import type { LLMProvider } from './base-provider';
import { OpenAIProvider } from './openai-provider';

export type ProviderName = 'openai' | 'anthropic';

// Cache provider instances to avoid recreating SDK clients on every request.
const instances: Partial<Record<ProviderName, LLMProvider>> = {};

/**
 * Normalizes an arbitrary string into a known provider name.
 */
function normalizeProviderName(name?: string): ProviderName {
  const normalized = (name ?? '').trim().toLowerCase();
  if (normalized === 'anthropic') return 'anthropic';
  if (normalized === 'openai') return 'openai';
  // Default to OpenAI when unspecified or unknown.
  return 'openai';
}

/**
 * Returns a cached provider instance for the given name.
 */
export function getProvider(name?: string): LLMProvider {
  const providerName = normalizeProviderName(name);

  if (!instances[providerName]) {
    instances[providerName] =
      providerName === 'anthropic'
        ? new AnthropicProvider()
        : new OpenAIProvider();
  }

  return instances[providerName] as LLMProvider;
}

/**
 * Returns the primary provider (LLM_PRIMARY_PROVIDER, default openai).
 */
export function getPrimaryProvider(): LLMProvider {
  return getProvider(process.env.LLM_PRIMARY_PROVIDER ?? 'openai');
}

/**
 * Returns the fallback provider (LLM_FALLBACK_PROVIDER, default anthropic).
 */
export function getFallbackProvider(): LLMProvider {
  return getProvider(process.env.LLM_FALLBACK_PROVIDER ?? 'anthropic');
}
