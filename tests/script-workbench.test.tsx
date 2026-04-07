// tests/script-workbench.test.tsx
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { OverlayProvider } from '../src/ui';
import { ScriptWorkbench } from '../src/pages/ScriptWorkbench';
import { useScriptStore } from '../src/store/script';

// localStorage 在 node 测试环境中不存在，提供一个简单 mock
const localStorageMock = (() => {
  const store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { Object.keys(store).forEach(k => delete store[k]); },
  };
})();

vi.stubGlobal('localStorage', localStorageMock);

describe('ScriptWorkbench', () => {
  beforeEach(() => {
    useScriptStore.getState().reset();
  });

  afterEach(() => {
    useScriptStore.getState().reset();
  });

  it('renders step 1 placeholder when no file is loaded', () => {
    useScriptStore.setState({ currentStep: 1, originalText: '' });

    const html = renderToStaticMarkup(
      <OverlayProvider>
        <ScriptWorkbench onBack={() => undefined} />
      </OverlayProvider>,
    );

    expect(html).toContain('在右侧面板选择工作目录并上传报告文件');
  });

  it('renders the editor container when originalText is set', () => {
    useScriptStore.setState({
      currentStep: 2,
      originalText: '# 测试报告\n\n正文内容。',
    });

    // CM6 uses imperative DOM — renderToStaticMarkup produces the container div
    // but not the editor content. Verify no crash.
    expect(() =>
      renderToStaticMarkup(
        <OverlayProvider>
          <ScriptWorkbench onBack={() => undefined} />
        </OverlayProvider>,
      ),
    ).not.toThrow();
  });
});
