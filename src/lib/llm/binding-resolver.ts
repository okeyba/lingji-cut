import type {
  AISettings,
  ImageProvider,
  LLMProvider,
  PromptBinding,
  PromptBindingMap,
} from '../../types/ai';
import type { PromptKind } from '../prompts/types';

export type PromptBindingErrorCode =
  | 'PROVIDER_MISSING'
  | 'MODEL_NOT_IN_PROVIDER'
  | 'IMAGE_PROVIDER_MISSING'
  | 'IMAGE_MODEL_NOT_IN_PROVIDER';

export class PromptBindingError extends Error {
  constructor(
    public readonly code: PromptBindingErrorCode,
    public readonly kind: PromptKind,
    message: string,
  ) {
    super(message);
    this.name = 'PromptBindingError';
  }
}

export interface ResolvedBinding {
  provider: LLMProvider;
  model: string;
  imageProvider?: ImageProvider;
  imageModel?: string;
}

function pickFirstNonNull<T>(...values: Array<T | null | undefined>): T | null {
  for (const v of values) {
    if (v !== null && v !== undefined) return v;
  }
  return null;
}

function resolveLlm(
  kind: PromptKind,
  settings: AISettings,
  project: PromptBindingMap | null,
): { provider: LLMProvider; model: string } {
  const projectB: PromptBinding | undefined = project?.[kind];
  const globalB: PromptBinding | undefined = settings.promptBindings?.[kind];

  const providerId = pickFirstNonNull(
    projectB?.providerId,
    globalB?.providerId,
    settings.defaultProviderId,
  );
  const model = pickFirstNonNull(
    projectB?.model,
    globalB?.model,
    settings.defaultModel,
  );

  if (!providerId || !model) {
    throw new PromptBindingError(
      'PROVIDER_MISSING',
      kind,
      `提示词 ${kind} 未绑定 LLM 且无全局默认 Provider/Model`,
    );
  }
  const provider = settings.llmProviders.find((p) => p.id === providerId);
  if (!provider) {
    throw new PromptBindingError(
      'PROVIDER_MISSING',
      kind,
      `提示词 ${kind} 绑定的 Provider ${providerId} 不存在`,
    );
  }
  if (!provider.models.includes(model)) {
    throw new PromptBindingError(
      'MODEL_NOT_IN_PROVIDER',
      kind,
      `提示词 ${kind} 绑定的模型 ${model} 不在 Provider ${provider.name} 的模型列表里`,
    );
  }
  return { provider, model };
}

function resolveImage(
  kind: PromptKind,
  settings: AISettings,
  project: PromptBindingMap | null,
): { imageProvider: ImageProvider; imageModel: string } {
  const projectB = project?.[kind];
  const globalB = settings.promptBindings?.[kind];

  const providerId = pickFirstNonNull(
    projectB?.imageProviderId,
    globalB?.imageProviderId,
    settings.defaultImageProviderId,
  );
  const model = pickFirstNonNull(
    projectB?.imageModel,
    globalB?.imageModel,
    settings.defaultImageModel,
  );

  if (!providerId || !model) {
    throw new PromptBindingError(
      'IMAGE_PROVIDER_MISSING',
      kind,
      `提示词 ${kind} 未绑定 ImageProvider 且无全局默认`,
    );
  }
  const provider = settings.imageProviders.find((p) => p.id === providerId);
  if (!provider) {
    throw new PromptBindingError(
      'IMAGE_PROVIDER_MISSING',
      kind,
      `提示词 ${kind} 绑定的 ImageProvider ${providerId} 不存在`,
    );
  }
  if (!provider.models.includes(model)) {
    throw new PromptBindingError(
      'IMAGE_MODEL_NOT_IN_PROVIDER',
      kind,
      `提示词 ${kind} 绑定的图像模型 ${model} 不在 ImageProvider ${provider.name} 的模型列表里`,
    );
  }
  return { imageProvider: provider, imageModel: model };
}

export function resolvePromptBinding(
  kind: PromptKind,
  settings: AISettings,
  project: PromptBindingMap | null,
): ResolvedBinding {
  const llm = resolveLlm(kind, settings, project);
  if (kind === 'cover.regeneration') {
    const img = resolveImage(kind, settings, project);
    return { ...llm, ...img };
  }
  return llm;
}
