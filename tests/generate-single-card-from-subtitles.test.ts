import { describe, expect, it, vi } from 'vitest';
import { generateSingleCardFromSubtitles } from '../src/lib/ai-analysis';
import type { SrtEntry } from '../src/types';
import type { AISettings } from '../src/types/ai';
import { generateStructuredData } from '../src/lib/llm';

const settings: AISettings = {
  llmBaseUrl: 'https://api.openai.com/v1',
  llmApiKey: 'sk-test',
  llmModel: 'gpt-4o-mini',
  jimengApiUrl: '',
  jimengSessionId: '',
} as AISettings;

const entries: SrtEntry[] = [
  { index: 1, startMs: 0, endMs: 1_500, text: '第一条字幕。' },
  { index: 2, startMs: 1_500, endMs: 3_000, text: '第二条字幕，比较重要。' },
];

const webCardResponse = {
  id: 'generated-card',
  type: 'summary',
  title: '摘要卡',
  content: '重点内容',
  startMs: 500,
  endMs: 2_500,
  displayDurationMs: 2_000,
  displayMode: 'fullscreen',
  template: 'summary-default',
  enabled: true,
  renderMode: 'web-card',
  webCard: {
    srcDoc: '<!doctype html><html><body><h1>测试</h1></body></html>',
  },
  style: {
    primaryColor: '#79c4ff',
    backgroundColor: '#151922',
    fontSize: 48,
  },
};

describe('generateSingleCardFromSubtitles', () => {
  it('returns a single web-card and forces timing from draft', async () => {
    const modelCaller = vi
      .fn<typeof generateStructuredData>()
      .mockResolvedValue(webCardResponse);

    const card = await generateSingleCardFromSubtitles(
      entries,
      {
        text: '手动选段文本',
        startMs: 500,
        endMs: 3_000,
        displayDurationMs: 2_500,
        type: 'summary',
        promptHint: '突出核心数字',
      },
      settings,
      { generateStructuredData: modelCaller },
    );

    expect(card.renderMode).toBe('web-card');
    expect(card.startMs).toBe(500);
    expect(card.endMs).toBe(3_000);
    expect(card.displayDurationMs).toBe(2_500);
    expect(card.webCard?.srcDoc).toContain('测试');
    expect(modelCaller).toHaveBeenCalledTimes(1);
    const systemPrompt = modelCaller.mock.calls[0]?.[1] ?? '';
    expect(systemPrompt).toContain('突出核心数字');
    expect(systemPrompt).toContain('web-card');
  });

  it('rejects empty text draft', async () => {
    await expect(
      generateSingleCardFromSubtitles(
        entries,
        {
          text: '   ',
          startMs: 0,
          endMs: 1_000,
          displayDurationMs: 1_000,
          type: 'summary',
        },
        settings,
        { generateStructuredData: vi.fn() },
      ),
    ).rejects.toThrow('字幕内容为空');
  });

  it('rejects invalid time range', async () => {
    await expect(
      generateSingleCardFromSubtitles(
        entries,
        {
          text: 'ok',
          startMs: 1_000,
          endMs: 1_000,
          displayDurationMs: 2_000,
          type: 'summary',
        },
        settings,
        { generateStructuredData: vi.fn() },
      ),
    ).rejects.toThrow('时间范围无效');
  });

  it('throws when LLM returns non-web-card', async () => {
    const modelCaller = vi.fn<typeof generateStructuredData>().mockResolvedValue({
      ...webCardResponse,
      renderMode: 'legacy',
      webCard: undefined,
    });

    await expect(
      generateSingleCardFromSubtitles(
        entries,
        {
          text: '有效文本',
          startMs: 0,
          endMs: 2_000,
          displayDurationMs: 2_000,
          type: 'insight',
        },
        settings,
        { generateStructuredData: modelCaller },
      ),
    ).rejects.toThrow('web-card');
  });

  it('rejects invalid card type', async () => {
    await expect(
      generateSingleCardFromSubtitles(
        entries,
        {
          text: 'ok',
          startMs: 0,
          endMs: 1_000,
          displayDurationMs: 1_000,
          // @ts-expect-error intentional invalid
          type: 'nonsense',
        },
        settings,
        { generateStructuredData: vi.fn() },
      ),
    ).rejects.toThrow('卡片类型无效');
  });
});
