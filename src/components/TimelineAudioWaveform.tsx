import { useEffect, useMemo, useState } from 'react';
import { toFileSrc } from '../lib/utils';

interface TimelineAudioWaveformProps {
  audioPath: string;
  durationMs: number;
  trackWidth: number;
  trackHeight: number;
}

const waveformPeakCache = new Map<string, Promise<number[]>>();

function combineChannelPeaks(peaks: Array<Float32Array | number[]>): number[] {
  const maxLength = peaks.reduce((length, channel) => Math.max(length, channel.length), 0);

  return Array.from({ length: maxLength }, (_, index) =>
    peaks.reduce((peak, channel) => Math.max(peak, Math.abs(channel[index] ?? 0)), 0),
  );
}

async function loadWaveformPeaks(audioPath: string, durationMs: number): Promise<number[]> {
  const cacheKey = `${audioPath}:${durationMs}`;
  const cached = waveformPeakCache.get(cacheKey);

  if (cached) {
    return cached;
  }

  const pending = (async () => {
    const { default: WaveSurfer } = await import('wavesurfer.js');
    const host = document.createElement('div');

    host.style.position = 'fixed';
    host.style.left = '-99999px';
    host.style.top = '0';
    host.style.width = '1px';
    host.style.height = '1px';
    host.style.opacity = '0';
    document.body.appendChild(host);

    const wavesurfer = WaveSurfer.create({
      container: host,
      width: 1,
      height: 1,
      waveColor: '#0ea5e9',
      progressColor: '#0ea5e9',
      cursorWidth: 0,
      interact: false,
      hideScrollbar: true,
      backend: 'WebAudio',
      sampleRate: 8_000,
    });

    try {
      await wavesurfer.load(toFileSrc(audioPath));
      const resolution = Math.max(240, Math.min(4_000, Math.round(durationMs / 20)));
      return combineChannelPeaks(wavesurfer.exportPeaks({ maxLength: resolution }));
    } finally {
      wavesurfer.destroy();
      host.remove();
    }
  })().catch((error) => {
    waveformPeakCache.delete(cacheKey);
    throw error;
  });

  waveformPeakCache.set(cacheKey, pending);
  return pending;
}

function sampleWaveformPeaks(peaks: number[], targetLength: number): number[] {
  if (peaks.length === 0 || targetLength <= 0) {
    return [];
  }

  if (peaks.length <= targetLength) {
    return peaks;
  }

  const bucketSize = peaks.length / targetLength;

  return Array.from({ length: targetLength }, (_, bucketIndex) => {
    const start = Math.floor(bucketIndex * bucketSize);
    const end = Math.min(peaks.length, Math.ceil((bucketIndex + 1) * bucketSize));
    let peak = 0;

    for (let index = start; index < end; index += 1) {
      peak = Math.max(peak, peaks[index] ?? 0);
    }

    return peak;
  });
}

export function TimelineAudioWaveform({
  audioPath,
  durationMs,
  trackWidth,
  trackHeight,
}: TimelineAudioWaveformProps) {
  const [peaks, setPeaks] = useState<number[] | null>(null);

  useEffect(() => {
    let cancelled = false;

    if (!audioPath || typeof window === 'undefined' || typeof document === 'undefined') {
      setPeaks(null);
      return;
    }

    void loadWaveformPeaks(audioPath, durationMs)
      .then((nextPeaks) => {
        if (!cancelled) {
          setPeaks(nextPeaks);
        }
      })
      .catch((error) => {
        console.error('加载音频波形失败:', error);
        if (!cancelled) {
          setPeaks([]);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [audioPath, durationMs]);

  const barCount = Math.min(2_400, Math.max(48, Math.floor(trackWidth / 3)));
  const sampledPeaks = useMemo(
    () => sampleWaveformPeaks(peaks ?? [], barCount),
    [barCount, peaks],
  );
  const maxBarHeight = Math.max(8, trackHeight - 10);

  if (!audioPath) {
    return null;
  }

  if (!peaks || sampledPeaks.length === 0) {
    return (
      <div
        data-waveform-shell="true"
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          padding: '0 8px',
          boxSizing: 'border-box',
        }}
      >
        <div
          style={{
            width: '100%',
            height: 1,
            background:
              'linear-gradient(90deg, rgba(56, 189, 248, 0.2), rgba(56, 189, 248, 0.65), rgba(56, 189, 248, 0.2))',
          }}
        />
      </div>
    );
  }

  return (
    <div
      data-waveform-shell="true"
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        alignItems: 'flex-end',
        gap: 1,
        padding: '5px 0',
        boxSizing: 'border-box',
      }}
    >
      {sampledPeaks.map((peak, index) => (
        <span
          key={`wave-peak-${index}`}
          style={{
            flex: '1 0 0',
            minWidth: 1,
            height: `${Math.max(2, Math.round(peak * maxBarHeight))}px`,
            background: 'linear-gradient(180deg, rgba(125, 211, 252, 0.95), rgba(14, 165, 233, 0.55))',
            borderRadius: 999,
            boxShadow: '0 0 10px rgba(56, 189, 248, 0.2)',
          }}
        />
      ))}
    </div>
  );
}
