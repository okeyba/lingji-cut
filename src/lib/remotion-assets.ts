import { staticFile } from 'remotion';
import type { TimelineData } from '../types';
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

export function prepareTimelineForRemotionRender(timeline: TimelineData): {
  timeline: TimelineData;
  assets: RenderAssetDescriptor[];
} {
  const sourceToPublicPath = new Map<string, string>();
  const assets: RenderAssetDescriptor[] = [];

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
      overlays: timeline.overlays.map((overlay) => ({
        ...overlay,
        assetPath: registerAsset(overlay.assetPath, overlay.id),
        aiCardData: overlay.aiCardData
          ? {
              ...overlay.aiCardData,
              webCard: overlay.aiCardData.webCard?.src
                ? {
                    ...overlay.aiCardData.webCard,
                    src: registerAsset(
                      overlay.aiCardData.webCard.src,
                      `${overlay.aiCardData.sourceCardId ?? overlay.id}-web-card`,
                    ),
                  }
                : overlay.aiCardData.webCard,
            }
          : overlay.aiCardData,
      })),
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
