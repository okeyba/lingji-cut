import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {
  loadProjectFile,
  saveProjectSection,
} from '../electron/project-file';

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'proj-test-'));
});

afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});

describe('loadProjectFile', () => {
  it('空目录返回默认 ProjectData', async () => {
    const data = await loadProjectFile(tmpDir);
    expect(data.version).toBe(1);
    expect(data.timeline).toBeNull();
  });

  it('已有 project.json 则读取', async () => {
    const existing = {
      version: 1,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      timeline: { podcast: { audioPath: '/test.mp3', srtPath: '', durationMs: 0 }, overlays: [], subtitleConfig: {}, globalBackground: '' },
      aiAnalysis: { analysisResult: null, coverCandidates: [], motionCards: [] },
      script: { templateId: 't', annotations: [], reviewState: 'idle', lastReviewedDocVersion: 0 },
    };
    await fs.writeFile(path.join(tmpDir, 'project.json'), JSON.stringify(existing));
    const data = await loadProjectFile(tmpDir);
    expect(data.timeline?.podcast?.audioPath).toBe('/test.mp3');
  });

  it('已有旧版 project.json 但缺少 motionCards 时，不再从 ai-analysis.json 补回旧 AI 数据', async () => {
    const existing = {
      version: 1,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      timeline: null,
      aiAnalysis: { analysisResult: null, coverCandidates: [] },
      script: { templateId: 't', annotations: [], reviewState: 'idle', lastReviewedDocVersion: 0 },
    };
    const legacyAI = {
      version: 1,
      analysisResult: null,
      coverCandidates: [],
      motionCards: [
        {
          id: 'motion-legacy',
          type: 'motion',
          title: '遗留动画',
          content: '遗留动画内容',
          startMs: 0,
          endMs: 5_000,
          displayDurationMs: 5_000,
          displayMode: 'fullscreen',
          template: 'motion-default',
          enabled: true,
          style: {
            primaryColor: '#7df9ff',
            backgroundColor: '#151922',
            fontSize: 48,
          },
          renderMode: 'motion-card',
          motionCard: {
            prompt: '遗留动画提示词',
            sourceCode: 'const MotionComponent = () => null;',
            compiledCode: 'const MotionComponent = () => null;',
            compiledAt: 1,
            retryCount: 0,
          },
        },
      ],
    };

    await fs.writeFile(path.join(tmpDir, 'project.json'), JSON.stringify(existing));
    await fs.writeFile(path.join(tmpDir, 'ai-analysis.json'), JSON.stringify(legacyAI));

    const data = await loadProjectFile(tmpDir);

    expect(data.aiAnalysis.motionCards).toEqual([]);
  });

  it('从旧文件迁移：timeline.json + ai-analysis.json + script-state.json', async () => {
    const timeline = { podcast: { audioPath: '/old.mp3', srtPath: '/old.srt', durationMs: 5000 }, overlays: [], subtitleConfig: {}, globalBackground: '' };
    const aiState = {
      version: 1,
      analysisResult: null,
      coverCandidates: [],
      motionCards: [
        {
          id: 'motion-1',
          type: 'motion',
          title: '旧动画',
          content: '旧动画内容',
          startMs: 0,
          endMs: 5000,
          displayDurationMs: 5000,
          displayMode: 'fullscreen',
          template: 'motion-default',
          enabled: true,
          style: {
            primaryColor: '#7df9ff',
            backgroundColor: '#151922',
            fontSize: 48,
          },
          renderMode: 'motion-card',
          motionCard: {
            prompt: '旧动画提示词',
            sourceCode: 'const MotionComponent = () => null;',
            compiledCode: 'const MotionComponent = () => null;',
            compiledAt: 1,
            retryCount: 0,
          },
        },
      ],
    };
    const scriptState = { version: 2, templateId: 'news', annotations: [], reviewState: 'clean', lastReviewedDocVersion: 1, createdAt: '2026-01-01', updatedAt: '2026-01-01' };

    await fs.writeFile(path.join(tmpDir, 'timeline.json'), JSON.stringify(timeline));
    await fs.writeFile(path.join(tmpDir, 'ai-analysis.json'), JSON.stringify(aiState));
    await fs.writeFile(path.join(tmpDir, 'script-state.json'), JSON.stringify(scriptState));

    const data = await loadProjectFile(tmpDir);
    expect(data.timeline?.podcast?.audioPath).toBe('/old.mp3');
    expect(data.aiAnalysis.analysisResult).toBeNull();
    expect(data.aiAnalysis.motionCards).toEqual([]);
    expect(data.script.templateId).toBe('news');

    // 旧文件应被删除
    const files = await fs.readdir(tmpDir);
    expect(files).toContain('project.json');
    expect(files).not.toContain('timeline.json');
    expect(files).not.toContain('ai-analysis.json');
    expect(files).not.toContain('script-state.json');
  });
});

describe('saveProjectSection', () => {
  it('写入 timeline 段并保留其他段', async () => {
    await loadProjectFile(tmpDir);
    const newTimeline = { podcast: { audioPath: '/new.mp3', srtPath: '', durationMs: 0 }, overlays: [], subtitleConfig: {}, globalBackground: '' };
    await saveProjectSection(tmpDir, 'timeline', newTimeline);
    const raw = JSON.parse(await fs.readFile(path.join(tmpDir, 'project.json'), 'utf-8'));
    expect(raw.timeline.podcast.audioPath).toBe('/new.mp3');
    expect(raw.aiAnalysis).toBeDefined();
    expect(raw.script).toBeDefined();
  });

  it('并发写入不损坏文件', async () => {
    await loadProjectFile(tmpDir);
    await Promise.all([
      saveProjectSection(tmpDir, 'timeline', { podcast: { audioPath: '/a.mp3', srtPath: '', durationMs: 0 }, overlays: [], subtitleConfig: {}, globalBackground: '' }),
      saveProjectSection(tmpDir, 'aiAnalysis', {
        analysisResult: null,
        coverCandidates: [{ id: '1', prompt: 'p', imageUrl: '/img.png', selected: true }],
        motionCards: [],
      }),
      saveProjectSection(tmpDir, 'script', { templateId: 'custom', annotations: [], reviewState: 'idle', lastReviewedDocVersion: 0 }),
    ]);
    const raw = JSON.parse(await fs.readFile(path.join(tmpDir, 'project.json'), 'utf-8'));
    expect(raw.timeline.podcast.audioPath).toBe('/a.mp3');
    expect(raw.aiAnalysis.coverCandidates).toHaveLength(1);
    expect(raw.script.templateId).toBe('custom');
  });

  it('保存 aiAnalysis 段时会保留 motionCards', async () => {
    await loadProjectFile(tmpDir);

    await saveProjectSection(tmpDir, 'aiAnalysis', {
      analysisResult: null,
      coverCandidates: [],
      motionCards: [
        {
          id: 'motion-1',
          segmentId: 'motion-1',
          type: 'motion',
          title: '动画 1',
          content: '动画内容',
          startMs: 0,
          endMs: 4000,
          displayDurationMs: 4000,
          displayMode: 'fullscreen',
          template: 'motion-default',
          enabled: true,
          style: {
            primaryColor: '#7df9ff',
            backgroundColor: '#151922',
            fontSize: 48,
          },
          renderMode: 'motion-card',
          motionCard: {
            prompt: '做一个标题呼吸动画',
            sourceCode: 'const MotionComponent = () => null;',
            compiledCode: 'const MotionComponent = () => null;',
            compiledAt: 1,
            retryCount: 0,
          },
        },
      ],
    });

    const raw = JSON.parse(await fs.readFile(path.join(tmpDir, 'project.json'), 'utf-8'));
    expect(raw.aiAnalysis.motionCards).toHaveLength(1);
    expect(raw.aiAnalysis.motionCards[0].id).toBe('motion-1');
    expect(raw.aiAnalysis.motionCards[0].motionCard.prompt).toBe('做一个标题呼吸动画');
  });
});
