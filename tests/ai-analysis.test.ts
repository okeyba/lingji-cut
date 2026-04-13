import { describe, expect, it, vi } from 'vitest';
import {
  analyzeSrt,
  buildCoverPromptRegenerationPrompt,
  buildSegmentCardPrompt,
  buildSegmentPlanningPrompt,
  buildSrtText,
  generateCardForSegment,
  planTranscriptSegments,
  regenerateAICard,
  regenerateCoverPrompt,
} from '../src/lib/ai-analysis';
import type { SrtEntry } from '../src/types';
import type { AICard, AISegment, AISettings } from '../src/types/ai';
import { generateStructuredData } from '../src/lib/llm';

const makeSrtEntry = (index: number, startMs: number, endMs: number, text: string): SrtEntry => ({
  index,
  startMs,
  endMs,
  text,
});

const settings: AISettings = {
  llmBaseUrl: 'https://api.openai.com/v1',
  llmApiKey: 'sk-test',
  llmModel: 'gpt-4o-mini',
  jimengApiUrl: '',
  jimengSessionId: '',
};

const baseEntries = [
  makeSrtEntry(1, 0, 3_000, '欢迎收听本期节目，我们先聊 AI 视频生产的背景。'),
  makeSrtEntry(2, 3_000, 7_000, '接下来进入第二部分，重点分析工作流拆分与卡片生成方式。'),
];

const fullTranscript = buildSrtText(baseEntries);

const baseSegment: AISegment = {
  id: 'seg-1',
  title: 'AI 视频生产背景',
  summary: '概括节目开场对 AI 视频生产现状的说明',
  startMs: 0,
  endMs: 3_000,
  transcriptExcerpt: '欢迎收听本期节目，我们先聊 AI 视频生产的背景。',
};

const secondSegment: AISegment = {
  id: 'seg-2',
  title: '工作流拆分',
  summary: '分析为什么要先做 segment planning，再逐段生成卡片',
  startMs: 3_000,
  endMs: 7_000,
  transcriptExcerpt: '接下来进入第二部分，重点分析工作流拆分与卡片生成方式。',
};

const baseCard: AICard = {
  id: 'card-1',
  segmentId: 'seg-1',
  type: 'summary',
  title: '旧标题',
  content: '旧内容',
  startMs: 0,
  endMs: 3_000,
  displayDurationMs: 5_000,
  displayMode: 'fullscreen',
  template: 'summary-default',
  enabled: true,
  style: {
    primaryColor: '#79c4ff',
    backgroundColor: '#151922',
    fontSize: 48,
  },
  cardPrompt: '做成更像商业海报',
};

describe('buildSrtText', () => {
  it('formats subtitle entries into readable timestamped lines', () => {
    const text = buildSrtText(baseEntries);

    expect(text).toContain('[00:00.000 --> 00:03.000]');
    expect(text).toContain('欢迎收听本期节目');
    expect(text).toContain('[00:03.000 --> 00:07.000]');
    expect(text).toContain('重点分析工作流拆分与卡片生成方式');
  });
});

describe('buildSegmentPlanningPrompt', () => {
  it('asks the model to plan segments instead of generating cards directly', () => {
    const prompt = buildSegmentPlanningPrompt('整体偏商业分析风');

    expect(prompt).toContain('segments');
    expect(prompt).toContain('coverPrompts');
    expect(prompt).toContain('整体偏商业分析风');
    expect(prompt).not.toContain('webCard');
    expect(prompt).not.toContain('srcDoc');
  });
});

describe('buildSegmentCardPrompt', () => {
  it('includes full transcript, segment info, and current card cues', () => {
    const prompt = buildSegmentCardPrompt({
      fullTranscript,
      segment: baseSegment,
      globalPrompt: '整体偏商业分析风',
      cardPrompt: '这一张做成更像封面海报',
      currentCard: baseCard,
      programSummary: '节目总结',
      keywords: ['AI', '工作流'],
    });

    expect(prompt).toContain(fullTranscript);
    expect(prompt).toContain('AI 视频生产背景');
    expect(prompt).toContain('概括节目开场对 AI 视频生产现状的说明');
    expect(prompt).toContain('旧标题');
    expect(prompt).toContain('summary-default');
    expect(prompt).toContain('整体偏商业分析风');
    expect(prompt).toContain('这一张做成更像封面海报');
    expect(prompt).toContain('webCard');
    expect(prompt).toContain('统一视觉基线（首次生成与二次重生成都必须遵守）');
  });
});

describe('buildCoverPromptRegenerationPrompt', () => {
  it('requests a single simplified Chinese cover prompt', () => {
    const prompt = buildCoverPromptRegenerationPrompt({
      globalPrompt: '整体偏财经媒体封面',
      currentPrompt: '旧提示词',
    });

    expect(prompt).toContain('只返回 1 条封面提示词');
    expect(prompt).toContain('必须使用简体中文');
    expect(prompt).toContain('旧提示词');
    expect(prompt).toContain('整体偏财经媒体封面');
  });
});

describe('planTranscriptSegments', () => {
  it('plans segments from the full transcript', async () => {
    const modelCaller = vi.fn<typeof generateStructuredData>().mockResolvedValue({
      segments: [baseSegment, secondSegment],
      coverPrompts: ['封面提示词'],
      summary: '节目总结',
      keywords: ['AI', '播客'],
      globalPrompt: '整体偏商业分析风',
    });

    const result = await planTranscriptSegments(baseEntries, settings, {
      generateStructuredData: modelCaller,
      globalPrompt: '整体偏商业分析风',
    });

    expect(result.segments).toHaveLength(2);
    expect(result.segments[0]?.id).toBe('seg-1');
    expect(result.coverPrompts).toEqual(['封面提示词']);
    expect(result.summary).toBe('节目总结');
    expect(result.keywords).toEqual(['AI', '播客']);
    expect(modelCaller).toHaveBeenCalledTimes(1);
    expect(modelCaller.mock.calls[0]?.[2]).toBe(fullTranscript);
  });
});

describe('generateCardForSegment', () => {
  it('generates a single card with full-transcript context and segmentId', async () => {
    const modelCaller = vi.fn<typeof generateStructuredData>().mockResolvedValue({
      id: 'generated-card-1',
      type: 'summary',
      title: '新标题',
      content: '新内容',
      startMs: 100,
      endMs: 2_900,
      displayDurationMs: 5_500,
      displayMode: 'fullscreen',
      template: 'summary-default',
      enabled: true,
      renderMode: 'web-card',
      webCard: {
        srcDoc: '<!doctype html><html><body><h1>新网页卡</h1></body></html>',
      },
      style: {
        primaryColor: '#79c4ff',
        backgroundColor: '#151922',
        fontSize: 48,
      },
    });

    const result = await generateCardForSegment(
      baseEntries,
      {
        segments: [baseSegment],
        coverPrompts: ['封面提示词'],
        summary: '节目总结',
        keywords: ['AI'],
        globalPrompt: '整体偏商业分析风',
      },
      baseSegment,
      settings,
      {
        generateStructuredData: modelCaller,
        globalPrompt: '整体偏商业分析风',
        cardPrompt: '做成更像封面',
        currentCard: baseCard,
      },
    );

    expect(result.segmentId).toBe('seg-1');
    expect(result.title).toBe('新标题');
    expect(result.renderMode).toBe('web-card');
    expect(result.webCard?.srcDoc).toContain('新网页卡');
    expect(modelCaller).toHaveBeenCalledTimes(1);
    expect(modelCaller.mock.calls[0]?.[2]).toBe(fullTranscript);
    expect(modelCaller.mock.calls[0]?.[1]).toContain('AI 视频生产背景');
    expect(modelCaller.mock.calls[0]?.[1]).toContain('旧标题');
  });
});

describe('analyzeSrt', () => {
  it('uses one planning call plus one card-generation call per segment', async () => {
    const modelCaller = vi.fn<typeof generateStructuredData>()
      .mockResolvedValueOnce({
        segments: [baseSegment, secondSegment],
        coverPrompts: ['封面提示词'],
        summary: '节目总结',
        keywords: ['AI', '播客'],
        globalPrompt: '整体偏商业分析风',
      })
      .mockResolvedValueOnce({
        id: 'card-seg-1',
        type: 'summary',
        title: '第一段卡片',
        content: '第一段内容',
        startMs: 0,
        endMs: 3_000,
        displayDurationMs: 5_000,
        displayMode: 'fullscreen',
        template: 'summary-default',
        enabled: true,
        renderMode: 'web-card',
        webCard: {
          srcDoc: '<!doctype html><html><body><div>第一段网页卡片</div></body></html>',
        },
        style: {
          primaryColor: '#79c4ff',
          backgroundColor: '#151922',
          fontSize: 48,
        },
      })
      .mockResolvedValueOnce({
        id: 'card-seg-2',
        type: 'motion',
        title: '第二段卡片',
        content: '第二段内容',
        startMs: 3_000,
        endMs: 7_000,
        displayDurationMs: 5_000,
        displayMode: 'fullscreen',
        template: 'motion-default',
        enabled: true,
        renderMode: 'motion-card',
        cardPrompt: '做一个粒子聚合动画',
        motionCard: {
          sourceCode: 'const MotionComponent = () => React.createElement("div", null, "motion");',
          compiledCode: 'compiled-motion',
          compiledAt: 123,
          prompt: '做一个粒子聚合动画',
          retryCount: 0,
        },
        style: {
          primaryColor: '#7df9ff',
          backgroundColor: '#151922',
          fontSize: 48,
        },
      });

    const result = await analyzeSrt(baseEntries, settings, {
      generateStructuredData: modelCaller,
      globalPrompt: '整体偏商业分析风',
    });

    expect(modelCaller).toHaveBeenCalledTimes(3);
    expect(modelCaller.mock.calls.every((call) => call[2] === fullTranscript)).toBe(true);
    expect(modelCaller.mock.calls[0]?.[1]).toContain('segments');
    expect(modelCaller.mock.calls[1]?.[1]).toContain('AI 视频生产背景');
    expect(modelCaller.mock.calls[2]?.[1]).toContain('工作流拆分');
    expect(result.segments).toHaveLength(2);
    expect(result.cards).toHaveLength(2);
    expect(result.cards.map((card) => card.segmentId)).toEqual(['seg-1', 'seg-2']);
    expect(result.cards[1]?.renderMode).toBe('motion-card');
    expect(result.cards[1]?.motionCard?.compiledCode).toBe('compiled-motion');
    expect(result.coverPrompts).toEqual(['封面提示词']);
    expect(result.keywords).toEqual(['AI', '播客']);
    expect(result.globalPrompt).toBe('整体偏商业分析风');
  });
});

describe('regenerateCoverPrompt', () => {
  it('regenerates exactly one cover prompt and trims extra prompts', async () => {
    const modelCaller = vi.fn().mockResolvedValue({
      coverPrompts: ['新的封面提示词', '不应保留的第二条'],
    });

    const result = await regenerateCoverPrompt(baseEntries, settings, {
      generateStructuredData: modelCaller,
      globalPrompt: '整体偏商业媒体封面',
      currentPrompt: '旧提示词',
    });

    expect(result).toEqual(['新的封面提示词']);
    expect(modelCaller).toHaveBeenCalledTimes(1);
    expect(modelCaller.mock.calls[0]?.[1]).toContain('必须使用简体中文');
    expect(modelCaller.mock.calls[0]?.[1]).toContain('旧提示词');
  });
});

describe('regenerateAICard', () => {
  it('regenerates a single card from the provided segment and preserves card id', async () => {
    const modelCaller = vi.fn<typeof generateStructuredData>().mockResolvedValue({
      id: 'another-id',
      type: 'summary',
      title: '新标题',
      content: '新内容',
      startMs: 100,
      endMs: 2_900,
      displayDurationMs: 6_000,
      displayMode: 'fullscreen',
      template: 'summary-default',
      enabled: true,
      renderMode: 'web-card',
      cardPrompt: '做成更像封面',
      webCard: {
        srcDoc: '<!doctype html><html><body><h1>新网页卡</h1></body></html>',
      },
      style: {
        primaryColor: '#79c4ff',
        backgroundColor: '#151922',
        fontSize: 48,
      },
    });

    const result = await regenerateAICard(
      baseEntries,
      baseCard,
      baseSegment,
      settings,
      {
        generateStructuredData: modelCaller,
        globalPrompt: '整体偏商业分析风',
      },
    );

    expect(result.id).toBe('card-1');
    expect(result.segmentId).toBe('seg-1');
    expect(result.title).toBe('新标题');
    expect(result.displayDurationMs).toBe(6_000);
    expect(result.renderMode).toBe('web-card');
    expect(result.webCard?.srcDoc).toContain('新网页卡');
    expect(modelCaller).toHaveBeenCalledTimes(1);
    expect(modelCaller.mock.calls[0]?.[2]).toBe(fullTranscript);
    expect(modelCaller.mock.calls[0]?.[1]).toContain('AI 视频生产背景');
    expect(modelCaller.mock.calls[0]?.[1]).toContain('summary-default');
  });

  it('fails fast when segment is missing', async () => {
    await expect(
      regenerateAICard(
        baseEntries,
        baseCard,
        null as unknown as AISegment,
        settings,
        {
          generateStructuredData: vi.fn(),
        },
      ),
    ).rejects.toThrow('缺少卡片对应的段落信息');
  });
});
