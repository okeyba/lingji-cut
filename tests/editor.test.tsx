import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { Editor } from '../src/pages/Editor';

vi.mock('../src/hooks/useViewportSize', () => ({
  useViewportSize: () => ({ width: 1440, height: 900 }),
}));

vi.mock('../src/components/PreviewPanel', () => ({
  PreviewPanel: () => <div>preview-panel</div>,
}));

vi.mock('../src/components/Timeline', () => ({
  Timeline: () => <div>timeline-panel</div>,
}));

vi.mock('../src/components/AssetPanel', () => ({
  AssetPanel: () => <div>asset-panel</div>,
}));

vi.mock('../src/components/AIPanel', () => ({
  AIPanel: () => <div>ai-panel</div>,
}));

vi.mock('../src/components/ExportProgress', () => ({
  ExportProgress: () => null,
}));

vi.mock('../src/components/ExportSettingsModal', () => ({
  ExportSettingsModal: () => null,
}));

vi.mock('../src/store/timeline', () => ({
  useTimelineStore: () => ({
    timeline: {
      fps: 30,
      width: 1920,
      height: 1080,
      podcast: {
        durationMs: 60_000,
      },
    },
  }),
}));

describe('Editor', () => {
  it('renders sidebar tabs for assets and the ai assistant', () => {
    const html = renderToStaticMarkup(
      <Editor onAddAsset={async () => undefined} exportRequestToken={0} />,
    );

    expect(html).toContain('素材');
    expect(html).toContain('AI 助手');
  });

  it('clips the timeline row so the lower panel shadow cannot overlap the sidebar footer', () => {
    const html = renderToStaticMarkup(
      <Editor onAddAsset={async () => undefined} exportRequestToken={0} />,
    );

    expect(html).toContain('overflow:hidden');
    expect(html).toContain('padding:0 16px 16px');
  });
});
