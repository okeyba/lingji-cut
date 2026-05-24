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

const VALID_MOTION_SOURCE = 'const MotionComponent = (props) => null;';

const motionCardResponse = {
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
  renderMode: 'motion-card',
  motionCard: { sourceCode: VALID_MOTION_SOURCE },
  style: {
    primaryColor: '#79c4ff',
    backgroundColor: '#151922',
    fontSize: 48,
  },
};

describe('generateSingleCardFromSubtitles', () => {
  it('returns a single compiled motion-card and forces timing from draft', async () => {
    const modelCaller = vi
      .fn<typeof generateStructuredData>()
      .mockResolvedValue(motionCardResponse);

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

    expect(card.renderMode).toBe('motion-card');
    expect(card.startMs).toBe(500);
    expect(card.endMs).toBe(3_000);
    expect(card.displayDurationMs).toBe(2_500);
    expect(card.motionCard?.sourceCode).toContain('MotionComponent');
    expect(card.motionCard?.compiledCode.length).toBeGreaterThan(0);
    expect(modelCaller).toHaveBeenCalledTimes(1);
    const systemPrompt = modelCaller.mock.calls[0]?.[1] ?? '';
    expect(systemPrompt).toContain('突出核心数字');
    expect(systemPrompt).toContain('motion-card');
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

  it('throws a "请重新生成" error when motion sourceCode does not compile', async () => {
    const modelCaller = vi.fn<typeof generateStructuredData>().mockResolvedValue({
      ...motionCardResponse,
      motionCard: { sourceCode: 'garbage that cannot compile' },
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
    ).rejects.toThrow(/请重新生成/);
  });

  it('creates a fallback motion-card when the model omits motionCard', async () => {
    const modelCaller = vi.fn<typeof generateStructuredData>().mockResolvedValue({
      ...motionCardResponse,
      title: '真实流程测试卡',
      content: '缺少源码时也应生成可播放的兜底 Motion。',
      motionCard: undefined,
    });

    const card = await generateSingleCardFromSubtitles(
      entries,
      {
        text: 'AI 创作测试：国产存储周期正在被价格、产能与先进封装同时重写。',
        startMs: 0,
        endMs: 3_000,
        displayDurationMs: 3_000,
        type: 'insight',
      },
      settings,
      { generateStructuredData: modelCaller },
    );

    expect(card.renderMode).toBe('motion-card');
    expect(card.title).toBe('真实流程测试卡');
    expect(card.motionCard?.sourceCode).toContain('const MotionComponent');
    expect(card.motionCard?.compiledCode).toContain('React.createElement');
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
