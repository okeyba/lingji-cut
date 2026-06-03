import { AbsoluteFill } from 'remotion';
import type { CSSProperties } from 'react';
import type { OverlayItem } from '../../types';
import { LegacyCard } from './LegacyCard';
import { CardHost } from '../card-host';

export function AICardOverlay({
  overlay,
  zIndex,
  compiledJs,
}: {
  overlay: OverlayItem;
  zIndex: number;
  compiledJs?: string;
}) {
  const card = overlay.aiCardData;
  if (!card) return null;

  const fullscreen = card.displayMode === 'fullscreen';
  const wrapper: CSSProperties = fullscreen
    ? { position: 'absolute', inset: 0, zIndex, overflow: 'hidden' }
    : {
        position: 'absolute',
        left: overlay.position.x,
        top: overlay.position.y,
        width: overlay.position.width,
        height: overlay.position.height,
        zIndex,
        overflow: 'hidden',
        borderRadius: 18,
        boxShadow: '0 10px 30px rgba(0,0,0,.45)',
      };

  const tsx = card.renderMode === 'motion-card' ? card.motionCard?.tsx : undefined;
  // 旧 HTML 卡片或缺失 tsx → 降级占位；未编译（compiledJs 缺失）也降级，避免空白。
  if (card.renderMode === 'motion-card' && (!tsx?.trim() || !compiledJs)) {
    return (
      <AbsoluteFill style={wrapper}>
        <LegacyCard title={card.title} />
      </AbsoluteFill>
    );
  }

  return (
    <AbsoluteFill style={wrapper}>
      <CardHost overlayId={overlay.id} compiledJs={compiledJs ?? ''} />
    </AbsoluteFill>
  );
}
