import { memo, useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { Player, type PlayerRef } from '@remotion/player';
import { fitPreviewStage } from '../lib/preview';
import { formatTime, msToFrame } from '../lib/utils';
import { PodcastComposition } from '../remotion/PodcastComposition';
import { useTimelineStore } from '../store/timeline';
import { Badge, Button, SurfaceCard } from '../ui/primitives';
import { PanelHeader } from '../ui/patterns';
import styles from './PreviewPanel.module.css';

interface PreviewPanelProps {
  playerRef: RefObject<PlayerRef | null>;
  isPlaying: boolean;
  onTogglePlay: () => void;
  onExport: () => void;
  currentTimeMs: number;
  durationMs: number;
  compact: boolean;
}

function PreviewPanelComponent({
  playerRef,
  isPlaying,
  onTogglePlay,
  onExport,
  currentTimeMs,
  durationMs,
  compact,
}: PreviewPanelProps) {
  const { timeline, srtEntries } = useTimelineStore();
  const fps = timeline.fps || 30;
  const durationInFrames = useMemo(
    () => Math.max(1, msToFrame(timeline.podcast.durationMs || 1000, fps)),
    [fps, timeline.podcast.durationMs],
  );
  const playerInputProps = useMemo(() => ({ timeline, srtEntries }), [srtEntries, timeline]);
  const previewAreaRef = useRef<HTMLDivElement | null>(null);
  const [stageSize, setStageSize] = useState(() => ({
    width: timeline.width,
    height: timeline.height,
  }));

  useEffect(() => {
    const container = previewAreaRef.current;
    if (!container) {
      return;
    }

    const updateStageSize = () => {
      const nextStageSize = fitPreviewStage(
        container.clientWidth,
        container.clientHeight,
        timeline.width,
        timeline.height,
      );
      setStageSize(nextStageSize);
    };

    updateStageSize();

    const observer = new ResizeObserver(() => {
      updateStageSize();
    });
    observer.observe(container);

    return () => {
      observer.disconnect();
    };
  }, [timeline.height, timeline.width]);

  return (
    <SurfaceCard variant="elevated" padding="none" className={styles.root}>
      <div className={styles.header}>
        <PanelHeader
          eyebrow="PREVIEW"
          title="播客预览"
          meta={<Badge variant="neutral">{timeline.width} × {timeline.height} · {fps}fps</Badge>}
        />
      </div>

      <div
        ref={previewAreaRef}
        className={styles.stageArea}
        style={{ padding: compact ? 16 : 24 }}
      >
        <div
          className={styles.stageFrame}
          style={{
            width: Math.max(0, stageSize.width),
            height: Math.max(0, stageSize.height),
          }}
        >
          <Player
            ref={playerRef}
            component={PodcastComposition}
            inputProps={playerInputProps}
            durationInFrames={durationInFrames}
            fps={fps}
            compositionWidth={timeline.width}
            compositionHeight={timeline.height}
            controls={false}
            style={{
              width: '100%',
              height: '100%',
              display: 'block',
              background: '#000',
            }}
          />
        </div>
      </div>

      <div
        className={[
          styles.footer,
          compact ? styles.footerCompact : '',
        ].filter(Boolean).join(' ')}
      >
        <div
          className={[
            styles.footerCluster,
            compact ? styles.footerClusterCompact : '',
          ].filter(Boolean).join(' ')}
        >
          <Button
            onClick={onTogglePlay}
            variant={isPlaying ? 'tint' : 'secondary'}
            size="lg"
            className={styles.playButton}
          >
            {isPlaying ? '⏸ 暂停' : '▶ 播放'}
          </Button>

          <div className={styles.statusRow}>
            <div className={styles.timeBadge}>
              {formatTime(currentTimeMs)} / {formatTime(durationMs)}
            </div>
            <div>
              <Badge variant={isPlaying ? 'info' : 'neutral'}>
                {isPlaying ? '● 播放中' : '⏸ 已暂停'}
              </Badge>
            </div>
          </div>
        </div>

        <Button
          onClick={onExport}
          variant="danger"
          size="lg"
          className={[
            styles.exportButton,
            compact ? styles.exportButtonCompact : '',
          ].filter(Boolean).join(' ')}
        >
          导出 MP4
        </Button>
      </div>
    </SurfaceCard>
  );
}

export const PreviewPanel = memo(PreviewPanelComponent);
