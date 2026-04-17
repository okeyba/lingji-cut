import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { LLMProvider } from '../src/types/ai';

const { chatOpenAIMock, chatGoogleMock } = vi.hoisted(() => ({
  chatOpenAIMock: vi.fn().mockImplementation(() => ({ invoke: vi.fn(), stream: vi.fn() })),
  chatGoogleMock: vi.fn().mockImplementation(() => ({ invoke: vi.fn(), stream: vi.fn() })),
}));

vi.mock('@langchain/openai', () => ({ ChatOpenAI: chatOpenAIMock }));
vi.mock('@langchain/google-genai', () => ({ ChatGoogleGenerativeAI: chatGoogleMock }));

import { createChatModelFromProvider } from '../src/lib/llm/model';

function makeProvider(overrides: Partial<LLMProvider> = {}): LLMProvider {
  return {
    id: 'p1',
    name: 'Test',
    type: 'gemini',
    baseUrl: '',
    apiKey: 'api-key',
    models: ['gemini-2.5-pro'],
    ...overrides,
  };
}

describe('createChatModelFromProvider', () => {
  beforeEach(() => {
    chatOpenAIMock.mockClear();
    chatGoogleMock.mockClear();
  });

  it('dispatches to Gemini with default endpoint when baseUrl is empty', () => {
    createChatModelFromProvider(makeProvider(), 'gemini-2.5-pro');

    expect(chatOpenAIMock).not.toHaveBeenCalled();
    expect(chatGoogleMock).toHaveBeenCalledTimes(1);
    const config = chatGoogleMock.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(config).toMatchObject({
      apiKey: 'api-key',
      model: 'gemini-2.5-pro',
      temperature: 0.3,
    });
    expect(config.baseUrl).toBeUndefined();
    expect(config.thinkingConfig).toBeUndefined();
  });

  it('passes a normalized custom Gemini baseUrl when provided', () => {
    createChatModelFromProvider(
      makeProvider({ baseUrl: 'https://proxy.example.com/v1/' }),
      'gemini-2.5-flash',
    );

    const config = chatGoogleMock.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(config.baseUrl).toBe('https://proxy.example.com/v1');
  });

  it('disables Gemini thinking via thinkingConfig.thinkingBudget when enableThinking=false', () => {
    createChatModelFromProvider(makeProvider(), 'gemini-2.5-pro', { enableThinking: false });

    const config = chatGoogleMock.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(config.thinkingConfig).toEqual({ thinkingBudget: 0 });
  });

  it('dispatches to ChatOpenAI for openai_compatible providers', () => {
    createChatModelFromProvider(
      makeProvider({
        type: 'openai_compatible',
        baseUrl: 'https://api.openai.com/v1',
      }),
      'gpt-4o-mini',
    );

    expect(chatGoogleMock).not.toHaveBeenCalled();
    expect(chatOpenAIMock).toHaveBeenCalledTimes(1);
  });
});
