import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from 'react';
import gsapScript from 'gsap/dist/gsap.min.js?raw';
import { createHyperframesComposition } from '../hyperframes/composition';
import type { SrtEntry, TimelineData } from '../types';

export interface HyperframesPreviewHandle {
  play: () => void;
  pause: () => void;
  seekToMs: (ms: number) => void;
  isPlaying: () => boolean;
  setVolume: (volume: number) => void;
  mute: () => void;
  unmute: () => void;
}

interface HyperframesPlayerElement extends HTMLElement {
  play: () => void;
  pause: () => void;
  seek: (seconds: number) => void;
  currentTime: number;
  volume: number;
  muted: boolean;
  paused: boolean;
}

interface HyperframesPreviewPlayerProps {
  timeline: TimelineData;
  srtEntries: SrtEntry[];
  projectDir?: string | null;
  currentTimeMs: number;
  onTimeUpdate: (timeMs: number) => void;
  onPlay: () => void;
  onPause: () => void;
  onEnded: () => void;
}

export const HyperframesPreviewPlayer = forwardRef<
  HyperframesPreviewHandle,
  HyperframesPreviewPlayerProps
>(function HyperframesPreviewPlayer(
  {
    timeline,
    srtEntries,
    projectDir,
    currentTimeMs,
    onTimeUpdate,
    onPlay,
    onPause,
    onEnded,
  },
  ref,
) {
  const playerRef = useRef<HyperframesPlayerElement | null>(null);
  const suppressExternalSeekRef = useRef(false);
  const composition = useMemo(
    () => createHyperframesComposition({ timeline, srtEntries, projectDir, gsapScript }),
    [projectDir, srtEntries, timeline],
  );

  useEffect(() => {
    if (typeof window === 'undefined' || typeof HTMLElement === 'undefined') return;
    void import('@hyperframes/player');
  }, []);

  useImperativeHandle(ref, () => ({
    play: () => playerRef.current?.play(),
    pause: () => playerRef.current?.pause(),
    seekToMs: (ms: number) => {
      suppressExternalSeekRef.current = true;
      playerRef.current?.seek(Math.max(0, ms) / 1000);
      window.setTimeout(() => {
        suppressExternalSeekRef.current = false;
      }, 0);
    },
    isPlaying: () => !!playerRef.current && !playerRef.current.paused,
    setVolume: (volume: number) => {
      if (playerRef.current) {
        playerRef.current.volume = Math.max(0, Math.min(1, volume));
      }
    },
    mute: () => {
      if (playerRef.current) playerRef.current.muted = true;
    },
    unmute: () => {
      if (playerRef.current) playerRef.current.muted = false;
    },
  }));

  useEffect(() => {
    const player = playerRef.current;
    if (!player) return;

    const handleTimeUpdate = (event: Event) => {
      const detail = (event as CustomEvent<{ currentTime?: number }>).detail;
      const seconds =
        typeof detail?.currentTime === 'number'
          ? detail.currentTime
          : player.currentTime;
      onTimeUpdate(Math.round(seconds * 1000));
    };

    player.addEventListener('timeupdate', handleTimeUpdate);
    player.addEventListener('play', onPlay);
    player.addEventListener('pause', onPause);
    player.addEventListener('ended', onEnded);
    return () => {
      player.removeEventListener('timeupdate', handleTimeUpdate);
      player.removeEventListener('play', onPlay);
      player.removeEventListener('pause', onPause);
      player.removeEventListener('ended', onEnded);
    };
  }, [onEnded, onPause, onPlay, onTimeUpdate]);

  useEffect(() => {
    const player = playerRef.current;
    if (!player || suppressExternalSeekRef.current) return;
    const delta = Math.abs(player.currentTime * 1000 - currentTimeMs);
    if (delta > 250) {
      player.seek(Math.max(0, currentTimeMs) / 1000);
    }
  }, [currentTimeMs]);

  return (
    <hyperframes-player
      ref={playerRef}
      srcdoc={composition.html}
      width={composition.width}
      height={composition.height}
      style={{
        width: '100%',
        height: '100%',
        display: 'block',
        background: 'var(--color-preview-bg)',
      }}
    />
  );
});
