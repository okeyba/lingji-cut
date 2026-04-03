import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { materializePersistedAIState, materializeTimelineWebCards } from '../electron/web-card-storage';
import type { PersistedAIState } from '../src/lib/ai-persistence';
import type { TimelineData } from '../src/types';

const tempDirs: string[] = [];

async function createTempProjectDir(): Promise<string> {
  const projectDir = await fs.mkdtemp(path.join(os.tmpdir(), 'podcast-web-card-'));
  tempDirs.push(projectDir);
  return projectDir;
}

afterEach(async () => {
  await Promise.all(
    tempDirs.splice(0, tempDirs.length).map((dir) => fs.rm(dir, { recursive: true, force: true })),
  );
});

describe('materializePersistedAIState', () => {
  it('writes inline srcDoc to a standalone html file and rewrites the payload to src', async () => {
    const projectDir = await createTempProjectDir();
    const persistedState: PersistedAIState = {
      version: 1,
      analysisResult: {
        cards: [
          {
            id: 'card-1',
            type: 'summary',
            title: '网页卡片',
            content: '重点内容',
            startMs: 0,
            endMs: 1_000,
            displayDurationMs: 5_000,
            displayMode: 'fullscreen',
            template: 'summary-default',
            enabled: true,
            renderMode: 'web-card',
            webCard: {
              srcDoc: '<!doctype html><html><body><div>hello</div></body></html>',
            },
            style: {
              primaryColor: '#6366f1',
              backgroundColor: '#0f172a',
              fontSize: 48,
            },
          },
        ],
        coverPrompts: [],
        summary: '',
        keywords: [],
      },
      coverCandidates: [],
    };

    const result = await materializePersistedAIState(projectDir, persistedState);

    expect(result.changed).toBe(true);
    expect(result.data.analysisResult?.cards[0]?.webCard?.srcDoc).toBeUndefined();
    expect(result.data.analysisResult?.cards[0]?.webCard?.src).toBe(
      path.join(projectDir, 'ai-cards', 'card-1.html'),
    );

    const html = await fs.readFile(path.join(projectDir, 'ai-cards', 'card-1.html'), 'utf-8');
    expect(html).toContain('data-web-card-normalized="true"');
    expect(html).toContain('data-web-card-autoscale="true"');
  });
});

describe('materializeTimelineWebCards', () => {
  it('rewrites timeline ai-card overlays to referenced html files', async () => {
    const projectDir = await createTempProjectDir();
    const timeline: TimelineData = {
      version: 2,
      fps: 30,
      width: 1920,
      height: 1080,
      podcast: {
        audioPath: '',
        srtPath: '',
        durationMs: 0,
      },
      tracks: [],
      overlays: [
        {
          id: 'overlay-1',
          type: 'image',
          assetPath: '',
          trackId: 'visual-1',
          startMs: 0,
          durationMs: 5_000,
          position: { x: 0, y: 0, width: 1920, height: 1080 },
          overlayType: 'ai-card',
          aiCardData: {
            sourceCardId: 'card-1',
            cardType: 'summary',
            title: '网页卡片',
            content: '重点内容',
            template: 'summary-default',
            displayMode: 'fullscreen',
            renderMode: 'web-card',
            webCard: {
              srcDoc: '<!doctype html><html><body><div>timeline</div></body></html>',
            },
            style: {
              primaryColor: '#6366f1',
              backgroundColor: '#0f172a',
              fontSize: 48,
            },
          },
        },
      ],
      subtitle: {
        fontSize: 48,
        color: '#FFFFFF',
        position: 'bottom',
      },
    };

    const result = await materializeTimelineWebCards(projectDir, timeline);

    expect(result.changed).toBe(true);
    expect(result.data.overlays[0]?.aiCardData?.webCard?.src).toBe(
      path.join(projectDir, 'ai-cards', 'card-1.html'),
    );
    expect(result.data.overlays[0]?.aiCardData?.webCard?.srcDoc).toBeUndefined();
  });
});
