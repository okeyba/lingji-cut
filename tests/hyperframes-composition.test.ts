import { describe, expect, it } from 'vitest';
import { createHyperframesComposition } from '../src/hyperframes/composition';
import { createDefaultTextData } from '../src/lib/text-templates';
import {
  createDefaultSubtitleStyle,
  createDefaultTimeline,
  DEFAULT_AUDIO_OVERLAY_TRACK_ID,
  DEFAULT_VISUAL_TRACK_ID,
  type OverlayItem,
  type SrtEntry,
  type TimelineData,
} from '../src/types';

function makeTimeline(overlays: OverlayItem[] = []): TimelineData {
  return {
    ...createDefaultTimeline(),
    fps: 30,
    width: 1920,
    height: 1080,
    podcast: {
      audioPath: '/tmp/podcast.wav',
      srtPath: '',
      durationMs: 8_000,
    },
    tracks: [
      ...createDefaultTimeline().tracks,
      {
        id: DEFAULT_AUDIO_OVERLAY_TRACK_ID,
        kind: 'audio',
        label: '音轨 1',
        order: 1,
      },
    ],
    overlays,
    subtitle: {
      ...createDefaultSubtitleStyle(),
      fontSize: 56,
      highlightEnabled: true,
      highlightBackgroundColor: '#F8DC48',
      highlightTextColor: '#111827',
    },
    subtitleHighlights: [
      {
        entryIndex: 1,
        start: 8,
        end: 12,
        highlightText: '世界冠军',
        sourceText: '中国品牌首次拿下世界冠军',
      },
    ],
  };
}

const entries: SrtEntry[] = [
  {
    index: 1,
    startMs: 0,
    endMs: 2_000,
    text: '中国品牌首次拿下世界冠军',
  },
];

describe('createHyperframesComposition', () => {
  it('renders the root composition, podcast audio, subtitles and timeline registration', () => {
    const composition = createHyperframesComposition({
      timeline: makeTimeline(),
      srtEntries: entries,
      gsapSrc: './gsap.min.js',
    });

    expect(composition.durationMs).toBe(8_000);
    expect(composition.html).toContain('data-composition-id="lingji-composition"');
    expect(composition.html).toContain('id="lingji-composition"');
    expect(composition.html).toContain('id="podcast-audio"');
    expect(composition.html).toContain('/tmp/podcast.wav');
    expect(composition.html).toContain('window.__timelines["lingji-composition"] = tl');
    expect(composition.html).toContain('中国品牌首次拿下');
    expect(composition.html).toContain('hf-subtitle-highlight');
  });

  it('renders image, video, audio and text overlays as HyperFrames timed clips', () => {
    const overlays: OverlayItem[] = [
      {
        id: 'image-1',
        type: 'image',
        assetPath: '/tmp/cover.png',
        trackId: DEFAULT_VISUAL_TRACK_ID,
        startMs: 0,
        durationMs: 5_000,
        position: { x: 0, y: 0, width: 1920, height: 1080 },
      },
      {
        id: 'video-1',
        type: 'video',
        assetPath: '/tmp/intro.mp4',
        trackId: DEFAULT_VISUAL_TRACK_ID,
        startMs: 1_000,
        durationMs: 3_000,
        position: { x: 100, y: 80, width: 640, height: 360 },
      },
      {
        id: 'text-1',
        type: 'text',
        assetPath: '',
        trackId: DEFAULT_VISUAL_TRACK_ID,
        startMs: 500,
        durationMs: 4_000,
        position: { x: 120, y: 180, width: 800, height: 220 },
        textData: createDefaultTextData({ content: '测试文字', bold: true, strokeWidth: 2 }),
      },
      {
        id: 'audio-1',
        type: 'audio',
        assetPath: '/tmp/music.mp3',
        trackId: DEFAULT_AUDIO_OVERLAY_TRACK_ID,
        startMs: 0,
        durationMs: 4_000,
        position: { x: 0, y: 0, width: 0, height: 0 },
        audioData: {
          volume: 0.6,
          fadeInMs: 0,
          fadeOutMs: 0,
          trimStartMs: 500,
          sourceDurationMs: 6_000,
        },
      },
    ];

    const html = createHyperframesComposition({
      timeline: makeTimeline(overlays),
      srtEntries: [],
      gsapSrc: './gsap.min.js',
    }).html;

    expect(html).toContain('<img id="image-1"');
    expect(html).toContain('class="clip hf-overlay hf-media-overlay"');
    expect(html).toContain('id="image-1" class="clip hf-overlay hf-media-overlay" data-start="0" data-duration="5" data-track-index="100"');
    expect(html).toContain('src="/tmp/cover.png"');
    expect(html).toContain('<video id="video-1"');
    expect(html).toContain('id="video-1" class="clip hf-overlay hf-media-overlay" data-start="1" data-duration="3" data-track-index="102"');
    expect(html).toContain('muted playsinline');
    expect(html).toContain('<div id="text-1"');
    expect(html).toContain('class="clip hf-overlay hf-text-overlay"');
    expect(html).toContain('data-track-index="101"');
    expect(html).toContain('测试文字');
    expect(html).toContain('font-weight:700');
    expect(html).toContain('<audio id="audio-1"');
    expect(html).toContain('class="clip"');
    expect(html).toContain('data-media-start="0.5"');
    expect(html).toContain('data-volume="0.6"');
    expect(html).toContain('const overlayIds = ["image-1","text-1","video-1"]');
  });

  it('embeds AI motion card HTML and loads GSAP before fragment scripts', () => {
    const motionHtml = `<div class="custom-motion"><span>Motion Ready</span><script>
      const local = gsap.timeline({ paused: true });
      local.from(document.currentScript.parentElement, { opacity: 0, duration: 0.4 }, 0);
      window.__lingjiMotionTimelines = window.__lingjiMotionTimelines || [];
      window.__lingjiMotionTimelines.push(local);
    </script></div>`;
    const overlay: OverlayItem = {
      id: 'ai-motion-1',
      type: 'image',
      assetPath: '',
      trackId: DEFAULT_VISUAL_TRACK_ID,
      startMs: 1_000,
      durationMs: 3_000,
      position: { x: 0, y: 0, width: 1920, height: 1080 },
      overlayType: 'ai-card',
      aiCardData: {
        cardType: 'summary',
        title: 'Motion 卡片',
        content: '重点内容',
        template: 'summary-default',
        displayMode: 'fullscreen',
        renderMode: 'motion-card',
        style: { primaryColor: '#7df9ff', backgroundColor: '#151922', fontSize: 48 },
        motionCard: {
          html: motionHtml,
          compiledAt: 1,
          prompt: 'test',
          retryCount: 0,
        },
      },
    };

    const html = createHyperframesComposition({
      timeline: makeTimeline([overlay]),
      srtEntries: [],
      gsapSrc: './gsap.min.js',
    }).html;

    expect(html).toContain('Motion Ready');
    expect(html).toContain('const motionTimelines = window.__lingjiMotionTimelines || []');
    expect(html.indexOf('gsap.min.js')).toBeLessThan(html.indexOf('custom-motion'));
  });

  it('can point GSAP at a packaged local asset', () => {
    const html = createHyperframesComposition({
      timeline: makeTimeline(),
      srtEntries: [],
      gsapSrc: './gsap.min.js',
    }).html;

    expect(html).toContain('<script src="./gsap.min.js"></script>');
  });

  it('can inline GSAP for the preview player srcdoc', () => {
    const html = createHyperframesComposition({
      timeline: makeTimeline(),
      srtEntries: [],
      gsapScript: 'window.gsap={}; // </script> guard',
    }).html;

    expect(html).toContain('window.gsap={}; // <\\/script> guard');
    expect(html).not.toContain('cdn.jsdelivr');
  });

  it('rejects missing motion payloads instead of rendering legacy AI card HTML', () => {
    const overlay: OverlayItem = {
      id: 'ai-quote-1',
      type: 'image',
      assetPath: '',
      trackId: DEFAULT_VISUAL_TRACK_ID,
      startMs: 0,
      durationMs: 5_000,
      position: { x: 0, y: 0, width: 1920, height: 1080 },
      overlayType: 'ai-card',
      aiCardData: {
        cardType: 'quote',
        title: '引用',
        content: '重点内容',
        template: 'quote-default',
        displayMode: 'fullscreen',
        renderMode: 'motion-card',
        style: { primaryColor: '#ec4899', backgroundColor: '#0f172a', fontSize: 48 },
      },
    };

    expect(() =>
      createHyperframesComposition({
        timeline: makeTimeline([overlay]),
        srtEntries: [],
        gsapSrc: './gsap.min.js',
      }),
    ).toThrow(/缺少 HyperFrames HTML/);
  });
});
