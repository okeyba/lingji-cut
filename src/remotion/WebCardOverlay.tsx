import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import {
  continueRender,
  delayRender,
  getRemotionEnvironment,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import {
  appendCacheBuster,
  DEFAULT_WEB_CARD_BACKGROUND,
  normalizeWebCardSrcDoc,
} from '../lib/web-card';
import type { WebCardPayload } from '../types/ai';
import { resolveRemotionAssetSrc } from '../lib/remotion-assets';

interface WebCardOverlayProps {
  webCard: WebCardPayload;
  style?: CSSProperties;
}

const READY_TIMEOUT_MS = 10_000;
const FRAME_ACK_TIMEOUT_MS = 3_000;

export function WebCardOverlay({ webCard, style }: WebCardOverlayProps) {
  const iframeSource = useMemo(
    () =>
      webCard.src
        ? {
            src: appendCacheBuster(
              resolveRemotionAssetSrc(webCard.src),
              webCard.lastGeneratedAt,
            ),
          }
        : webCard.srcDoc
          ? { srcDoc: normalizeWebCardSrcDoc(webCard.srcDoc) }
          : null,
    [webCard.lastGeneratedAt, webCard.src, webCard.srcDoc],
  );
  const iframeKey = useMemo(() => {
    if (webCard.src) {
      return `${webCard.src}:${webCard.lastGeneratedAt ?? 0}`;
    }

    if (webCard.srcDoc) {
      return `${webCard.lastGeneratedAt ?? 0}:${webCard.srcDoc.length}`;
    }

    return 'empty';
  }, [webCard.lastGeneratedAt, webCard.src, webCard.srcDoc]);

  // srcDoc 模式下 prelude 已注入，可以走帧同步；外部 src 跨域无法注入，只能靠 onLoad 等就绪。
  const supportsVirtualClock = !!iframeSource && 'srcDoc' in iframeSource;
  const isRendering = getRemotionEnvironment().isRendering;
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [iframeReady, setIframeReady] = useState(false);

  // 切 iframe key（srcDoc 内容变化）时重置就绪状态。
  useEffect(() => {
    setIframeReady(false);
  }, [iframeKey]);

  // 导出态：等 iframe prelude / load 事件到位再开始抓帧。
  useEffect(() => {
    if (!isRendering || !iframeSource) {
      return undefined;
    }
    const handle = delayRender(`web-card:ready:${iframeKey}`);
    let settled = false;
    const settle = () => {
      if (settled) return;
      settled = true;
      setIframeReady(true);
      try {
        continueRender(handle);
      } catch {
        // handle 可能已在上一次 cleanup 中释放
      }
    };
    const onMessage = (event: MessageEvent) => {
      const win = iframeRef.current?.contentWindow;
      if (win && event.source !== win) return;
      const data = event.data as { type?: string } | null;
      if (data?.type === 'lingji:web-card:ready') {
        settle();
      }
    };
    window.addEventListener('message', onMessage);
    // 外部 src 跨域场景：postMessage 不一定能通，超时兜底，不阻塞整段导出。
    const timeoutId = window.setTimeout(settle, READY_TIMEOUT_MS);
    return () => {
      window.removeEventListener('message', onMessage);
      window.clearTimeout(timeoutId);
      if (!settled) {
        try {
          continueRender(handle);
        } catch {
          // noop
        }
      }
    };
  }, [isRendering, iframeSource, iframeKey]);

  // 导出态 + srcDoc：每帧 seek + 等 ack 后 continueRender。
  useEffect(() => {
    if (!isRendering || !supportsVirtualClock || !iframeReady) {
      return undefined;
    }
    const win = iframeRef.current?.contentWindow;
    if (!win) {
      return undefined;
    }
    const token = `${iframeKey}:${frame}`;
    const handle = delayRender(`web-card:frame:${frame}`);
    const timeMs = (frame * 1_000) / Math.max(1, fps);
    let released = false;
    const release = () => {
      if (released) return;
      released = true;
      try {
        continueRender(handle);
      } catch {
        // noop
      }
    };
    const onAck = (event: MessageEvent) => {
      if (event.source !== win) return;
      const data = event.data as { type?: string; token?: string } | null;
      if (data?.type === 'lingji:web-card:frame-ack' && data.token === token) {
        release();
      }
    };
    window.addEventListener('message', onAck);
    const timeoutId = window.setTimeout(release, FRAME_ACK_TIMEOUT_MS);
    win.postMessage(
      {
        type: 'lingji:web-card:set-frame',
        frame,
        fps,
        timeMs,
        token,
      },
      '*',
    );
    return () => {
      window.removeEventListener('message', onAck);
      window.clearTimeout(timeoutId);
      release();
    };
  }, [isRendering, supportsVirtualClock, iframeReady, frame, fps, iframeKey]);

  if (!iframeSource) {
    return null;
  }

  return (
    <iframe
      key={iframeKey}
      ref={iframeRef}
      title="AI 网页卡片"
      onLoad={() => {
        // 预览态仍然走 onLoad 立即就绪；导出态会被 message/timeout 逻辑覆盖。
        if (!isRendering) {
          setIframeReady(true);
        }
      }}
      {...iframeSource}
      style={{
        width: '100%',
        height: '100%',
        border: 'none',
        background: DEFAULT_WEB_CARD_BACKGROUND,
        ...style,
      }}
    />
  );
}
