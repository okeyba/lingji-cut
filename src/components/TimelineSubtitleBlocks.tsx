import { useMemo } from 'react';
import type { SrtEntry } from '../types';
import { clamp } from '../lib/utils';

interface TimelineSubtitleBlocksProps {
  entries: SrtEntry[];
  durationMs: number;
  pxPerMs: number;
  trackHeight: number;
}

interface SubtitleBlockLayout {
  id: string;
  left: number;
  width: number;
  text: string;
}

function buildSubtitleLayouts(
  entries: SrtEntry[],
  durationMs: number,
  pxPerMs: number,
): SubtitleBlockLayout[] {
  return entries
    .map((entry) => {
      const startMs = clamp(entry.startMs, 0, durationMs);
      const endMs = clamp(entry.endMs, startMs, durationMs);
      const width = Math.max(2, Math.round((endMs - startMs) * pxPerMs));
      const text = entry.text.replace(/\s+/g, ' ').trim();

      return {
        id: `subtitle-${entry.index}`,
        left: Math.round(startMs * pxPerMs),
        width,
        text,
      };
    })
    .filter((entry) => entry.text.length > 0 && entry.width > 0);
}

export function TimelineSubtitleBlocks({
  entries,
  durationMs,
  pxPerMs,
  trackHeight,
}: TimelineSubtitleBlocksProps) {
  const layouts = useMemo(
    () => buildSubtitleLayouts(entries, durationMs, pxPerMs),
    [durationMs, entries, pxPerMs],
  );

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        overflow: 'hidden',
        pointerEvents: 'none',
      }}
    >
      {layouts.map((entry) => (
        <span
          key={entry.id}
          data-subtitle-entry={entry.id}
          style={{
            position: 'absolute',
            left: entry.left,
            top: Math.max(4, Math.round((trackHeight - 22) / 2)),
            width: entry.width,
            height: 22,
            borderRadius: 8,
            background: 'linear-gradient(135deg, rgba(249, 115, 22, 0.9), rgba(234, 88, 12, 0.72))',
            boxShadow: '0 4px 12px rgba(249, 115, 22, 0.28)',
            overflow: 'hidden',
          }}
        >
          <span
            style={{
              display: 'block',
              width: '100%',
              height: '100%',
              padding: entry.width >= 24 ? '0 8px' : '0 4px',
              boxSizing: 'border-box',
              color: '#fff7ed',
              fontSize: 10,
              fontWeight: 700,
              lineHeight: '22px',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {entry.text}
          </span>
        </span>
      ))}
    </div>
  );
}
