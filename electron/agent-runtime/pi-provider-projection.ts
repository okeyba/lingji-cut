import type { LLMProvider } from '../../src/types/ai';

export interface PiModelEntry {
  id: string;
  name: string;
  reasoning: boolean;
  input: string[];
  contextWindow: number;
  maxTokens: number;
  cost: { input: number; output: number; cacheRead: number; cacheWrite: number };
  compat: { supportsDeveloperRole: boolean; supportsStore: boolean; supportsReasoningEffort: boolean; maxTokensField: string };
}

export interface PiProviderEntry {
  name: string;
  baseUrl: string;
  api: string;
  apiKey: string;
  models: PiModelEntry[];
}

export function llmTypeToPiApi(type: LLMProvider['type']): string | null {
  switch (type) {
    case 'openai_compatible':
    case 'lmstudio':
    case 'minimax':
      return 'openai-completions';
    case 'anthropic':
      return 'anthropic-messages';
    case 'gemini':
      return 'google-generative-ai';
    case 'claude_code_acp':
      return null;
    default:
      return null;
  }
}

const DEFAULT_CONTEXT_WINDOW = 128000;
const DEFAULT_MAX_TOKENS = 8192;

function toModelEntry(modelId: string, reasoning: boolean): PiModelEntry {
  return {
    id: modelId,
    name: modelId,
    reasoning,
    input: ['text'],
    contextWindow: DEFAULT_CONTEXT_WINDOW,
    maxTokens: DEFAULT_MAX_TOKENS,
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    compat: { supportsDeveloperRole: false, supportsStore: false, supportsReasoningEffort: reasoning, maxTokensField: 'max_tokens' },
  };
}

export function projectProviderToPi(
  provider: LLMProvider,
): { key: string; entry: PiProviderEntry } | null {
  const api = llmTypeToPiApi(provider.type);
  if (!api) return null;
  if (!provider.baseUrl.trim()) return null;
  if (!provider.models || provider.models.length === 0) return null;
  // pi's per-model `reasoning` is a *capability* flag; we deliberately opt-in
  // only when the user has explicitly enabled thinking (`=== true`).  Defaulting
  // to true would cause pi to send `reasoning_effort` to models that don't
  // support it.  This diverges intentionally from `LLMProvider.enableThinking`'s
  // "缺省视为 true" runtime-toggle semantics — here absence means "not requested".
  const reasoning = provider.enableThinking === true;
  return {
    key: provider.id,
    entry: {
      name: provider.name,
      baseUrl: provider.baseUrl,
      api,
      apiKey: provider.apiKey,
      models: provider.models.map((m) => toModelEntry(m, reasoning)),
    },
  };
}
