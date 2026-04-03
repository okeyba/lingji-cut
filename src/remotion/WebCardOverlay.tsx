import { useMemo, type CSSProperties } from 'react';
import { normalizeWebCardSrcDoc } from '../lib/web-card';
import type { WebCardPayload } from '../types/ai';
import { resolveRemotionAssetSrc } from '../lib/remotion-assets';

interface WebCardOverlayProps {
  webCard: WebCardPayload;
  style?: CSSProperties;
}

export function WebCardOverlay({ webCard, style }: WebCardOverlayProps) {
  const iframeSource = useMemo(
    () =>
      webCard.src
        ? { src: resolveRemotionAssetSrc(webCard.src) }
        : webCard.srcDoc
          ? { srcDoc: normalizeWebCardSrcDoc(webCard.srcDoc) }
          : null,
    [webCard.src, webCard.srcDoc],
  );

  if (!iframeSource) {
    return null;
  }

  return (
    <iframe
      title="AI 网页卡片"
      {...iframeSource}
      style={{
        width: '100%',
        height: '100%',
        border: 'none',
        background: '#020617',
        ...style,
      }}
    />
  );
}
