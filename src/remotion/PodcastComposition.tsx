import type { ExportRenderConfig } from '../lib/export-settings';
import { AbsoluteFill, Audio, Sequence, useVideoConfig } from 'remotion';
import { getRenderableOverlays } from '../lib/timeline-tracks';
import type { SrtEntry, TimelineData } from '../types';
import { resolveRemotionAssetSrc } from '../lib/remotion-assets';
import { msToFrame } from '../lib/utils';
import { AICardOverlay } from './AICardOverlay';
import { AudioOverlay } from './AudioOverlay';
import { MediaOverlay } from './MediaOverlay';
import { SubtitleTrack } from './SubtitleTrack';
import { TextOverlay } from './TextOverlay';

interface PodcastCompositionProps {
  timeline: TimelineData;
  srtEntries: SrtEntry[];
  renderConfig?: ExportRenderConfig | null;
}

export function PodcastComposition({ timeline, srtEntries }: PodcastCompositionProps) {
  const { width, height } = useVideoConfig();
  const previewScale = Math.min(width / timeline.width, height / timeline.height);
  const renderableOverlays = getRenderableOverlays(timeline);
  const audioOverlays = renderableOverlays.filter((overlay) => overlay.type === 'audio');
  const visualOverlays = renderableOverlays.filter((overlay) => overlay.type !== 'audio');
  // AI 卡片需要独立计数以显示章节序号
  let aiCardIndex = 0;

  // 主口播音轨必须按真实时长收尾：若 composition 因追加素材被拉长，
  // 赤膊的 <Audio> 会让浏览器 media element 在越过音频原生末端时出现
  // 0.x 秒的回踩 / 残响，再归零静音。用 <Sequence> 显式截断，和 AudioOverlay
  // 保持同一模式。
  const podcastDurationInFrames = Math.max(
    1,
    msToFrame(Math.max(0, timeline.podcast.durationMs ?? 0), timeline.fps),
  );

  return (
    <AbsoluteFill style={{ background: '#04060a', overflow: 'hidden' }}>
      {timeline.podcast.audioPath && timeline.podcast.durationMs > 0 ? (
        <Sequence from={0} durationInFrames={podcastDurationInFrames}>
          <Audio src={resolveRemotionAssetSrc(timeline.podcast.audioPath)} />
        </Sequence>
      ) : null}

      {audioOverlays.map((overlay) => (
        <AudioOverlay key={overlay.id} overlay={overlay} fps={timeline.fps} />
      ))}

      <div
        style={{
          position: 'absolute',
          inset: 0,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: timeline.width,
            height: timeline.height,
            transform: `scale(${previewScale})`,
            transformOrigin: 'top left',
          }}
        >
          {visualOverlays.map((overlay) => {
            if (overlay.overlayType === 'ai-card') {
              aiCardIndex += 1;
              return (
                <AICardOverlay
                  key={overlay.id}
                  overlay={overlay}
                  fps={timeline.fps}
                  chapterIndex={aiCardIndex}
                />
              );
            }
            if (overlay.type === 'text') {
              return <TextOverlay key={overlay.id} overlay={overlay} fps={timeline.fps} />;
            }
            return <MediaOverlay key={overlay.id} overlay={overlay} fps={timeline.fps} />;
          })}

          <SubtitleTrack
            entries={srtEntries}
            style={timeline.subtitle}
            highlights={timeline.subtitleHighlights}
          />
        </div>
      </div>
    </AbsoluteFill>
  );
}
