import { staticFile } from 'remotion';
import type { TimelineData } from '../types';
import type { MediaCardContent } from '../types/ai';
import { toFileSrc } from './utils';

export interface RenderAssetDescriptor {
  sourcePath: string;
  publicPath: string;
}

function normalizePathLike(value: string): string {
  return value.replace(/\\/g, '/');
}

export function isRemoteUrl(value: string): boolean {
  return /^https?:\/\//.test(value);
}

export function isFileProtocolUrl(value: string): boolean {
  return value.startsWith('file://');
}

export function isAbsoluteFilesystemPath(value: string): boolean {
  const normalized = normalizePathLike(value);

  return normalized.startsWith('/') || /^[A-Za-z]:\//.test(normalized);
}

export function isBundledStaticAssetPath(value: string): boolean {
  if (!value) {
    return false;
  }

  return !isRemoteUrl(value) && !isFileProtocolUrl(value) && !isAbsoluteFilesystemPath(value);
}

function sanitizeAssetLabel(label: string): string {
  return label.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'asset';
}

function getPathExtension(sourcePath: string): string {
  const normalized = normalizePathLike(sourcePath);
  const lastDotIndex = normalized.lastIndexOf('.');
  const lastSlashIndex = normalized.lastIndexOf('/');

  if (lastDotIndex <= lastSlashIndex) {
    return '';
  }

  return normalized.slice(lastDotIndex).toLowerCase();
}

function createPublicAssetPath(sourcePath: string, label: string): string {
  return `render-assets/${sanitizeAssetLabel(label)}${getPathExtension(sourcePath)}`;
}

/**
 * 把 ai-card overlay 内 MediaCardContent 的相对 assetPath / posterPath
 * 拼成项目内绝对路径。Player 与导出渲染都需要用绝对路径才能让
 * `resolveRemotionAssetSrc` 走 file:// 分支（默认会把相对路径当 staticFile，
 * 但 ai-cards/ 目录不在 Remotion public 内，会 404）。
 *
 * - assetPath 已是绝对/远程/file:// 时不动
 * - 没有 projectDir 时不动（调用方应在持有 projectDir 时才调用）
 */
export function hydrateAICardAssetPaths(
  timeline: TimelineData,
  projectDir: string | null | undefined,
): TimelineData {
  if (!projectDir) return timeline;
  const root = projectDir.replace(/[\\/]+$/, '');

  const resolve = (value: string | null | undefined): string | null | undefined => {
    if (!value) return value;
    if (isRemoteUrl(value) || isFileProtocolUrl(value) || isAbsoluteFilesystemPath(value)) {
      return value;
    }
    const normalizedValue = value.replace(/^[\\/]+/, '');
    return `${root}/${normalizedValue}`;
  };

  let mutated = false;
  const overlays = timeline.overlays.map((overlay) => {
    const aiCardData = overlay.aiCardData;
    if (
      !aiCardData ||
      !aiCardData.content ||
      typeof aiCardData.content !== 'object' ||
      !('mediaType' in aiCardData.content)
    ) {
      return overlay;
    }
    const media = aiCardData.content as MediaCardContent;
    const nextAssetPath = resolve(media.assetPath) ?? media.assetPath;
    const nextPosterPath = resolve(media.posterPath) ?? media.posterPath;
    if (nextAssetPath === media.assetPath && nextPosterPath === media.posterPath) {
      return overlay;
    }
    mutated = true;
    return {
      ...overlay,
      aiCardData: {
        ...aiCardData,
        content: {
          ...media,
          assetPath: nextAssetPath ?? null,
          posterPath: nextPosterPath ?? media.posterPath,
        } as MediaCardContent,
      },
    };
  });

  return mutated ? { ...timeline, overlays } : timeline;
}

export function prepareTimelineForRemotionRender(
  timeline: TimelineData,
  projectDir?: string | null,
): {
  timeline: TimelineData;
  assets: RenderAssetDescriptor[];
} {
  const sourceToPublicPath = new Map<string, string>();
  const assets: RenderAssetDescriptor[] = [];
  // 先把 ai-card 内的相对路径解析成绝对，再交给 registerAsset 做 public 映射
  const hydrated = hydrateAICardAssetPaths(timeline, projectDir);
  timeline = hydrated;

  const registerAsset = (sourcePath: string, label: string): string => {
    if (!isAbsoluteFilesystemPath(sourcePath)) {
      return sourcePath;
    }

    const existing = sourceToPublicPath.get(sourcePath);
    if (existing) {
      return existing;
    }

    const publicPath = createPublicAssetPath(sourcePath, label);
    sourceToPublicPath.set(sourcePath, publicPath);
    assets.push({ sourcePath, publicPath });
    return publicPath;
  };

  return {
    timeline: {
      ...timeline,
      podcast: {
        ...timeline.podcast,
        audioPath: timeline.podcast.audioPath
          ? registerAsset(timeline.podcast.audioPath, 'audio-0')
          : timeline.podcast.audioPath,
      },
      overlays: timeline.overlays.map((overlay) => {
        const baseAssetPath = registerAsset(overlay.assetPath, overlay.id);
        const aiCardData = overlay.aiCardData;
        if (
          aiCardData &&
          aiCardData.content &&
          typeof aiCardData.content === 'object' &&
          'mediaType' in aiCardData.content
        ) {
          const media = aiCardData.content as MediaCardContent;
          const newMedia: MediaCardContent = {
            ...media,
            assetPath: media.assetPath
              ? registerAsset(media.assetPath, `${overlay.id}-media`)
              : media.assetPath,
            posterPath: media.posterPath
              ? registerAsset(media.posterPath, `${overlay.id}-poster`)
              : media.posterPath,
          };
          return {
            ...overlay,
            assetPath: baseAssetPath,
            aiCardData: { ...aiCardData, content: newMedia },
          };
        }
        return { ...overlay, assetPath: baseAssetPath };
      }),
    },
    assets,
  };
}

export function resolveRemotionAssetSrc(source: string): string {
  if (!source) {
    return '';
  }

  if (isBundledStaticAssetPath(source)) {
    return staticFile(source);
  }

  if (isRemoteUrl(source)) {
    return source;
  }

  return toFileSrc(source);
}
