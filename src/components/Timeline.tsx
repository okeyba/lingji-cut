import type { CSSProperties, DragEvent, MouseEvent, ReactNode, WheelEvent } from 'react';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { TrackDragZone } from '../lib/overlay-drag';
import { getRenderableVisualTracks, getVisualTracks } from '../lib/timeline-tracks';
import { formatTime, getFileNameFromPath } from '../lib/utils';
import {
  getAnchoredTimelineScrollLeft,
  getFitTimelineZoom,
  getNextTimelineZoom,
  getTimelineTrackWidth,
  getWheelTimelineZoom,
} from '../lib/timeline-view';
import type { TimelineTrack } from '../types';
import { useTimelineStore } from '../store/timeline';
import { OverlayBlock } from './OverlayBlock';
import { TimelineAudioWaveform } from './TimelineAudioWaveform';
import { TimelineSubtitleBlocks } from './TimelineSubtitleBlocks';

interface TimelineProps {
  currentTimeMs: number;
  onSeek: (ms: number) => void;
  compact: boolean;
}

interface AssetLike {
  path: string;
  type: 'video' | 'image';
  durationMs: number;
  overlayRole?: 'default-background';
}

const timeActionButtonStyle: CSSProperties = {
  width: 28,
  height: 28,
  borderRadius: 10,
  border: '1px solid rgba(148, 163, 184, 0.18)',
  background: 'rgba(15, 23, 42, 0.6)',
  color: '#e2e8f0',
  cursor: 'pointer',
  fontSize: 14,
  lineHeight: 1,
  fontWeight: 600,
  transition: 'all 150ms ease-out',
};

export function Timeline({ currentTimeMs, onSeek, compact }: TimelineProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const pendingScrollLeftRef = useRef<number | null>(null);
  const trackLaneRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [hoverTrackId, setHoverTrackId] = useState<string | null>(null);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [viewportWidth, setViewportWidth] = useState(0);
  const { addOverlay, addTrack, setGlobalBackground, srtEntries, timeline } = useTimelineStore();
  const durationMs = Math.max(1000, timeline.podcast.durationMs);
  const outerPadding = compact ? 12 : 16;
  const sidebarWidth = compact ? 100 : 120;
  const toolbarHeight = compact ? 44 : 52;
  const rulerHeight = 28;
  const lockedTrackHeight = compact ? 34 : 38;
  const overlayTrackHeight = compact ? 40 : 44;
  const trackGap = compact ? 5 : 8;
  const trackWidth = useMemo(
    () => getTimelineTrackWidth(durationMs, zoomLevel, Math.max(480, viewportWidth || 960)),
    [durationMs, viewportWidth, zoomLevel],
  );
  const pxPerMs = trackWidth / durationMs;
  const visualTracks = useMemo(() => getVisualTracks(timeline.tracks), [timeline.tracks]);
  const renderableTracks = useMemo(
    () => getRenderableVisualTracks(timeline.tracks),
    [timeline.tracks],
  );
  const contentWidth = sidebarWidth + trackWidth;
  const majorTickInterval = useMemo(() => {
    if (durationMs <= 30_000) {
      return 5_000;
    }

    if (durationMs <= 120_000) {
      return 10_000;
    }

    return 30_000;
  }, [durationMs]);
  const minorTickInterval = Math.max(1_000, Math.round(majorTickInterval / 5));
  const ticks = useMemo(() => {
    const values: number[] = [];

    for (let cursor = 0; cursor <= durationMs; cursor += majorTickInterval) {
      values.push(cursor);
    }

    if (values[values.length - 1] !== durationMs) {
      values.push(durationMs);
    }

    return values;
  }, [durationMs, majorTickInterval]);
  const overlaysByTrack = useMemo(() => {
    const groups = new Map<string, typeof timeline.overlays>();

    for (const track of renderableTracks) {
      groups.set(track.id, []);
    }

    for (const overlay of timeline.overlays) {
      const group = groups.get(overlay.trackId);
      if (group) {
        group.push(overlay);
      }
    }

    return groups;
  }, [renderableTracks, timeline.overlays]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    const updateWidth = () => {
      setViewportWidth(container.clientWidth - outerPadding * 2 - sidebarWidth);
    };

    updateWidth();

    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', updateWidth);
      return () => window.removeEventListener('resize', updateWidth);
    }

    const observer = new ResizeObserver(updateWidth);
    observer.observe(container);

    return () => observer.disconnect();
  }, [outerPadding, sidebarWidth]);

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container || pendingScrollLeftRef.current === null) {
      return;
    }

    container.scrollLeft = pendingScrollLeftRef.current;
    pendingScrollLeftRef.current = null;
  }, [trackWidth]);

  const gridBackground = useMemo(() => {
    const major = Math.max(40, majorTickInterval * pxPerMs);
    const minor = Math.max(8, minorTickInterval * pxPerMs);

    return {
      backgroundImage: [
        `linear-gradient(180deg, rgba(15, 23, 42, 0.4), rgba(15, 23, 42, 0.2))`,
        `repeating-linear-gradient(to right, rgba(148, 163, 184, 0.12) 0 1px, transparent 1px ${major}px)`,
        `repeating-linear-gradient(to right, rgba(148, 163, 184, 0.06) 0 1px, transparent 1px ${minor}px)`,
      ].join(','),
      backgroundColor: '#020617',
    } satisfies CSSProperties;
  }, [majorTickInterval, minorTickInterval, pxPerMs]);

  const resolveTimelineOffset = (clientX: number) => {
    const rect = containerRef.current?.getBoundingClientRect();

    if (!rect) {
      return null;
    }

    const offsetX =
      clientX -
      rect.left +
      (containerRef.current?.scrollLeft || 0) -
      outerPadding -
      sidebarWidth;

    return offsetX;
  };

  const handleSeekClick = (event: MouseEvent<HTMLDivElement>) => {
    const offsetX = resolveTimelineOffset(event.clientX);

    if (offsetX === null || offsetX < 0) {
      return;
    }

    onSeek(Math.max(0, Math.min(durationMs, Math.round(offsetX / pxPerMs))));
  };

  const handleWheelZoom = (event: WheelEvent<HTMLDivElement>) => {
    if (!event.metaKey) {
      return;
    }

    const container = containerRef.current;
    if (!container) {
      return;
    }

    event.preventDefault();

    const nextZoom = getWheelTimelineZoom(zoomLevel, event.deltaY);
    if (nextZoom === zoomLevel) {
      return;
    }

    const rect = container.getBoundingClientRect();
    const pointerX = Math.max(0, event.clientX - rect.left - sidebarWidth);
    const nextTrackWidth = getTimelineTrackWidth(
      durationMs,
      nextZoom,
      Math.max(480, viewportWidth || 960),
    );

    pendingScrollLeftRef.current = getAnchoredTimelineScrollLeft({
      scrollLeft: container.scrollLeft,
      pointerX,
      previousTrackWidth: trackWidth,
      nextTrackWidth,
    });

    setZoomLevel(nextZoom);
  };

  const placeAssetOnTrack = (trackId: string, asset: AssetLike, clientX: number) => {
    if (asset.overlayRole === 'default-background') {
      setGlobalBackground(asset.path);
      return;
    }

    const offsetX = resolveTimelineOffset(clientX);
    if (offsetX === null) {
      return;
    }

    addOverlay({
      type: asset.type,
      assetPath: asset.path,
      trackId,
      startMs: Math.max(0, Math.round(offsetX / pxPerMs)),
      durationMs: asset.durationMs,
      position: {
        x: 0,
        y: 0,
        width: timeline.width,
        height: timeline.height,
      },
    });
  };

  const handleTrackDrop =
    (trackId: string) =>
    (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      setHoverTrackId(null);
      const raw = event.dataTransfer.getData('application/json');

      if (!raw) {
        return;
      }

      placeAssetOnTrack(trackId, JSON.parse(raw) as AssetLike, event.clientX);
    };

  const getTrackDragZones = (): TrackDragZone[] => {
    return visualTracks.flatMap((track) => {
      const trackLane = trackLaneRefs.current[track.id];
      if (!trackLane) {
        return [];
      }

      const rect = trackLane.getBoundingClientRect();
      return [
        {
          trackId: track.id,
          top: rect.top,
          bottom: rect.bottom,
        },
      ];
    });
  };

  const renderTrackControls = (options: {
    tone: string;
    title: string;
    subtitle: string;
    label: string;
  }) => (
    <div
      style={{
        position: 'sticky',
        left: 0,
        zIndex: 3,
        height: '100%',
        borderRight: '1px solid rgba(148, 163, 184, 0.14)',
        background: 'linear-gradient(180deg, rgba(15, 23, 42, 0.95), rgba(15, 23, 42, 0.85))',
        display: 'flex',
        alignItems: 'center',
        padding: compact ? '0 10px' : '0 14px',
        boxSizing: 'border-box',
      }}
    >
      <div style={{ width: '100%', minWidth: 0 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <div
            style={{
              minWidth: 38,
              height: 22,
              borderRadius: 8,
              background: options.tone,
              color: '#f8fafc',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 10,
              fontWeight: 800,
              letterSpacing: '0.06em',
              padding: '0 8px',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.25)',
            }}
          >
            {options.label}
          </div>
        </div>
        <div
          style={{
            marginTop: 5,
            color: '#e2e8f0',
            fontSize: 12,
            fontWeight: 700,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {options.title}
        </div>
        <div
          style={{
            marginTop: 2,
            color: '#64748b',
            fontSize: 10,
            fontWeight: 500,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {options.subtitle}
        </div>
      </div>
    </div>
  );

  const renderLaneBase = (
    track: TimelineTrack,
    trackHeight: number,
    children: ReactNode,
    extraStyle?: CSSProperties,
  ) => (
    <div
      key={track.id}
      style={{
        display: 'grid',
        gridTemplateColumns: `${sidebarWidth}px ${trackWidth}px`,
        minHeight: trackHeight,
      }}
    >
      {children}
      <div
        style={{
          position: 'relative',
          height: trackHeight,
          borderBottom: '1px solid rgba(148, 163, 184, 0.08)',
          ...gridBackground,
          ...extraStyle,
        }}
      />
    </div>
  );

  return (
    <div
      style={{
        height: '100%',
        border: '1px solid rgba(148, 163, 184, 0.14)',
        borderRadius: 24,
        background: 'linear-gradient(180deg, rgba(15, 23, 42, 0.96) 0%, rgba(2, 6, 23, 0.98) 100%)',
        display: 'grid',
        gridTemplateRows: `${toolbarHeight}px minmax(0, 1fr)`,
        minHeight: 0,
        overflow: 'hidden',
        boxShadow: '0 -20px 60px rgba(0, 0, 0, 0.55)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 14,
          padding: '0 16px',
          borderBottom: '1px solid rgba(148, 163, 184, 0.12)',
          background: 'linear-gradient(180deg, rgba(15, 23, 42, 0.92) 0%, rgba(15, 23, 42, 0.82) 100%)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
          <div
            style={{
              padding: '5px 12px',
              borderRadius: 10,
              background: 'linear-gradient(135deg, rgba(56, 189, 248, 0.18) 0%, rgba(129, 140, 248, 0.12) 100%)',
              color: '#38bdf8',
              fontSize: 11,
              fontWeight: 800,
              letterSpacing: '0.14em',
              border: '1px solid rgba(56, 189, 248, 0.25)',
            }}
          >
            TIMELINE
          </div>
          <div style={{ color: '#64748b', fontSize: 12, fontWeight: 500 }}>
            {visualTracks.length} 条视觉轨 · 拖到指定轨道落片
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button onClick={() => addTrack()} style={toolbarTrackButtonStyle}>
            + 轨道
          </button>
          <button
            onClick={() => setZoomLevel((current) => getNextTimelineZoom(current, 'out'))}
            style={timeActionButtonStyle}
          >
            −
          </button>
          <div
            style={{
              minWidth: 52,
              textAlign: 'center',
              color: '#f8fafc',
              fontSize: 12,
              fontWeight: 800,
              background: 'rgba(15, 23, 42, 0.6)',
              padding: '6px 10px',
              borderRadius: 10,
              border: '1px solid rgba(148, 163, 184, 0.15)',
            }}
          >
            {Math.round(zoomLevel * 100)}%
          </div>
          <button
            onClick={() => setZoomLevel((current) => getNextTimelineZoom(current, 'in'))}
            style={timeActionButtonStyle}
          >
            +
          </button>
          <button
            onClick={() => setZoomLevel(getFitTimelineZoom(durationMs, Math.max(480, viewportWidth || 960)))}
            style={toolbarFitButtonStyle}
          >
            Fit
          </button>
        </div>
      </div>

      <div
        ref={containerRef}
        onClick={handleSeekClick}
        onWheel={handleWheelZoom}
        style={{ overflow: 'auto', minHeight: 0 }}
      >
        <div
          style={{
            width: contentWidth + outerPadding * 2,
            minHeight: '100%',
            padding: outerPadding,
            boxSizing: 'border-box',
          }}
        >
          <div style={{ width: contentWidth, position: 'relative' }}>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: `${sidebarWidth}px ${trackWidth}px`,
                height: rulerHeight,
                position: 'relative',
              }}
            >
              <div
                style={{
                  position: 'sticky',
                  left: 0,
                  zIndex: 4,
                  background: 'linear-gradient(180deg, rgba(15, 23, 42, 0.95), rgba(15, 23, 42, 0.85))',
                  borderRight: '1px solid rgba(148, 163, 184, 0.14)',
                  borderBottom: '1px solid rgba(148, 163, 184, 0.10)',
                  display: 'flex',
                  alignItems: 'center',
                  padding: '0 14px',
                  color: '#64748b',
                  fontSize: 11,
                  fontWeight: 600,
                }}
              >
                轨道
              </div>

              <div
                style={{
                  position: 'relative',
                  height: rulerHeight,
                  borderBottom: '1px solid rgba(148, 163, 184, 0.10)',
                  background: 'linear-gradient(180deg, rgba(15, 23, 42, 0.65), rgba(15, 23, 42, 0.45))',
                }}
              >
                {ticks.map((tick) => (
                  <div
                    key={tick}
                    style={{
                      position: 'absolute',
                      left: tick * pxPerMs,
                      top: 0,
                      bottom: 0,
                      transform: 'translateX(-50%)',
                    }}
                  >
                    <div
                      style={{
                        position: 'absolute',
                        top: 6,
                        left: '50%',
                        width: 1,
                        height: 10,
                        background: 'rgba(148, 163, 184, 0.25)',
                      }}
                    />
                    <div
                      style={{
                        marginTop: 14,
                        color: '#94a3b8',
                        fontSize: 11,
                        fontWeight: 600,
                      }}
                    >
                      {formatTime(tick)}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {renderLaneBase(
              timeline.tracks[0],
              lockedTrackHeight,
              renderTrackControls({
                tone: 'linear-gradient(135deg, #0ea5e9, #0284c7)',
                label: 'AUD',
                title: '口播',
                subtitle: timeline.podcast.audioPath
                  ? getFileNameFromPath(timeline.podcast.audioPath)
                  : '等待导入音频',
              }),
              {
                overflow: 'hidden',
              },
            )}
            <div
              style={{
                position: 'relative',
                marginTop: -lockedTrackHeight,
                marginLeft: sidebarWidth,
                width: trackWidth,
                height: lockedTrackHeight,
                pointerEvents: 'none',
                overflow: 'hidden',
              }}
            >
              <TimelineAudioWaveform
                audioPath={timeline.podcast.audioPath}
                durationMs={durationMs}
                trackWidth={trackWidth}
                trackHeight={lockedTrackHeight}
              />
            </div>

            {renderLaneBase(
              timeline.tracks[1],
              lockedTrackHeight,
              renderTrackControls({
                tone: 'linear-gradient(135deg, #f97316, #ea580c)',
                label: 'TXT',
                title: '字幕',
                subtitle: timeline.podcast.srtPath
                  ? getFileNameFromPath(timeline.podcast.srtPath)
                  : '等待导入字幕',
              }),
            )}
            <div
              style={{
                position: 'relative',
                marginTop: -lockedTrackHeight,
                marginLeft: sidebarWidth,
                width: trackWidth,
                height: lockedTrackHeight,
                overflow: 'hidden',
                pointerEvents: 'none',
              }}
            >
              <TimelineSubtitleBlocks
                entries={srtEntries}
                durationMs={durationMs}
                pxPerMs={pxPerMs}
                trackHeight={lockedTrackHeight}
              />
            </div>

            {visualTracks.map((track, index) => {
              const overlays = overlaysByTrack.get(track.id) ?? [];
              const isHover = hoverTrackId === track.id;
              const isTopLayer = index === 0;

              return (
                <div
                  key={track.id}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: `${sidebarWidth}px ${trackWidth}px`,
                    minHeight: overlayTrackHeight,
                  }}
                >
                  {renderTrackControls({
                    tone: isTopLayer
                      ? 'linear-gradient(135deg, #6366f1, #4f46e5)'
                      : 'linear-gradient(135deg, #475569, #334155)',
                    label: `V${visualTracks.length - index}`,
                    title: track.label,
                    subtitle: isTopLayer ? `最上层 · L${track.order}` : `覆盖级 L${track.order}`,
                  })}
                  <div
                    ref={(node) => {
                      trackLaneRefs.current[track.id] = node;
                    }}
                    onDragOver={(event) => {
                      event.preventDefault();
                      event.dataTransfer.dropEffect = 'copy';
                      if (hoverTrackId !== track.id) {
                        setHoverTrackId(track.id);
                      }
                    }}
                    onDragLeave={() => {
                      if (hoverTrackId === track.id) {
                        setHoverTrackId(null);
                      }
                    }}
                    onDrop={handleTrackDrop(track.id)}
                    style={{
                      position: 'relative',
                      height: overlayTrackHeight,
                      borderBottom: '1px solid rgba(148, 163, 184, 0.08)',
                      ...gridBackground,
                      backgroundColor: isHover ? 'rgba(15, 23, 42, 0.85)' : '#020617',
                      boxShadow: isHover
                        ? 'inset 0 0 0 1px rgba(56, 189, 248, 0.35), 0 0 30px rgba(56, 189, 248, 0.15)'
                        : 'none',
                      transition: 'all 150ms ease-out',
                    }}
                  >
                    {overlays.map((overlay) => (
                      <OverlayBlock
                        key={overlay.id}
                        overlay={overlay}
                        pxPerMs={pxPerMs}
                        trackHeight={overlayTrackHeight}
                        getTrackDragZones={getTrackDragZones}
                        onTrackHoverChange={setHoverTrackId}
                      />
                    ))}

                    {overlays.length === 0 ? (
                      <div
                        style={{
                          position: 'absolute',
                          left: 14,
                          top: '50%',
                          transform: 'translateY(-50%)',
                          color: isHover ? '#38bdf8' : '#475569',
                          fontSize: 12,
                          fontWeight: 500,
                          pointerEvents: 'none',
                          transition: 'color 150ms ease-out',
                        }}
                      >
                        拖入图片或视频到 {track.label}
                      </div>
                    ) : null}
                  </div>
                </div>
              );
            })}

            <div
              style={{
                position: 'absolute',
                top: 0,
                bottom: 0,
                left: sidebarWidth + currentTimeMs * pxPerMs,
                width: 2,
                background: 'linear-gradient(180deg, #38bdf8, #0ea5e9)',
                pointerEvents: 'none',
                zIndex: 5,
                boxShadow: '0 0 20px rgba(56, 189, 248, 0.6), 0 0 40px rgba(56, 189, 248, 0.3)',
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  top: -2,
                  left: -6,
                  width: 14,
                  height: 14,
                  borderRadius: '0 0 10px 10px',
                  background: 'linear-gradient(180deg, #38bdf8, #0ea5e9)',
                  boxShadow: '0 4px 12px rgba(56, 189, 248, 0.5)',
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const toolbarTrackButtonStyle: CSSProperties = {
  height: 30,
  padding: '0 12px',
  borderRadius: 10,
  border: '1px solid rgba(56, 189, 248, 0.35)',
  background: 'linear-gradient(135deg, rgba(56, 189, 248, 0.22) 0%, rgba(129, 140, 248, 0.14) 100%)',
  color: '#e0f2fe',
  cursor: 'pointer',
  fontSize: 12,
  fontWeight: 700,
  transition: 'all 150ms ease-out',
};

const toolbarFitButtonStyle: CSSProperties = {
  height: 30,
  padding: '0 12px',
  borderRadius: 10,
  border: '1px solid rgba(148, 163, 184, 0.18)',
  background: 'rgba(15, 23, 42, 0.6)',
  color: '#cbd5e1',
  cursor: 'pointer',
  fontSize: 12,
  fontWeight: 700,
  transition: 'all 150ms ease-out',
};
