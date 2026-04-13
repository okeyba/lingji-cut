import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MotionCardOverlay } from '../src/remotion/MotionCardOverlay';
import type { MotionCardPayload } from '../src/types/ai';

vi.mock('remotion', () => ({
  useCurrentFrame: () => 5,
  useVideoConfig: () => ({
    fps: 30,
    durationInFrames: 150,
    width: 1920,
    height: 1080,
  }),
}));

const baseMotionCard: MotionCardPayload = {
  sourceCode: '',
  compiledCode: '',
  compiledAt: 0,
  prompt: '',
  retryCount: 0,
};

describe('MotionCardOverlay', () => {
  it('renders the generated component body', () => {
    const payload = {
      ...baseMotionCard,
      compiledCode: `
const MotionComponent = ({ frame }) => {
  return React.createElement('div', null, 'frame:' + frame);
};
`,
    };

    const html = renderToStaticMarkup(<MotionCardOverlay motionCard={payload} />);

    expect(html).toContain('frame:5');
  });

  it('shows a fallback when MotionComponent is undefined', () => {
    const payload = {
      ...baseMotionCard,
      compiledCode: "const NotMotionComponent = () => null;",
    };

    const html = renderToStaticMarkup(<MotionCardOverlay motionCard={payload} />);

    expect(html).toContain('动画渲染失败');
    expect(html).toContain('MotionComponent');
  });

});
