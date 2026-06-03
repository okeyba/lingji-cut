import { getRenderableOverlays, getRenderableVisualTracks } from '../lib/timeline-tracks';
import { getEffectiveTimelineDurationMs } from '../lib/utils';
import type { OverlayItem, SrtEntry, TimelineData } from '../types';
import { durationFrames, msToFrames } from './frames';

const VISUAL_BASE_Z_INDEX = 10;
const BACKGROUND_Z_INDEX = 1;
export const SUBTITLE_Z_INDEX = 1000;

export type RenderableClipKind = 'video' | 'image' | 'text' | 'ai-card';

export interface RenderableClip {
  id: string;
  kind: RenderableClipKind;
  overlay: OverlayItem;
  startFrame: number;
  durationFrames: number;
  zIndex: number;
}

export interface RenderableAudio {
  id: string;
  assetPath: string;
  startFrame: number;
  durationFrames: number;
  trimStartMs: number;
  volume: number;
}

export interface RenderableSubtitle {
  index: number;
  text: string;
  startFrame: number;
  durationFrames: number;
}

export interface RenderPlan {
  width: number;
  height: number;
  fps: number;
  durationFrames: number;
  visual: RenderableClip[];
  audio: RenderableAudio[];
  subtitles: RenderableSubtitle[];
}

function trackZIndex(timeline: TimelineData, overlay: OverlayItem): number {
  if (overlay.overlayRole === 'default-background') return BACKGROUND_Z_INDEX;
  const map = new Map(getRenderableVisualTracks(timeline.tracks).map((t) => [t.id, t.order]));
  return VISUAL_BASE_Z_INDEX + (map.get(overlay.trackId) ?? 0);
}

export function buildRenderPlan(timeline: TimelineData, srt: SrtEntry[], fpsArg?: number): RenderPlan {
  const fps = fpsArg ?? timeline.fps ?? 30;
  const durationMs = getEffectiveTimelineDurationMs(timeline);
  const renderable = getRenderableOverlays(timeline);
  const visual: RenderableClip[] = [];
  const audio: RenderableAudio[] = [];

  for (const overlay of renderable) {
    if (overlay.type === 'audio') {
      const d = overlay.audioData;
      audio.push({
        id: overlay.id,
        assetPath: overlay.assetPath,
        startFrame: msToFrames(overlay.startMs, fps),
        durationFrames: durationFrames(overlay.durationMs, fps),
        trimStartMs: d?.trimStartMs ?? 0,
        volume: d?.muted ? 0 : Math.max(0, Math.min(1.5, d?.volume ?? 1)),
      });
      continue;
    }
    const kind: RenderableClipKind = overlay.overlayType === 'ai-card' ? 'ai-card' : overlay.type;
    visual.push({
      id: overlay.id,
      kind,
      overlay,
      startFrame: msToFrames(overlay.startMs, fps),
      durationFrames: durationFrames(overlay.durationMs, fps),
      zIndex: trackZIndex(timeline, overlay),
    });
  }

  if (timeline.podcast.audioPath) {
    audio.unshift({
      id: 'podcast-audio',
      assetPath: timeline.podcast.audioPath,
      startFrame: 0,
      durationFrames: durationFrames(timeline.podcast.durationMs || durationMs, fps),
      trimStartMs: 0,
      volume: 1,
    });
  }

  const subtitles: RenderableSubtitle[] = srt.map((e, index) => ({
    index,
    text: e.text,
    startFrame: msToFrames(e.startMs, fps),
    durationFrames: durationFrames(Math.max(1, e.endMs - e.startMs), fps),
  }));

  return {
    width: timeline.width,
    height: timeline.height,
    fps,
    durationFrames: durationFrames(durationMs, fps),
    visual,
    audio,
    subtitles,
  };
}
