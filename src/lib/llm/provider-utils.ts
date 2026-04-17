import type { AISettings, LLMProvider } from '../../types/ai';

function inferProviderName(baseUrl: string): string {
  const lower = baseUrl.toLowerCase();
  if (lower.includes('deepseek')) return 'DeepSeek';
  if (lower.includes('openai')) return 'OpenAI';
  if (lower.includes('anthropic')) return 'Anthropic';
  if (lower.includes('generativelanguage') || lower.includes('gemini')) return 'Gemini';
  if (lower.includes('moonshot') || lower.includes('kimi')) return 'Moonshot';
  if (lower.includes('dashscope') || lower.includes('qwen')) return 'Qwen';
  if (lower.includes('zhipu') || lower.includes('bigmodel')) return 'ZhipuAI';
  try {
    const host = new URL(baseUrl).hostname;
    return host.split('.').slice(-2, -1)[0] ?? 'Custom';
  } catch {
    return 'Custom';
  }
}

function generateId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function migrateToProviders(settings: AISettings): AISettings {
  if (settings.llmProviders && settings.llmProviders.length > 0) {
    return settings;
  }
  if (!settings.llmBaseUrl) {
    return { ...settings, llmProviders: [], defaultProviderId: null, defaultModel: null };
  }
  const provider: LLMProvider = {
    id: generateId(),
    name: inferProviderName(settings.llmBaseUrl),
    type: 'openai_compatible',
    baseUrl: settings.llmBaseUrl,
    apiKey: settings.llmApiKey,
    models: settings.llmModel ? [settings.llmModel] : [],
  };
  return {
    ...settings,
    llmProviders: [provider],
    defaultProviderId: provider.id,
    defaultModel: settings.llmModel || null,
  };
}

export function resolveProvider(
  providers: LLMProvider[],
  providerId: string | null,
  defaultProviderId: string | null,
): LLMProvider | null {
  if (providers.length === 0) return null;
  if (providerId) return providers.find((p) => p.id === providerId) ?? null;
  if (defaultProviderId) return providers.find((p) => p.id === defaultProviderId) ?? null;
  return providers[0];
}
