import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('HyperframesPreviewPlayer contract', () => {
  const source = readFileSync(
    new URL('../src/components/HyperframesPreviewPlayer.tsx', import.meta.url),
    'utf8',
  );

  it('exposes playback controls through the editor player ref', () => {
    expect(source).toContain("play: () => playerRef.current?.play()");
    expect(source).toContain("pause: () => playerRef.current?.pause()");
    expect(source).toContain('playerRef.current?.seek(Math.max(0, ms) / 1000)');
    expect(source).toContain('isPlaying: () => !!playerRef.current && !playerRef.current.paused');
  });

  it('bridges HyperFrames player events back to editor time state', () => {
    expect(source).toContain("player.addEventListener('timeupdate', handleTimeUpdate)");
    expect(source).toContain("player.addEventListener('play', onPlay)");
    expect(source).toContain("player.addEventListener('pause', onPause)");
    expect(source).toContain("player.addEventListener('ended', onEnded)");
    expect(source).toContain('onTimeUpdate(Math.round(seconds * 1000))');
  });

  it('seeks HyperFrames when the timeline playhead changes externally', () => {
    expect(source).toContain('const delta = Math.abs(player.currentTime * 1000 - currentTimeMs)');
    expect(source).toContain('if (delta > 250)');
    expect(source).toContain('player.seek(Math.max(0, currentTimeMs) / 1000)');
  });
});
