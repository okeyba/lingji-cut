import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { AISettingsModal } from '../src/components/AISettingsModal';

describe('AISettingsModal', () => {
  it('renders modal content during server-side rendering fallback', () => {
    const html = renderToStaticMarkup(
      <AISettingsModal
        visible
        settings={{
          llmBaseUrl: 'https://api.openai.com/v1',
          llmApiKey: 'sk-test',
          llmModel: 'gpt-4o',
          jimengApiUrl: 'http://47.109.159.194:8330',
          jimengSessionId: 'session-test',
        }}
        onClose={() => undefined}
        onSave={() => undefined}
      />,
    );

    expect(html).toContain('AI 配置');
    expect(html).toContain('LLM API Base URL');
    expect(html).toContain('即梦 Session ID');
  });
});
