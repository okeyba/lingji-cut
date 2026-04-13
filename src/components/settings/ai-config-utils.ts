import type { LLMProvider } from '../../types/ai';

export interface ProviderDraftErrors {
  name?: string;
  baseUrl?: string;
  apiKey?: string;
  models?: string;
}

interface AIConfigSnapshotInput {
  providers: LLMProvider[];
  defaultProviderId: string | null;
  defaultModel: string | null;
  enableThinking: boolean;
  jimengApiUrl: string;
  jimengSessionId: string;
  jimengModel: string;
}

export function normalizeProviderDraft(provider: LLMProvider): LLMProvider {
  return {
    ...provider,
    name: provider.name.trim(),
    baseUrl: provider.baseUrl.trim(),
    apiKey: provider.apiKey.trim(),
    models: provider.models
      .map((model) => model.trim())
      .filter((model, index, list) => model.length > 0 && list.indexOf(model) === index),
  };
}

export function normalizeProviderDrafts(providers: LLMProvider[]): LLMProvider[] {
  return providers.map(normalizeProviderDraft);
}

export function validateProviderDraft(provider: LLMProvider): ProviderDraftErrors {
  const normalized = normalizeProviderDraft(provider);
  const errors: ProviderDraftErrors = {};

  if (!normalized.name) {
    errors.name = '请输入 Provider 名称';
  }

  if (!normalized.baseUrl) {
    errors.baseUrl = '请输入 Base URL';
  }

  if (!normalized.apiKey) {
    errors.apiKey = '请输入 API Key';
  }

  if (normalized.models.length === 0) {
    errors.models = '请至少添加一个模型';
  }

  return errors;
}

export function normalizeProviderSelection(
  providers: LLMProvider[],
  preferredDefaultProviderId: string | null,
  preferredDefaultModel: string | null,
): { defaultProviderId: string | null; defaultModel: string | null } {
  if (providers.length === 0) {
    return { defaultProviderId: null, defaultModel: null };
  }

  const normalizedProviders = normalizeProviderDrafts(providers);
  const activeProvider =
    normalizedProviders.find((provider) => provider.id === preferredDefaultProviderId) ??
    normalizedProviders[0];

  const defaultModel =
    activeProvider.models.find((model) => model === preferredDefaultModel) ??
    activeProvider.models[0] ??
    null;

  return {
    defaultProviderId: activeProvider.id,
    defaultModel,
  };
}

export function createAIConfigSnapshot({
  providers,
  defaultProviderId,
  defaultModel,
  enableThinking,
  jimengApiUrl,
  jimengSessionId,
  jimengModel,
}: AIConfigSnapshotInput): string {
  const normalizedProviders = normalizeProviderDrafts(providers);
  const selection = normalizeProviderSelection(
    normalizedProviders,
    defaultProviderId,
    defaultModel,
  );

  return JSON.stringify({
    providers: normalizedProviders,
    defaultProviderId: selection.defaultProviderId,
    defaultModel: selection.defaultModel,
    enableThinking,
    jimengApiUrl: jimengApiUrl.trim(),
    jimengSessionId: jimengSessionId.trim(),
    jimengModel: jimengModel.trim(),
  });
}

export function hasUnsavedAIConfigChanges(
  lastSavedSnapshot: string,
  currentSnapshot: string,
): boolean {
  return lastSavedSnapshot !== currentSnapshot;
}
