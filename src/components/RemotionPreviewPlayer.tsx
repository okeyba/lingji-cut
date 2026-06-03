import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { Player, type PlayerRef } from '@remotion/player';
import { MainComposition } from '../remotion/MainComposition';
import { buildRenderPlan } from '../remotion/timeline-to-sequences';
import { collectMotionCards } from '../remotion/collect-cards';
import type { SrtEntry, TimelineData } from '../types';

export interface RemotionPreviewHandle {
  play: () => void;
  pause: () => void;
  seekToMs: (ms: number) => void;
  isPlaying: () => boolean;
  setVolume: (volume: number) => void;
  mute: () => void;
  unmute: () => void;
}

interface RemotionPreviewPlayerProps {
  timeline: TimelineData;
  srtEntries: SrtEntry[];
  /** 预览用 toFileSrc 处理绝对路径，projectDir 暂不参与路径改写，保留以兼容调用方。 */
  projectDir?: string | null;
  currentTimeMs: number;
  onTimeUpdate: (timeMs: number) => void;
  onPlay: () => void;
  onPause: () => void;
  onEnded: () => void;
}

export const RemotionPreviewPlayer = forwardRef<RemotionPreviewHandle, RemotionPreviewPlayerProps>(
  function RemotionPreviewPlayer(
    { timeline, srtEntries, currentTimeMs, onTimeUpdate, onPlay, onPause, onEnded },
    ref,
  ) {
    const player = useRef<PlayerRef>(null);
    const plan = useMemo(
      () => buildRenderPlan(timeline, srtEntries, timeline.fps ?? 30),
      [timeline, srtEntries],
    );
    const fps = plan.fps;
    const suppressSeek = useRef(false);

    // 预览前把 motion 卡片 TSX 编译为可执行 JS（主进程 esbuild），供 CardHost 求值。
    const [compiledCards, setCompiledCards] = useState<Record<string, string>>({});
    const cardSources = useMemo(() => collectMotionCards(timeline), [timeline]);
    useEffect(() => {
      let cancelled = false;
      if (cardSources.length === 0) {
        setCompiledCards({});
        return;
      }
      const compile = window.electronAPI?.compileMotionCards;
      if (!compile) return;
      void compile(cardSources).then((map) => {
        if (!cancelled) setCompiledCards(map);
      });
      return () => {
        cancelled = true;
      };
    }, [cardSources]);

    useImperativeHandle(ref, () => ({
      play: () => player.current?.play(),
      pause: () => player.current?.pause(),
      seekToMs: (ms: number) => {
        suppressSeek.current = true;
        player.current?.seekTo(Math.round((Math.max(0, ms) / 1000) * fps));
        window.setTimeout(() => {
          suppressSeek.current = false;
        }, 0);
      },
      isPlaying: () => !!player.current?.isPlaying(),
      setVolume: (volume: number) => player.current?.setVolume(Math.max(0, Math.min(1, volume))),
      mute: () => player.current?.mute(),
      unmute: () => player.current?.unmute(),
    }));

    useEffect(() => {
      const p = player.current;
      if (!p) return;
      const handleFrame = (e: { detail: { frame: number } }) =>
        onTimeUpdate(Math.round((e.detail.frame / fps) * 1000));
      p.addEventListener('frameupdate', handleFrame);
      p.addEventListener('play', onPlay);
      p.addEventListener('pause', onPause);
      p.addEventListener('ended', onEnded);
      return () => {
        p.removeEventListener('frameupdate', handleFrame);
        p.removeEventListener('play', onPlay);
        p.removeEventListener('pause', onPause);
        p.removeEventListener('ended', onEnded);
      };
    }, [fps, onTimeUpdate, onPlay, onPause, onEnded]);

    useEffect(() => {
      const p = player.current;
      if (!p || suppressSeek.current) return;
      const target = Math.round((Math.max(0, currentTimeMs) / 1000) * fps);
      if (Math.abs(p.getCurrentFrame() - target) > Math.ceil(fps * 0.25)) {
        p.seekTo(target);
      }
    }, [currentTimeMs, fps]);

    return (
      <Player
        ref={player}
        component={MainComposition}
        inputProps={{ timeline, srtEntries, compiledCards }}
        durationInFrames={plan.durationFrames}
        compositionWidth={plan.width}
        compositionHeight={plan.height}
        fps={fps}
        style={{ width: '100%', height: '100%', background: 'var(--color-preview-bg)' }}
        controls={false}
        acknowledgeRemotionLicense
      />
    );
  },
);
