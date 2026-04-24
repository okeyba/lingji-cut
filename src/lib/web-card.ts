export const DEFAULT_WEB_CARD_STAGE_WIDTH = 1_920;
export const DEFAULT_WEB_CARD_STAGE_HEIGHT = 1_080;
export const DEFAULT_WEB_CARD_BACKGROUND = '#10131a';

export interface ImportedHtmlFile {
  path: string;
  content: string;
}

function decodeHtmlEntities(source: string): string {
  return source
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#(\d+);/g, (_, value: string) => String.fromCodePoint(Number.parseInt(value, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_, value: string) =>
      String.fromCodePoint(Number.parseInt(value, 16)),
    );
}

function normalizeTextContent(source: string): string {
  return decodeHtmlEntities(source.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
}

export function appendCacheBuster(url: string, cacheKey?: number): string {
  if (!url || !Number.isFinite(cacheKey)) {
    return url;
  }

  return `${url}${url.includes('?') ? '&' : '?'}t=${Number(cacheKey)}`;
}

function injectIntoHead(source: string, injection: string): string {
  if (/<head[^>]*>/i.test(source)) {
    return source.replace(/<head([^>]*)>/i, `<head$1>${injection}`);
  }

  if (/<html[^>]*>/i.test(source)) {
    return source.replace(/<html([^>]*)>/i, `<html$1><head>${injection}</head>`);
  }

  return `<!doctype html><html><head>${injection}</head><body>${source}</body></html>`;
}

function injectBeforeBodyEnd(source: string, injection: string): string {
  if (/<\/body>/i.test(source)) {
    return source.replace(/<\/body>/i, `${injection}</body>`);
  }

  return `${source}${injection}`;
}

/**
 * 注入到 srcDoc <head> 最前端的虚拟时钟 prelude。
 *
 * Remotion 导出时 Chromium 会对外层 React 树逐帧 seek，但 iframe 内部的 CSS
 * animation / rAF / setTimeout 走墙钟时间，与 Remotion 帧时间线不同步，导出
 * 视频里就会卡顿。prelude 在 iframe 内部 hijack 时间相关 API，默认 realtime
 * 模式不影响预览；父窗口发来 `lingji:web-card:set-frame` 时切到 frame-driven
 * 模式，把 performance.now / Date.now / rAF / 定时器 / Web Animations 全部
 * 对齐到父侧提供的 frame，然后回执 `lingji:web-card:frame-ack`。
 */
function buildVirtualClockScript(): string {
  return `
<script data-web-card-virtual-clock="true">
(function(){
  if (window.__lingjiVirtualClock) { return; }
  var clock = { mode: 'realtime', timeMs: 0, frame: 0, fps: 30 };
  window.__lingjiVirtualClock = clock;

  var origPerfNow = performance.now.bind(performance);
  var origDateNow = Date.now.bind(Date);
  var origRAF = window.requestAnimationFrame.bind(window);
  var origCAF = window.cancelAnimationFrame.bind(window);
  var origSetTimeout = window.setTimeout.bind(window);
  var origSetInterval = window.setInterval.bind(window);
  var origClearTimeout = window.clearTimeout.bind(window);
  var origClearInterval = window.clearInterval.bind(window);
  var dateOrigin = origDateNow();

  var rafSeq = 0;
  var rafQueue = [];
  function patchedRAF(cb) {
    if (clock.mode !== 'frame-driven') { return origRAF(cb); }
    rafSeq += 1;
    var id = rafSeq;
    rafQueue.push({ id: id, cb: cb });
    return id;
  }
  function patchedCAF(id) {
    if (clock.mode !== 'frame-driven') { return origCAF(id); }
    rafQueue = rafQueue.filter(function(e){ return e.id !== id; });
  }
  function flushRAF() {
    if (rafQueue.length === 0) { return; }
    var q = rafQueue;
    rafQueue = [];
    for (var i = 0; i < q.length; i++) {
      try { q[i].cb(clock.timeMs); } catch (e) { console.error('[virtual-clock] rAF', e); }
    }
  }

  var timerSeq = 0;
  var timers = new Map();
  function patchedSetTimeout(cb, delay) {
    var rest = Array.prototype.slice.call(arguments, 2);
    if (clock.mode !== 'frame-driven') { return origSetTimeout.apply(null, [cb, delay].concat(rest)); }
    timerSeq += 1;
    var id = timerSeq;
    timers.set(id, { type: 'timeout', due: clock.timeMs + (Number(delay) || 0), cb: cb, args: rest });
    return id;
  }
  function patchedSetInterval(cb, delay) {
    var rest = Array.prototype.slice.call(arguments, 2);
    if (clock.mode !== 'frame-driven') { return origSetInterval.apply(null, [cb, delay].concat(rest)); }
    timerSeq += 1;
    var id = timerSeq;
    var period = Math.max(1, Number(delay) || 0);
    timers.set(id, { type: 'interval', due: clock.timeMs + period, period: period, cb: cb, args: rest });
    return id;
  }
  function patchedClearTimer(id) {
    if (timers.has(id)) { timers.delete(id); return; }
    origClearTimeout(id);
    origClearInterval(id);
  }
  function flushTimers() {
    if (timers.size === 0) { return; }
    var fired = [];
    timers.forEach(function(t, id){
      while (t.due <= clock.timeMs) {
        fired.push({ id: id, type: t.type, cb: t.cb, args: t.args });
        if (t.type === 'interval') { t.due += t.period; } else { break; }
      }
    });
    fired.forEach(function(entry){
      if (entry.type === 'timeout') { timers.delete(entry.id); }
      try { entry.cb.apply(null, entry.args); } catch (e) { console.error('[virtual-clock] timer', e); }
    });
  }

  function seekAnimations() {
    if (typeof document.getAnimations !== 'function') { return; }
    var anims;
    try { anims = document.getAnimations(); } catch (e) { return; }
    for (var i = 0; i < anims.length; i++) {
      var a = anims[i];
      try { a.pause(); a.currentTime = clock.timeMs; } catch (e) {}
    }
  }

  try { performance.now = function(){ return clock.mode === 'frame-driven' ? clock.timeMs : origPerfNow(); }; } catch (e) {}
  try { Date.now = function(){ return clock.mode === 'frame-driven' ? (dateOrigin + clock.timeMs) : origDateNow(); }; } catch (e) {}
  window.requestAnimationFrame = patchedRAF;
  window.cancelAnimationFrame = patchedCAF;
  window.setTimeout = patchedSetTimeout;
  window.setInterval = patchedSetInterval;
  window.clearTimeout = patchedClearTimer;
  window.clearInterval = patchedClearTimer;

  window.addEventListener('message', function(event){
    var data = event.data;
    if (!data || typeof data !== 'object') { return; }
    if (data.type === 'lingji:web-card:set-frame') {
      clock.mode = 'frame-driven';
      clock.timeMs = Number(data.timeMs) || 0;
      clock.frame = Number(data.frame) || 0;
      clock.fps = Number(data.fps) || 30;
      flushTimers();
      flushRAF();
      seekAnimations();
      // 两个原生 rAF 让样式/合成应用后再 ack，确保截图抓到 seek 结果
      origRAF(function(){
        origRAF(function(){
          if (event.source && typeof event.source.postMessage === 'function') {
            event.source.postMessage({
              type: 'lingji:web-card:frame-ack',
              frame: clock.frame,
              token: data.token,
            }, '*');
          }
        });
      });
    }
  });

  function announceReady(){
    if (window.parent && window.parent !== window) {
      try { window.parent.postMessage({ type: 'lingji:web-card:ready' }, '*'); } catch (e) {}
    }
  }
  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    announceReady();
  } else {
    window.addEventListener('DOMContentLoaded', announceReady, { once: true });
  }
  window.addEventListener('load', announceReady);
})();
</script>`;
}

/**
 * Self-scaling script injected into the srcDoc.
 * Runs inside the iframe's own context — no cross-frame DOM access needed.
 * Scales the body (designed at stageWidth×stageHeight) to fit the iframe viewport.
 */
function buildAutoScaleScript(
  stageWidth: number,
  stageHeight: number,
): string {
  return `
<script data-web-card-autoscale="true">
(function(){
  var W=${stageWidth},H=${stageHeight};
  function isVisible(el){
    if(!el)return false;
    var style=window.getComputedStyle(el);
    return style.display!=='none'&&style.visibility!=='hidden';
  }
  function getPrimary(body){
    var children=Array.prototype.filter.call(body.children||[],isVisible);
    if(children.length===1)return children[0];
    return body.querySelector('[data-web-card-stage]')||body;
  }
  function expandPrimary(body){
    var primary=getPrimary(body);
    if(!primary)return;
    var rect=primary.getBoundingClientRect();
    if(rect.width < W * 0.72){
      primary.style.width='100%';
      primary.style.maxWidth='none';
    }
    if(rect.height < H * 0.72){
      primary.style.height='100%';
      primary.style.minHeight=H+'px';
    }
    primary.style.boxSizing='border-box';
  }
  function fit(){
    var root=document.documentElement,body=document.body;
    if(!body)return;
    var vw=Math.max(window.innerWidth||root.clientWidth||1,1);
    var vh=Math.max(window.innerHeight||root.clientHeight||1,1);
    var s=Math.min(vw/W,vh/H);
    var ox=Math.max(0,(vw-W*s)/2);
    var oy=Math.max(0,(vh-H*s)/2);
    root.style.margin='0';
    root.style.width='100%';
    root.style.height='100%';
    root.style.overflow='hidden';
    root.style.background=body.style.background||getComputedStyle(body).backgroundColor||'${DEFAULT_WEB_CARD_BACKGROUND}';
    body.style.width=W+'px';
    body.style.height=H+'px';
    body.style.minWidth=W+'px';
    body.style.minHeight=H+'px';
    body.style.margin='0';
    body.style.position='absolute';
    body.style.left=ox+'px';
    body.style.top=oy+'px';
    body.style.transformOrigin='top left';
    body.style.transform='scale('+s+')';
    body.style.overflow='hidden';
    body.style.padding='0';
    body.style.minHeight=H+'px';
    expandPrimary(body);
  }
  fit();
  window.addEventListener('resize',fit);
  window.addEventListener('load',fit);
})();
</script>`;
}

export function normalizeWebCardSrcDoc(
  srcDoc: string,
  stageWidth = DEFAULT_WEB_CARD_STAGE_WIDTH,
  stageHeight = DEFAULT_WEB_CARD_STAGE_HEIGHT,
): string {
  if (!srcDoc.trim()) {
    return srcDoc;
  }

  if (srcDoc.includes('data-web-card-normalized="true"')) {
    return srcDoc;
  }

  // 虚拟时钟 prelude 必须最早注入，赶在 iframe 内其它 script 执行前 hijack 时间 API。
  const headInjection = `${buildVirtualClockScript()}
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
<style data-web-card-normalized="true">
html, body {
  margin: 0 !important;
  overflow: hidden !important;
  background: ${DEFAULT_WEB_CARD_BACKGROUND};
  width: 100%;
  height: 100%;
}
</style>`;

  let result = injectIntoHead(srcDoc, headInjection);

  // 注入自缩放脚本（在 body 末尾），不依赖外部 JS 访问 contentDocument
  if (!result.includes('data-web-card-autoscale')) {
    result = injectBeforeBodyEnd(result, buildAutoScaleScript(stageWidth, stageHeight));
  }

  return result;
}

export function extractHtmlTitle(source: string): string | null {
  const match = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(source);
  if (!match) {
    return null;
  }

  const normalizedTitle = normalizeTextContent(match[1] ?? '');
  return normalizedTitle || null;
}

export function createImportedHtmlWebCardPayload(
  file: ImportedHtmlFile,
  importedAt = Date.now(),
): {
  srcDoc: string;
  runtimeStatus: 'ready';
  lastGeneratedAt: number;
  sourceKind: 'imported-file';
  sourceLabel: string;
} {
  const normalizedPath = file.path.replace(/\\/g, '/');
  const sourceLabel = normalizedPath.split('/').pop() || 'imported-card.html';

  return {
    srcDoc: file.content,
    runtimeStatus: 'ready',
    lastGeneratedAt: importedAt,
    sourceKind: 'imported-file',
    sourceLabel,
  };
}

/**
 * Legacy external scaling — kept as fallback for edge cases where the
 * injected script cannot run (e.g. CSP blocks inline scripts).
 */
export function fitWebCardIframe(
  iframe: HTMLIFrameElement,
  stageWidth = DEFAULT_WEB_CARD_STAGE_WIDTH,
  stageHeight = DEFAULT_WEB_CARD_STAGE_HEIGHT,
): void {
  const doc = iframe.contentDocument;
  const win = iframe.contentWindow;
  if (!doc || !win || !doc.body) {
    return;
  }

  const viewportWidth = Math.max(win.innerWidth || iframe.clientWidth || 0, 1);
  const viewportHeight = Math.max(win.innerHeight || iframe.clientHeight || 0, 1);
  const scale = Math.min(
    viewportWidth / Math.max(1, stageWidth),
    viewportHeight / Math.max(1, stageHeight),
  );
  const offsetX = Math.max(0, (viewportWidth - stageWidth * scale) / 2);
  const offsetY = Math.max(0, (viewportHeight - stageHeight * scale) / 2);
  const root = doc.documentElement;
  const body = doc.body;

  root.style.margin = '0';
  root.style.width = '100%';
  root.style.height = '100%';
  root.style.overflow = 'hidden';
  root.style.background = body.style.background || DEFAULT_WEB_CARD_BACKGROUND;

  body.style.width = `${stageWidth}px`;
  body.style.height = `${stageHeight}px`;
  body.style.minWidth = `${stageWidth}px`;
  body.style.minHeight = `${stageHeight}px`;
  body.style.margin = '0';
  body.style.position = 'absolute';
  body.style.left = `${offsetX}px`;
  body.style.top = `${offsetY}px`;
  body.style.transformOrigin = 'top left';
  body.style.transform = `scale(${scale})`;
  body.style.overflow = 'hidden';
}
