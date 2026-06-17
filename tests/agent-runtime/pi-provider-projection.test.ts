import { describe, it, expect } from 'vitest';
import { llmTypeToPiApi, projectProviderToPi } from '../../electron/agent-runtime/pi-provider-projection';
import type { LLMProvider } from '../../src/types/ai';

describe('llmTypeToPiApi', () => {
  it('maps known LLM types to pi api strings', () => {
    expect(llmTypeToPiApi('openai_compatible')).toBe('openai-completions');
    expect(llmTypeToPiApi('lmstudio')).toBe('openai-completions');
    expect(llmTypeToPiApi('minimax')).toBe('openai-completions');
    expect(llmTypeToPiApi('anthropic')).toBe('anthropic-messages');
    expect(llmTypeToPiApi('gemini')).toBe('google-generative-ai');
  });
  it('returns null for claude_code_acp (not projected to pi)', () => {
    expect(llmTypeToPiApi('claude_code_acp')).toBeNull();
  });
});

describe('projectProviderToPi', () => {
  const base: LLMProvider = {
    id: 'p1', name: 'My OpenAI', type: 'openai_compatible',
    baseUrl: 'https://api.example.com/v1', apiKey: 'sk-xxx', models: ['gpt-x', 'gpt-y'],
  };
  it('projects an openai_compatible provider with full per-model schema', () => {
    const out = projectProviderToPi(base);
    expect(out).not.toBeNull();
    expect(out!.entry).toEqual({
      name: 'My OpenAI',
      baseUrl: 'https://api.example.com/v1',
      api: 'openai-completions',
      apiKey: 'sk-xxx',
      models: [
        { id: 'gpt-x', name: 'gpt-x', reasoning: false, input: ['text'], contextWindow: 128000, maxTokens: 8192,
          cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
          compat: { supportsDeveloperRole: false, supportsStore: false, supportsReasoningEffort: false, maxTokensField: 'max_tokens' } },
        { id: 'gpt-y', name: 'gpt-y', reasoning: false, input: ['text'], contextWindow: 128000, maxTokens: 8192,
          cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
          compat: { supportsDeveloperRole: false, supportsStore: false, supportsReasoningEffort: false, maxTokensField: 'max_tokens' } },
      ],
    });
  });
  it('uses provider.id as the pi provider key', () => {
    expect(projectProviderToPi(base)!.key).toBe('p1');
  });
  it('marks reasoning:true and supportsReasoningEffort:true when enableThinking is set', () => {
    const out = projectProviderToPi({ ...base, enableThinking: true });
    expect(out!.entry.models[0].reasoning).toBe(true);
    expect(out!.entry.models[0].compat.supportsReasoningEffort).toBe(true);
  });
  it('skips claude_code_acp providers', () => {
    expect(projectProviderToPi({ ...base, type: 'claude_code_acp' })).toBeNull();
  });
  it('skips providers with empty baseUrl or no models', () => {
    expect(projectProviderToPi({ ...base, baseUrl: '' })).toBeNull();
    expect(projectProviderToPi({ ...base, models: [] })).toBeNull();
  });
  it('skips providers with whitespace-only baseUrl', () => {
    expect(projectProviderToPi({ ...base, baseUrl: '   ' })).toBeNull();
  });
});
