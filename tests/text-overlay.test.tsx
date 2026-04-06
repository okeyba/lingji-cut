import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { TextOverlay } from '../src/remotion/TextOverlay';
import { createDefaultTextData } from '../src/lib/text-templates';
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
}));

const mockOverlay: OverlayItem = {
  id: 'text-1',
  type: 'text',
  assetPath: '',
  trackId: 'visual-1',
  startMs: 0,
  durationMs: 5000,
  position: { x: 100, y: 200, width: 800, height: 200 },
  motion: {
    enter: 'none',
    enterDurationMs: 400,
    exit: 'none',
    exitDurationMs: 400,
    loop: 'none',
  },
  textData: createDefaultTextData({ content: '测试文字' }),
};

describe('TextOverlay', () => {
  it('renders text content', () => {
    const html = renderToStaticMarkup(
      <TextOverlay overlay={mockOverlay} fps={30} />,
    );
    expect(html).toContain('测试文字');
  });

  it('returns null when textData is missing', () => {
    const noTextOverlay: OverlayItem = {
      ...mockOverlay,
      textData: undefined,
    };
    const html = renderToStaticMarkup(
      <TextOverlay overlay={noTextOverlay} fps={30} />,
    );
    expect(html).toBe('');
  });

  it('applies bold style', () => {
    const boldOverlay: OverlayItem = {
      ...mockOverlay,
      textData: createDefaultTextData({ content: 'Bold', bold: true }),
    };
    const html = renderToStaticMarkup(
      <TextOverlay overlay={boldOverlay} fps={30} />,
    );
    expect(html).toContain('font-weight:bold');
  });

  it('applies stroke when strokeWidth > 0', () => {
    const strokeOverlay: OverlayItem = {
      ...mockOverlay,
      textData: createDefaultTextData({
        content: 'Stroke',
        strokeColor: '#FF0000',
        strokeWidth: 2,
      }),
    };
    const html = renderToStaticMarkup(
      <TextOverlay overlay={strokeOverlay} fps={30} />,
    );
    expect(html).toContain('2px #FF0000');
  });

  it('prefers overlay motion over legacy text animation fields', () => {
    const animatedOverlay: OverlayItem = {
      ...mockOverlay,
      motion: {
        enter: 'slideInLeft',
        enterDurationMs: 500,
        exit: 'none',
        exitDurationMs: 400,
        loop: 'none',
      },
      textData: createDefaultTextData({
        content: 'Motion First',
        animation: {
          enter: 'none',
          enterDurationMs: 500,
          exit: 'none',
          exitDurationMs: 500,
          loop: 'none',
        },
      }),
    };

    const html = renderToStaticMarkup(
      <TextOverlay overlay={animatedOverlay} fps={30} />,
    );

    expect(html).toContain('translateX');
  });
});
