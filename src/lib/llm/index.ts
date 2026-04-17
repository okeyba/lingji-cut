import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import type { AISettings, LLMProvider } from '../../types/ai';
import type { ResolvedBinding } from './binding-resolver';
import {
  extractReasoningContent,
  extractTextContent,
  parseLLMJsonResponse,
  parseStructuredOutput,
} from './content';
import { createChatModel, createChatModelFromProvider } from './model';

export interface StreamCallbacks {
  onReasoningChunk?: (chunk: string) => void;
}

export { parseLLMJsonResponse };

function buildPromptMessages(systemPrompt: string, userMessage: string) {
  return [new SystemMessage(systemPrompt), new HumanMessage(userMessage)];
}

function assertNonEmptyContent(content: string, message: string): string {
  if (!content) {
    throw new Error(message);
  }

  return content;
}

function pickModel(settings: AISettings, binding?: ResolvedBinding) {
  if (binding) {
    return createChatModelFromProvider(binding.provider, binding.model, {
      enableThinking: settings.enableThinking,
    });
  }
  return createChatModel(settings);
}

export async function generateStructuredData(
  settings: AISettings,
  systemPrompt: string,
  userMessage: string,
  binding?: ResolvedBinding,
): Promise<Record<string, unknown>> {
  const chatModel = pickModel(settings, binding) as ReturnType<typeof createChatModel> & {
    bind?: (kwargs: Record<string, unknown>) => {
      invoke: (messages: unknown[]) => Promise<{ content: unknown }>;
    };
  };
  const model =
    typeof chatModel.bind === 'function'
      ? chatModel.bind({
          response_format: { type: 'json_object' },
        })
      : chatModel;
  const response = await model.invoke(buildPromptMessages(systemPrompt, userMessage));
  const content = assertNonEmptyContent(extractTextContent(response.content), 'LLM 返回空内容');
  return parseStructuredOutput(content);
}

export async function generateText(
  settings: AISettings,
  systemPrompt: string,
  userMessage: string,
  binding?: ResolvedBinding,
): Promise<string> {
  const response = await pickModel(settings, binding).invoke(
    buildPromptMessages(systemPrompt, userMessage),
  );

  return assertNonEmptyContent(extractTextContent(response.content), 'LLM 返回空内容');
}

export async function streamText(
  settings: AISettings,
  systemPrompt: string,
  userMessage: string,
  onChunk: (chunk: string) => void,
  callbacks?: StreamCallbacks,
  binding?: ResolvedBinding,
): Promise<string> {
  const stream = await pickModel(settings, binding).stream(
    buildPromptMessages(systemPrompt, userMessage),
  );
  let fullText = '';

  for await (const chunk of stream) {
    const reasoningChunk = extractReasoningContent(chunk);
    if (reasoningChunk) {
      callbacks?.onReasoningChunk?.(reasoningChunk);
    }

    const textChunk = extractTextContent(chunk.content);
    if (!textChunk) {
      continue;
    }

    fullText += textChunk;
    onChunk(textChunk);
  }

  return assertNonEmptyContent(fullText, 'LLM 流式返回空内容');
}

export async function streamTextWithProvider(
  provider: LLMProvider,
  model: string,
  systemPrompt: string,
  userMessage: string,
  onChunk: (chunk: string) => void,
  options?: { enableThinking?: boolean } & StreamCallbacks,
): Promise<string> {
  const chatModel = createChatModelFromProvider(provider, model, {
    enableThinking: options?.enableThinking,
  });
  const stream = await chatModel.stream(buildPromptMessages(systemPrompt, userMessage));
  let fullText = '';

  for await (const chunk of stream) {
    const reasoningChunk = extractReasoningContent(chunk);
    if (reasoningChunk) {
      options?.onReasoningChunk?.(reasoningChunk);
    }
    const textChunk = extractTextContent(chunk.content);
    if (!textChunk) continue;
    fullText += textChunk;
    onChunk(textChunk);
  }

  return assertNonEmptyContent(fullText, 'LLM 流式返回空内容');
}
