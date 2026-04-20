// src/lib/workspace-resources.ts
import type { FileEntry } from './electron-api';
import { isVideoImportPreviewFile, parseVideoImportPreviewDocument } from './video-import-preview';

export type ResourceGroup = 'original' | 'script' | 'douyin';

export interface ResourceItem {
  path: string;
  displayName: string;
  group: ResourceGroup;
  subtitle?: string;
  loading?: boolean;
}

export interface PreviewMeta {
  title: string;
  videoId: string;
}

export type PreviewMetaCache = Map<string, PreviewMeta | 'failed'>;

const ORIGINAL_FILE = 'original.md';
const SCRIPT_FILE = 'script.md';

function walkFiles(entries: FileEntry[], prefix = ''): { path: string; entry: FileEntry }[] {
  const out: { path: string; entry: FileEntry }[] = [];
  for (const entry of entries) {
    const path = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.type === 'directory') {
      if (entry.children?.length) out.push(...walkFiles(entry.children, path));
    } else {
      out.push({ path, entry });
    }
  }
  return out;
}

function extractVideoId(previewPath: string): string {
  const parts = previewPath.split('/');
  return parts[parts.length - 2] ?? previewPath;
}

export function collectScriptResources(
  fileEntries: FileEntry[],
  cache: PreviewMetaCache,
): ResourceItem[] {
  const files = walkFiles(fileEntries);
  const items: ResourceItem[] = [];

  for (const { path } of files) {
    if (path === ORIGINAL_FILE) {
      items.push({ path, displayName: '原始文稿', group: 'original', subtitle: ORIGINAL_FILE });
    } else if (path === SCRIPT_FILE) {
      items.push({ path, displayName: '口播脚本', group: 'script', subtitle: SCRIPT_FILE });
    } else if (isVideoImportPreviewFile(path)) {
      const videoId = extractVideoId(path);
      const cached = cache.get(path);
      if (cached === 'failed') {
        items.push({
          path,
          displayName: videoId,
          group: 'douyin',
          subtitle: '抖音 · 解析失败',
        });
      } else if (cached) {
        items.push({
          path,
          displayName: cached.title || videoId,
          group: 'douyin',
          subtitle: `抖音 · ${cached.videoId || videoId}`,
        });
      } else {
        items.push({
          path,
          displayName: videoId,
          group: 'douyin',
          subtitle: '抖音 · 解析中',
          loading: true,
        });
      }
    }
  }

  return items;
}

export function listUncachedPreviewPaths(
  items: ResourceItem[],
  cache: PreviewMetaCache,
): string[] {
  return items
    .filter((it) => it.group === 'douyin' && !cache.has(it.path))
    .map((it) => it.path);
}

export async function hydratePreviewMeta(
  projectDir: string,
  paths: string[],
  cache: PreviewMetaCache,
  loadScriptFile: (dir: string, rel: string) => Promise<string | null>,
): Promise<PreviewMetaCache> {
  for (const path of paths) {
    try {
      const content = await loadScriptFile(projectDir, path);
      if (!content) {
        cache.set(path, 'failed');
        continue;
      }
      const doc = parseVideoImportPreviewDocument(content);
      if (!doc) {
        cache.set(path, 'failed');
        continue;
      }
      cache.set(path, { title: doc.title, videoId: doc.videoId });
    } catch {
      cache.set(path, 'failed');
    }
  }
  return cache;
}

export function filterResources(items: ResourceItem[], query: string): ResourceItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return items;
  return items.filter(
    (it) =>
      it.displayName.toLowerCase().includes(q) ||
      (it.subtitle?.toLowerCase().includes(q) ?? false) ||
      it.path.toLowerCase().includes(q),
  );
}

export function groupResources(items: ResourceItem[]): Record<ResourceGroup, ResourceItem[]> {
  return {
    original: items.filter((it) => it.group === 'original'),
    script: items.filter((it) => it.group === 'script'),
    douyin: items.filter((it) => it.group === 'douyin'),
  };
}
