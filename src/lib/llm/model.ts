import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { ChatOpenAI } from '@langchain/openai';
import type { AISettings, LLMProvider } from '../../types/ai';

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, '');
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
  return new ChatGoogleGenerativeAI({
    apiKey: provider.apiKey,
    model,
    temperature: 0.3,
    ...(trimmedBaseUrl ? { baseUrl: normalizeBaseUrl(trimmedBaseUrl) } : {}),
    ...(options?.enableThinking === false ? { thinkingConfig: { thinkingBudget: 0 } } : {}),
  });
}

export function createChatModelFromProvider(
  provider: LLMProvider,
  model: string,
  options?: { enableThinking?: boolean },
): BaseChatModel {
  if (provider.type === 'gemini') {
    return createGeminiChatModel(provider, model, options);
  }

  const modelKwargs =
    options?.enableThinking === false
      ? { enable_thinking: false }
      : undefined;

  return new ChatOpenAI({
    apiKey: provider.apiKey,
    model,
    temperature: 0.3,
    configuration: {
      apiKey: provider.apiKey,
      baseURL: normalizeBaseUrl(provider.baseUrl),
    },
    ...(modelKwargs ? { modelKwargs } : {}),
  });
}
