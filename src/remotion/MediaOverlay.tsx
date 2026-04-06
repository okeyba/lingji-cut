import { Img, OffthreadVideo, Sequence, useCurrentFrame } from 'remotion';
import type { OverlayItem } from '../types';
import { getOverlayMotionStyle, resolveOverlayMotion } from '../lib/overlay-motion';
import { resolveRemotionAssetSrc } from '../lib/remotion-assets';
import { msToFrame } from '../lib/utils';

interface MediaOverlayProps {
  overlay: OverlayItem;
  fps: number;
}

export function MediaOverlay({ overlay, fps }: MediaOverlayProps) {
  const globalFrame = useCurrentFrame();
  const from = msToFrame(overlay.startMs, fps);
  const durationInFrames = Math.max(1, msToFrame(overlay.durationMs, fps));
  const localFrame = Math.max(0, globalFrame - from);
  const motionStyle = getOverlayMotionStyle({
    frame: localFrame,
    fps,
    durationFrames: durationInFrames,
    motion: resolveOverlayMotion(overlay),
  });
  const style = {
    position: 'absolute' as const,
    left: overlay.position.x,
    top: overlay.position.y,
    width: overlay.position.width,
    height: overlay.position.height,
    objectFit: 'cover' as const,
    opacity: motionStyle.opacity,
    transform: motionStyle.transform,
  };

  return (
    <Sequence from={from} durationInFrames={durationInFrames}>
      {overlay.type === 'video' ? (
        <OffthreadVideo src={resolveRemotionAssetSrc(overlay.assetPath)} style={style} />
      ) : (
        <Img src={resolveRemotionAssetSrc(overlay.assetPath)} style={style} />
      )}
    </Sequence>
  );
}
