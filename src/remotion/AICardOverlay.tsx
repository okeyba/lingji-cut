import type { CSSProperties } from 'react';
import { Sequence } from 'remotion';
import type { OverlayItem } from '../types';
import { isDataContent } from '../types/ai';
import { msToFrame } from '../lib/utils';
import { SummaryCard } from './cards/SummaryCard';
import { DataCard } from './cards/DataCard';
import { InsightCard } from './cards/InsightCard';
import { ChapterCard } from './cards/ChapterCard';
import { QuoteCard } from './cards/QuoteCard';
import { WebCardOverlay } from './WebCardOverlay';
import { hasWebCardSource } from '../types/ai';

interface AICardOverlayProps {
  overlay: OverlayItem;
  fps: number;
  chapterIndex?: number;
}

function formatTime(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1_000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function renderCard(overlay: OverlayItem, chapterIndex: number) {
  const data = overlay.aiCardData;
  if (!data) {
    return null;
  }

  if (data.renderMode === 'web-card' && hasWebCardSource(data.webCard)) {
    return <WebCardOverlay webCard={data.webCard!} />;
  }

  if (data.cardType === 'summary') {
    return <SummaryCard title={data.title} content={String(data.content)} style={data.style} />;
  }

  if (data.cardType === 'data' && isDataContent(data.content)) {
    return <DataCard title={data.title} content={data.content} style={data.style} />;
  }

  if (data.cardType === 'insight') {
    return <InsightCard title={data.title} content={String(data.content)} style={data.style} />;
  }

  if (data.cardType === 'chapter') {
    const range = `${formatTime(data.sourceStartMs ?? overlay.startMs)} - ${formatTime(
      data.sourceEndMs ?? overlay.startMs + overlay.durationMs,
    )}`;
    return (
      <ChapterCard
        title={data.title}
        chapterIndex={chapterIndex}
        timeRange={range}
        style={data.style}
      />
    );
  }

  return <QuoteCard content={String(data.content)} style={data.style} />;
}

export function AICardOverlay({ overlay, fps, chapterIndex = 1 }: AICardOverlayProps) {
  if (overlay.overlayType !== 'ai-card' || !overlay.aiCardData) {
    return null;
  }

  const from = msToFrame(overlay.startMs, fps);
  const durationInFrames = Math.max(1, msToFrame(overlay.durationMs, fps));
  const isFullscreen = overlay.aiCardData.displayMode === 'fullscreen';
  const isWebCard =
    overlay.aiCardData.renderMode === 'web-card' && hasWebCardSource(overlay.aiCardData.webCard);
  const scale = Math.min(overlay.position.width / 1_920, overlay.position.height / 1_080);
  const wrapperStyle: CSSProperties = isFullscreen
    ? { position: 'absolute', inset: 0 }
    : {
        position: 'absolute',
        left: overlay.position.x,
        top: overlay.position.y,
        width: overlay.position.width,
        height: overlay.position.height,
        borderRadius: 18,
        overflow: 'hidden',
        boxShadow: '0 10px 30px rgba(0,0,0,0.45)',
      };
  // Web cards render as iframes — their parent must provide explicit dimensions
  // so height:100% on the iframe can resolve. Non-web cards have their own
  // 1920×1080 CSS and size themselves; fitWebCardIframe handles internal scaling.
  const contentStyle: CSSProperties = isWebCard
    ? { width: '100%', height: '100%' }
    : isFullscreen
      ? {}
      : { transform: `scale(${scale})`, transformOrigin: 'top left' };

  return (
    <Sequence from={from} durationInFrames={durationInFrames}>
      <div style={wrapperStyle}>
        <div style={contentStyle}>{renderCard(overlay, chapterIndex)}</div>
      </div>
    </Sequence>
  );
}
