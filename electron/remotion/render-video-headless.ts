// 由 electron/main.ts 的 render-video IPC 处理体抽取；无行为变更。
// 唯一改动：三处 `mainWindow?.webContents.send('render-progress', X)` 替换为 `onProgress(X)`。
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { app } from 'electron';
import type { ExportConfig } from '../../src/lib/export-settings';
import type { SrtEntry, TimelineData } from '../../src/types';
import { parseSrt } from '../../src/lib/srt-parser';
import { compileCards } from './compile-card-node';
import { getRemotionBundle } from './bundle';
import { renderRemotionVideo } from './render';
import { collectMotionCards } from '../../src/remotion/collect-cards';
import { hydrateTimelineCards } from '../../src/lib/motion-card-externalize';
import { prepareTimelineForHyperframes, type HyperframesAssetDescriptor } from '../../src/hyperframes/assets';

// 以下三个辅助函数由 electron/main.ts 原样迁入（仅 render-video 使用）。

async function materializeRenderAssets(
  publicDir: string,
  assets: HyperframesAssetDescriptor[],
): Promise<void> {
  await Promise.all(
    assets.map(async (asset) => {
      const targetPath = path.join(publicDir, asset.publicPath);
      await fs.mkdir(path.dirname(targetPath), { recursive: true });

      try {
        await fs.link(asset.sourcePath, targetPath);
      } catch {
        await fs.copyFile(asset.sourcePath, targetPath);
      }
    }),
  );
}

/**
 * 从 timeline 反推项目目录：podcast-audio.mp3 / podcast-subtitles.srt 都
 * 位于 projectDir 根，用 audioPath 的 dirname 即得（项目硬约定）。
 * 用于把 ai-card MediaCardContent 的相对路径解析为绝对，再做 public 映射。
 */
function inferProjectDirFromTimeline(timeline: TimelineData): string | null {
  const audio = timeline.podcast?.audioPath;
  if (audio && path.isAbsolute(audio)) return path.dirname(audio);
  const srt = timeline.podcast?.srtPath;
  if (srt && path.isAbsolute(srt)) return path.dirname(srt);
  return null;
}

export async function createRenderPublicDir(
  timeline: TimelineData,
): Promise<{ timeline: TimelineData; publicDir: string }> {
  const projectDir = inferProjectDirFromTimeline(timeline);
  const { timeline: renderTimeline, assets } = prepareTimelineForHyperframes(
    timeline,
    projectDir,
  );
  const publicDir = await fs.mkdtemp(path.join(os.tmpdir(), 'lingjijianying-public-'));
  await materializeRenderAssets(publicDir, assets);

  return {
    timeline: renderTimeline,
    publicDir,
  };
}

export interface RenderVideoArgs {
  timeline: string;
  outputPath: string;
  exportConfig: ExportConfig;
  // Renderer 侧 store 中切分后的字幕；若未提供则回退到磁盘原始 SRT。
  // 磁盘 .srt 文件始终保持 MiniMax 原始输出（不写回），所以若只靠主进程重解析
  // 就会忽略用户的字幕重切分结果，与预览播放器不一致。
  srtEntries?: SrtEntry[];
}

export async function renderVideoHeadless(
  args: RenderVideoArgs,
  opts: { onProgress?: (fraction: number) => void } = {},
): Promise<{ outputPath: string }> {
  const onProgress = opts.onProgress ?? (() => {});

  const isDev = !app.isPackaged;
  const renderLogPrefix = '[render-video]';
  const renderStartedAt = Date.now();
  const timestamp = () => `${((Date.now() - renderStartedAt) / 1000).toFixed(2)}s`;

  const timelineData = JSON.parse(args.timeline) as TimelineData;
  const srtEntries =
    args.srtEntries && args.srtEntries.length > 0
      ? args.srtEntries
      : timelineData.podcast.srtPath
        ? parseSrt(await fs.readFile(timelineData.podcast.srtPath, 'utf-8'))
        : [];

  const cpuCount = os.cpus().length;
  const explicitConcurrency = Math.max(1, Math.floor(cpuCount / 2));

  if (isDev) {
    console.log(`${renderLogPrefix} 开始导出`, {
      outputPath: args.outputPath,
      resolution: args.exportConfig.resolution,
      quality: args.exportConfig.quality,
      cpuCount,
      explicitConcurrency,
      platform: process.platform,
      arch: process.arch,
    });
  }

  const projectPrepStart = Date.now();
  // materialize 资源到临时 publicDir，并把 timeline 内绝对素材路径改写为 assets/... 相对路径。
  const { timeline: renderTimeline, publicDir } = await createRenderPublicDir(timelineData);
  // 防御性 hydrate：若上游传来的是磁盘态（只有 tsxPath 没有内存 tsx），读回源码，保证 collectMotionCards 能拿到卡片。
  const projectDir = inferProjectDirFromTimeline(timelineData);
  const hydratedTimeline = await hydrateTimelineCards(renderTimeline, {
    readFile: async (rel) => {
      if (!projectDir) return null;
      try {
        return await fs.readFile(path.join(projectDir, rel), 'utf-8');
      } catch {
        return null;
      }
    },
  });
  // 编译 motion 卡片 TSX → CJS，随 inputProps 传入 Remotion，由 CardHost 在无头 Chrome 内求值。
  const cardSources = collectMotionCards(hydratedTimeline);
  const compiledCards = await compileCards(cardSources);
  const remotionEntry = path.join(app.getAppPath(), 'src', 'remotion', 'index.ts');

  if (isDev) {
    console.log(
      `${renderLogPrefix} 资源准备完成 耗时=${(
        (Date.now() - projectPrepStart) / 1000
      ).toFixed(2)}s cards=${cardSources.length} @${timestamp()}`,
    );
  }

  try {
    const renderStart = Date.now();
    onProgress(0.05);
    const serveUrl = await getRemotionBundle(remotionEntry, publicDir);
    await renderRemotionVideo({
      serveUrl,
      outputPath: args.outputPath,
      timeline: renderTimeline,
      srtEntries,
      compiledCards,
      quality: args.exportConfig.quality === 'quality' ? 'high' : 'standard',
      concurrency: explicitConcurrency,
      onProgress: (ratio) => onProgress(Math.max(0.05, Math.min(0.98, ratio))),
    });
    onProgress(1);

    if (isDev) {
      console.log(
        `${renderLogPrefix} remotion render 完成 总耗时=${((Date.now() - renderStart) / 1000).toFixed(2)}s`,
      );
    }

    return { outputPath: args.outputPath };
  } catch (err) {
    if (isDev) {
      console.error(`${renderLogPrefix} 导出失败 @${timestamp()}`, err);
    }
    throw err;
  } finally {
    await fs.rm(publicDir, { recursive: true, force: true });
  }
}
