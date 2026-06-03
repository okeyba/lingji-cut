import { describe, expect, it } from 'vitest';
import { buildRenderPlan } from '../src/remotion/timeline-to-sequences';
import {
  createDefaultTimeline,
  DEFAULT_VISUAL_TRACK_ID,
  type OverlayItem,
  type SrtEntry,
  type TimelineData,
} from '../src/types';

function timelineWithImage(): TimelineData {
  const timeline = createDefaultTimeline();
  timeline.podcast = { audioPath: '/p/a.mp3', srtPath: '/p/s.srt', durationMs: 4000 };
  const image: OverlayItem = {
    id: 'v1',
    type: 'image',
    assetPath: '/p/i.png',
    trackId: DEFAULT_VISUAL_TRACK_ID,
    startMs: 0,
    durationMs: 2000,
    position: { x: 0, y: 0, width: 1920, height: 1080 },
  };
  timeline.overlays = [image];
  return timeline;
}

describe('buildRenderPlan', () => {
  it('separates audio and visual clips and computes frames', () => {
    const plan = buildRenderPlan(timelineWithImage(), [], 30);
    expect(plan.durationFrames).toBeGreaterThan(0);
    const img = plan.visual.find((c) => c.id === 'v1');
    expect(img).toBeTruthy();
    expect(img!.kind).toBe('image');
    expect(img!.startFrame).toBe(0);
    expect(img!.durationFrames).toBe(60); // 2000ms @30fps
    expect(img!.zIndex).toBeGreaterThanOrEqual(10);
  });

  it('includes podcast audio as the first audio clip', () => {
    const plan = buildRenderPlan(timelineWithImage(), [], 30);
    expect(plan.audio[0]?.id).toBe('podcast-audio');
    expect(plan.audio[0]?.assetPath).toBe('/p/a.mp3');
  });

  it('maps srt entries to subtitle frames', () => {
    const srt: SrtEntry[] = [{ index: 0, startMs: 1000, endMs: 2000, text: 'hi' }];
    const plan = buildRenderPlan(timelineWithImage(), srt, 30);
    expect(plan.subtitles).toHaveLength(1);
    expect(plan.subtitles[0].startFrame).toBe(30);
    expect(plan.subtitles[0].durationFrames).toBe(30);
  });
});
