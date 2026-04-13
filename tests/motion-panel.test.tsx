import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MotionPanel } from '../src/components/MotionPanel';

const mockModules = vi.hoisted(() => ({
  aiStoreState: {
    motionCards: [],
    addMotionCard: () => undefined,
    updateMotionCard: () => undefined,
    removeMotionCard: () => undefined,
    isGeneratingMotion: false,
    setGeneratingMotion: () => undefined,
    motionError: null as string | null,
    setMotionError: () => undefined,
  },
  timelineState: {
    addAICardsToTimeline: () => undefined,
  },
}));

vi.mock('../src/store/ai', () => ({
  useAIStore: () => mockModules.aiStoreState,
  loadAISettings: () => null,
}));

vi.mock('../src/store/timeline', () => ({
  useTimelineStore: () => mockModules.timelineState,
}));

describe('MotionPanel', () => {
  it('renders built-in animation examples for quick start', () => {
    const html = renderToStaticMarkup(<MotionPanel />);

    expect(html).toContain('快速开始');
    expect(html).toContain('飞入柱状图');
    expect(html).toContain('数字翻牌');
    expect(html).toContain('Logo 光晕');
    expect(html).toContain('波形呼吸');
  });
});
