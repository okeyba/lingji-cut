import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { ChatOpenAI } from '@langchain/openai';
import { LMSTUDIO_DEFAULT_BASE_URL, type AISettings, type LLMProvider } from '../../types/ai';
import { ClaudeCodeAcpChatModel } from './claude-code-acp-model';

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, '');
}

function resolveEnableThinking(
  provider: LLMProvider,
  options?: { enableThinking?: boolean },
): boolean {
  if (options && options.enableThinking !== undefined) {
    return options.enableThinking;
  }
  return provider.enableThinking ?? true;
}

function buildModelKwargs(settings: AISettings): Record<string, unknown> | undefined {
  if (settings.enableThinking === false) {
    return {
        enable_thinking: false
    };
  }

  return undefined;
}

export function createChatModel(settings: AISettings): ChatOpenAI {
  const modelKwargs = buildModelKwargs(settings);

  return new ChatOpenAI({
    apiKey: settings.llmApiKey,
    model: settings.llmModel,
    temperature: 0.3,
    configuration: {
      apiKey: settings.llmApiKey,
      baseURL: normalizeBaseUrl(settings.llmBaseUrl),
    },
    ...(modelKwargs ? { modelKwargs } : {}),
  });
}

function createGeminiChatModel(
  provider: LLMProvider,
  model: string,
  options?: { enableThinking?: boolean },
): ChatGoogleGenerativeAI {
  const trimmedBaseUrl = provider.baseUrl?.trim();
  const enableThinking = resolveEnableThinking(provider, options);
  return new ChatGoogleGenerativeAI({
    apiKey: provider.apiKey,
    model,
    temperature: 0.3,
    ...(trimmedBaseUrl ? { baseUrl: normalizeBaseUrl(trimmedBaseUrl) } : {}),
    ...(enableThinking === false ? { thinkingConfig: { thinkingBudget: 0 } } : {}),
  });
}

export function createChatModelFromProvider(
  provider: LLMProvider,
  model: string,
  options?: { enableThinking?: boolean },
): BaseChatModel {
  if (provider.type === 'claude_code_acp') {
    return new ClaudeCodeAcpChatModel({
      model,
    }) as unknown as BaseChatModel;
  }

  if (provider.type === 'gemini') {
    return createGeminiChatModel(provider, model, options);
  }

  const enableThinking = resolveEnableThinking(provider, options);
  // LM Studio 走 OpenAI 兼容端点；apiKey 留空时填充占位值，避免 SDK 抛错
  const isLMStudio = provider.type === 'lmstudio';
  const apiKey = provider.apiKey?.trim() || (isLMStudio ? 'lm-studio' : provider.apiKey);
  const baseURL = normalizeBaseUrl(provider.baseUrl?.trim() || (isLMStudio ? LMSTUDIO_DEFAULT_BASE_URL : provider.baseUrl));

  const modelKwargs =
    enableThinking === false
      ? { enable_thinking: false }
      : undefined;

  return new ChatOpenAI({
    apiKey,
    model,
    temperature: 0.3,
    configuration: {
      apiKey,
      baseURL,
    },
    ...(modelKwargs ? { modelKwargs } : {}),
  });
}
