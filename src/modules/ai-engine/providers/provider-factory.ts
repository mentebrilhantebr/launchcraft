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
 *
 * Decisão do usuário (Etapa 5): usar SOMENTE a Anthropic (Claude) como
 * provedor ativo. Por isso o padrão para valores ausentes/desconhecidos é
 * 'anthropic'. O código do OpenAIProvider é mantido intacto para uma eventual
 * reativação futura como fallback.
 */
function normalizeProviderName(name?: string): ProviderName {
  const normalized = (name ?? '').trim().toLowerCase();
  if (normalized === 'anthropic') return 'anthropic';
  if (normalized === 'openai') return 'openai';
  // Default to Anthropic when unspecified or unknown.
  return 'anthropic';
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
 * Returns the primary provider (LLM_PRIMARY_PROVIDER, default anthropic).
 */
export function getPrimaryProvider(): LLMProvider {
  return getProvider(process.env.LLM_PRIMARY_PROVIDER ?? 'anthropic');
}

/**
 * Returns the fallback provider, or null when none is configured.
 *
 * Decisão do usuário (Etapa 5): por padrão NÃO há fallback ativo — apenas a
 * Anthropic está em uso. Um fallback só é usado se LLM_FALLBACK_PROVIDER estiver
 * explicitamente definido no ambiente. Retorna null caso contrário.
 */
export function getFallbackProvider(): LLMProvider | null {
  const configured = (process.env.LLM_FALLBACK_PROVIDER ?? '').trim();
  if (!configured) {
    return null;
  }
  return getProvider(configured);
}
