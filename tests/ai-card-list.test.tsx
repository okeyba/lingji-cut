import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { AICardList } from '../src/components/AICardList';

describe('AICardList', () => {
  it('renders card titles and their source time ranges', () => {
    const html = renderToStaticMarkup(
      <AICardList
        cards={[
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
            style: {
              primaryColor: '#6366f1',
              backgroundColor: '#0f172a',
              fontSize: 48,
            },
          },
        ]}
        placements={{
          'card-1': {
            trackId: 'visual-1',
            trackLabel: '轨道 1',
          },
        }}
        onToggleEnabled={() => undefined}
        onDeleteCard={() => undefined}
        onEditCard={() => undefined}
      />,
    );

    expect(html).toContain('本期要点');
    expect(html).toContain('00:00 - 00:45');
    expect(html).toContain('已在轨道 1');
    expect(html).toContain('已选');
    expect(html).toContain('删除');
    expect(html).not.toContain('type="checkbox"');
  });
});
