import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_VISUAL_TRACK_ID, createDefaultTimeline } from '../src/types';
import {
  prepareTimelineForRemotionRender,
  resolveRemotionAssetSrc,
} from '../src/lib/remotion-assets';

vi.mock('remotion', () => ({
  staticFile: (path: string) => `/static/${path}`,
}));

describe('prepareTimelineForRemotionRender', () => {
  it('rewrites local filesystem media paths into bundled static asset paths', () => {
    const timeline = createDefaultTimeline();
    timeline.podcast.audioPath = '/tmp/audio.mp3';
    timeline.overlays = [
      {
        id: 'overlay-1',
        type: 'image',
        assetPath: '/tmp/cover.png',
        trackId: DEFAULT_VISUAL_TRACK_ID,
        startMs: 0,
        durationMs: 5_000,
        position: { x: 0, y: 0, width: 1920, height: 1080 },
      },
      {
        id: 'overlay-2',
        type: 'video',
        assetPath: 'https://example.com/remote.mp4',
        trackId: DEFAULT_VISUAL_TRACK_ID,
        startMs: 2_000,
        durationMs: 8_000,
        position: { x: 0, y: 0, width: 1920, height: 1080 },
      },
      {
        id: 'overlay-3',
        type: 'image',
        assetPath: '',
        trackId: DEFAULT_VISUAL_TRACK_ID,
        startMs: 4_000,
        durationMs: 5_000,
        position: { x: 0, y: 0, width: 1920, height: 1080 },
        overlayType: 'ai-card',
        aiCardData: {
          sourceCardId: 'card-3',
          cardType: 'summary',
          title: '网页卡片',
          content: '重点内容',
          template: 'summary-default',
          displayMode: 'fullscreen',
          renderMode: 'web-card',
          webCard: {
            src: '/tmp/card-3.html',
          },
          style: {
            primaryColor: '#6366f1',
            backgroundColor: '#0f172a',
            fontSize: 48,
          },
        },
      },
    ];

    const result = prepareTimelineForRemotionRender(timeline);

    expect(result.timeline.podcast.audioPath).toBe('render-assets/audio-0.mp3');
    expect(result.timeline.overlays[0]?.assetPath).toBe('render-assets/overlay-1.png');
    expect(result.timeline.overlays[1]?.assetPath).toBe('https://example.com/remote.mp4');
    expect(result.timeline.overlays[2]?.aiCardData?.webCard?.src).toBe(
      'render-assets/card-3-web-card.html',
    );
    expect(result.assets).toEqual([
      {
        sourcePath: '/tmp/audio.mp3',
        publicPath: 'render-assets/audio-0.mp3',
      },
      {
        sourcePath: '/tmp/cover.png',
        publicPath: 'render-assets/overlay-1.png',
      },
      {
        sourcePath: '/tmp/card-3.html',
        publicPath: 'render-assets/card-3-web-card.html',
      },
    ]);
  });
});

describe('resolveRemotionAssetSrc', () => {
  it('uses staticFile for bundled asset keys and direct URLs for local/remote media', () => {
    expect(resolveRemotionAssetSrc('render-assets/audio-0.mp3')).toBe(
      '/static/render-assets/audio-0.mp3',
    );
    expect(resolveRemotionAssetSrc('/tmp/audio.mp3')).toBe('file:///tmp/audio.mp3');
    expect(resolveRemotionAssetSrc('https://example.com/audio.mp3')).toBe(
      'https://example.com/audio.mp3',
    );
  });
});
