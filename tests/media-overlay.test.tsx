import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MediaOverlay } from '../src/remotion/MediaOverlay';
import type { OverlayItem } from '../src/types';

vi.mock('remotion', () => ({
  Sequence: ({ children }: { children: unknown }) => children,
  useCurrentFrame: () => 0,
  interpolate: (
    value: number,
    inputRange: [number, number],
    outputRange: [number, number],
  ) => {
    const [inputStart, inputEnd] = inputRange;
    const [outputStart, outputEnd] = outputRange;
    if (inputEnd === inputStart) {
      return outputEnd;
    }
    const progress = (value - inputStart) / (inputEnd - inputStart);
    return outputStart + (outputEnd - outputStart) * progress;
  },
  Img: ({ src, style }: { src: string; style: Record<string, unknown> }) => (
    <img src={src} style={style} />
  ),
  OffthreadVideo: ({ src, style }: { src: string; style: Record<string, unknown> }) => (
    <video src={src} style={style} />
  ),
}));

vi.mock('../src/lib/remotion-assets', () => ({
  resolveRemotionAssetSrc: (value: string) => value,
}));

describe('MediaOverlay', () => {
  const baseOverlay: OverlayItem = {
    id: 'image-1',
    type: 'image',
    assetPath: '/tmp/cover.png',
    trackId: 'visual-1',
    startMs: 0,
    durationMs: 5000,
    position: { x: 0, y: 0, width: 1920, height: 1080 },
    motion: {
      enter: 'fadeIn',
      enterDurationMs: 500,
      exit: 'none',
      exitDurationMs: 400,
      loop: 'none',
    },
  };

  it('renders image overlays', () => {
    const html = renderToStaticMarkup(<MediaOverlay overlay={baseOverlay} fps={30} />);
    expect(html).toContain('<img');
    expect(html).toContain('/tmp/cover.png');
  });

  it('applies overlay motion styles to media elements', () => {
    const html = renderToStaticMarkup(<MediaOverlay overlay={baseOverlay} fps={30} />);
    expect(html).toContain('opacity:0');
  });

  it('renders video overlays', () => {
    const html = renderToStaticMarkup(
      <MediaOverlay overlay={{ ...baseOverlay, id: 'video-1', type: 'video', assetPath: '/tmp/intro.mp4' }} fps={30} />,
    );
    expect(html).toContain('<video');
    expect(html).toContain('/tmp/intro.mp4');
  });
});
