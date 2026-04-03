import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { createDefaultTimeline } from '../src/types';
import { Timeline } from '../src/components/Timeline';

const timeline = createDefaultTimeline();
timeline.podcast.audioPath = '/tmp/podcast.mp3';
timeline.podcast.srtPath = '/tmp/subtitles.srt';
timeline.podcast.durationMs = 12_000;

const timelineState = {
  timeline,
  srtEntries: [
    {
      index: 1,
      startMs: 0,
      endMs: 2_000,
      text: '第一句真实字幕内容',
    },
    {
      index: 2,
      startMs: 2_000,
      endMs: 6_000,
      text: '这是一段特别长特别长特别长的字幕内容，用来验证时间轴里超出宽度后会被隐藏',
    },
  ],
  addOverlay: () => undefined,
  addTrack: () => 'visual-2',
  setGlobalBackground: () => undefined,
};

vi.mock('../src/store/timeline', () => ({
  useTimelineStore: () => timelineState,
}));

describe('Timeline', () => {
  it('renders real subtitle text from srt entries on the subtitle lane', () => {
    const html = renderToStaticMarkup(
      <Timeline currentTimeMs={0} onSeek={() => undefined} compact={false} />,
    );

    expect(html).toContain('第一句真实字幕内容');
    expect(html).toContain('这是一段特别长特别长特别长的字幕内容');
    expect(html).toContain('data-subtitle-entry="subtitle-1"');
    expect(html).toContain('data-subtitle-entry="subtitle-2"');
  });

  it('clips subtitle text when the subtitle block is narrower than the content', () => {
    const html = renderToStaticMarkup(
      <Timeline currentTimeMs={0} onSeek={() => undefined} compact={false} />,
    );

    expect(html).toContain('text-overflow:ellipsis');
    expect(html).toContain('overflow:hidden');
    expect(html).toContain('white-space:nowrap');
  });
});
