import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { Setup } from '../src/pages/Setup';

describe('Setup', () => {
  it('renders import guidance and start action for the first-run flow', () => {
    const html = renderToStaticMarkup(
      <Setup
        busy={false}
        errorMessage={null}
        onComplete={async () => undefined}
      />,
    );

    expect(html).toContain('LOCAL PODCAST VIDEO EDITOR');
    expect(html).toContain('拖入 MP3 口播音频');
    expect(html).toContain('拖入对应 SRT 字幕');
    expect(html).toContain('开始编辑');
  });
});
