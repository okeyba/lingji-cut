import { describe, expect, it } from 'vitest';
import {
  createPersistedAIState,
  parsePersistedAIState,
  removeCardsInResult,
  setAllCardsEnabledInResult,
  selectCoverCandidate,
  toggleCardEnabledInResult,
  updateCardInResult,
} from '../src/lib/ai-persistence';
import type { AIAnalysisResult } from '../src/types/ai';

const baseAnalysisResult: AIAnalysisResult = {
  cards: [
    {
      id: 'card-1',
      type: 'summary',
      title: '本期要点',
      content: '重点内容',
      startMs: 0,
      endMs: 45_000,
      displayDurationMs: 5_000,
      displayMode: 'fullscreen',
      template: 'summary-default',
      enabled: true,
      cardPrompt: '做成更像商业海报',
      style: {
        primaryColor: '#6366f1',
        backgroundColor: '#0f172a',
        fontSize: 48,
      },
    },
  ],
  coverPrompts: ['封面提示词'],
  summary: '播客总结',
  keywords: ['AI'],
  globalPrompt: '整体偏商业分析风',
};

describe('AI persistence helpers', () => {
  it('parses the legacy ai-analysis.json shape', () => {
    const persisted = parsePersistedAIState(baseAnalysisResult);

    expect(persisted).toEqual({
      version: 1,
      analysisResult: baseAnalysisResult,
      coverCandidates: [],
    });
  });

  it('round-trips the persisted ai state with cover candidates', () => {
    const persisted = createPersistedAIState(baseAnalysisResult, [
      {
        id: 'cover-1',
        prompt: '播客封面',
        imageUrl: '/tmp/cover-1.png',
        selected: true,
      },
    ]);

    expect(parsePersistedAIState(persisted)).toEqual(persisted);
  });

  it('updates cards and cover selection without mutating the original state', () => {
    const toggled = toggleCardEnabledInResult(baseAnalysisResult, 'card-1');
    const updated = updateCardInResult(toggled, 'card-1', { title: '新的标题' });
    const enabledAll = setAllCardsEnabledInResult(
      {
        ...baseAnalysisResult,
        cards: [
          ...baseAnalysisResult.cards,
          {
            ...baseAnalysisResult.cards[0],
            id: 'card-2',
            enabled: false,
          },
        ],
      },
      true,
    );
    const selected = selectCoverCandidate(
      [
        { id: 'cover-1', prompt: 'A', imageUrl: '/tmp/1.png', selected: false },
        { id: 'cover-2', prompt: 'B', imageUrl: '/tmp/2.png', selected: true },
      ],
      'cover-1',
    );

    expect(baseAnalysisResult.cards[0]?.enabled).toBe(true);
    expect(toggled?.cards[0]?.enabled).toBe(false);
    expect(updated?.cards[0]?.title).toBe('新的标题');
    expect(updated?.cards[0]?.cardPrompt).toBe('做成更像商业海报');
    expect(enabledAll?.cards.every((card) => card.enabled)).toBe(true);
    expect(selected.map((candidate) => candidate.selected)).toEqual([true, false]);
  });

  it('removes cards by id without mutating the original result', () => {
    const resultWithTwoCards: AIAnalysisResult = {
      ...baseAnalysisResult,
      cards: [
        ...baseAnalysisResult.cards,
        {
          ...baseAnalysisResult.cards[0],
          id: 'card-2',
          title: '第二张卡',
        },
      ],
    };

    const removed = removeCardsInResult(resultWithTwoCards, ['card-1']);

    expect(resultWithTwoCards.cards).toHaveLength(2);
    expect(removed?.cards.map((card) => card.id)).toEqual(['card-2']);
  });
});
