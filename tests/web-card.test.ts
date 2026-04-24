import { describe, expect, it } from 'vitest';
import {
  appendCacheBuster,
  createImportedHtmlWebCardPayload,
  DEFAULT_WEB_CARD_BACKGROUND,
  extractHtmlTitle,
  normalizeWebCardSrcDoc,
} from '../src/lib/web-card';

describe('normalizeWebCardSrcDoc', () => {
  it('injects viewport normalization markup once for iframe rendering', () => {
    const normalized = normalizeWebCardSrcDoc(
      '<!doctype html><html><head><title>Card</title></head><body><div>hello</div></body></html>',
    );

    expect(normalized).toContain('data-web-card-normalized="true"');
    expect(normalized).toContain('name="viewport"');
    expect(normalized).toContain(`background: ${DEFAULT_WEB_CARD_BACKGROUND}`);
  });

  it('does not inject duplicate normalization wrappers', () => {
    const source =
      '<!doctype html><html><head><style data-web-card-normalized="true"></style></head><body>ok</body></html>';

    expect(normalizeWebCardSrcDoc(source)).toBe(source);
  });

  it('appends a cache-busting query when the preview html is regenerated', () => {
    expect(appendCacheBuster('file:///tmp/card.html', 123)).toBe('file:///tmp/card.html?t=123');
    expect(appendCacheBuster('file:///tmp/card.html?mode=preview', 456)).toBe(
      'file:///tmp/card.html?mode=preview&t=456',
    );
  });

  it('does not stretch only the first top-level node when the body has multiple sections', () => {
    const normalized = normalizeWebCardSrcDoc(
      '<!doctype html><html><body><header>head</header><main>body</main><footer>foot</footer></body></html>',
    );

    expect(normalized).toContain("return body.querySelector('[data-web-card-stage]')||body;");
    expect(normalized).not.toContain('body.firstElementChild');
  });

  it('injects the virtual-clock prelude ahead of other head content for frame sync', () => {
    const normalized = normalizeWebCardSrcDoc(
      '<!doctype html><html><head><title>Card</title></head><body><div>hello</div></body></html>',
    );

    expect(normalized).toContain('data-web-card-virtual-clock="true"');
    expect(normalized).toContain('lingji:web-card:set-frame');
    expect(normalized).toContain('lingji:web-card:frame-ack');
    expect(normalized).toContain('lingji:web-card:ready');
    expect(normalized).toContain('window.__lingjiVirtualClock');

    const clockIdx = normalized.indexOf('data-web-card-virtual-clock');
    const normalizedStyleIdx = normalized.indexOf('data-web-card-normalized');
    expect(clockIdx).toBeGreaterThan(-1);
    expect(normalizedStyleIdx).toBeGreaterThan(-1);
    // prelude 必须在常规样式注入之前，才能赶在卡片自身脚本前 hijack 时间 API
    expect(clockIdx).toBeLessThan(normalizedStyleIdx);
  });

  it('does not duplicate the virtual-clock prelude when called twice', () => {
    const once = normalizeWebCardSrcDoc(
      '<!doctype html><html><body><div>hi</div></body></html>',
    );
    const twice = normalizeWebCardSrcDoc(once);

    expect(twice).toBe(once);
    const occurrences = twice.match(/data-web-card-virtual-clock="true"/g) ?? [];
    expect(occurrences).toHaveLength(1);
  });
});

describe('createImportedHtmlWebCardPayload', () => {
  it('creates a ready-to-render imported web card payload with source metadata', () => {
    const payload = createImportedHtmlWebCardPayload(
      {
        path: '/tmp/cards/custom-card.html',
        content: '<!doctype html><html><body><main>custom</main></body></html>',
      },
      1_715_000_000_000,
    );

    expect(payload).toEqual({
      srcDoc: '<!doctype html><html><body><main>custom</main></body></html>',
      runtimeStatus: 'ready',
      lastGeneratedAt: 1_715_000_000_000,
      sourceKind: 'imported-file',
      sourceLabel: 'custom-card.html',
    });
  });
});

describe('extractHtmlTitle', () => {
  it('prefers the html title tag and normalizes whitespace', () => {
    expect(
      extractHtmlTitle(
        '<!doctype html><html><head><title>  AI&nbsp;数据 看板  </title></head><body></body></html>',
      ),
    ).toBe('AI 数据 看板');
  });

  it('returns null when the document does not provide a title tag', () => {
    expect(extractHtmlTitle('<!doctype html><html><body><h1>No title</h1></body></html>')).toBeNull();
  });
});
