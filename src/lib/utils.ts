export function msToFrame(ms: number, fps: number): number {
  return Math.floor((ms / 1000) * fps);
}

export function frameToMs(frame: number, fps: number): number {
  return Math.round((frame / fps) * 1000);
}

export function formatTime(ms: number): string {
  const safeMs = Math.max(0, ms);
  const totalSeconds = Math.floor(safeMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export function getFileNameFromPath(filePath: string): string {
  const normalizedPath = filePath.replace(/\\/g, '/');
  return normalizedPath.split('/').pop() || filePath;
}

export function toFileSrc(filePath: string): string {
  if (!filePath) {
    return '';
  }

  if (
    filePath.startsWith('file://') ||
    filePath.startsWith('http://') ||
    filePath.startsWith('https://')
  ) {
    return filePath;
  }

  const normalizedPath = filePath.replace(/\\/g, '/');
  // encodeURI 不编码 # 和 ?，但它们在 URL 中有特殊含义，会导致 file:// 路径解析错误
  return `file://${encodeURI(normalizedPath).replace(/#/g, '%23').replace(/\?/g, '%3F')}`;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

const MIN_TIMELINE_DURATION_MS = 1_000;

interface TimelineDurationLike {
  podcast?: { durationMs?: number };
  overlays?: Array<{
    startMs: number;
    durationMs: number;
    overlayRole?: string;
  }>;
}

/**
 * 计算时间轴的有效总时长。
 *
 * 优先级：max(口播音频时长, 任意 overlay 的结束时间, 1s 兜底)。
 *
 * 没有口播素材时，仍要保证 Player / 时间轴尺子能容纳已经添加的动画卡片、
 * 媒体 overlay 等内容，否则会出现「5 秒动画只播放 1 秒就到结尾」的问题。
 */
export function getEffectiveTimelineDurationMs(timeline: TimelineDurationLike | null | undefined): number {
  if (!timeline) {
    return MIN_TIMELINE_DURATION_MS;
  }

  const podcastDuration = Number.isFinite(timeline.podcast?.durationMs)
    ? Math.max(0, Math.round(timeline.podcast?.durationMs ?? 0))
    : 0;

  let overlayMaxEnd = 0;
  if (Array.isArray(timeline.overlays)) {
    for (const overlay of timeline.overlays) {
      if (!overlay) {
        continue;
      }
      // 默认背景的 durationMs 本身就是从时间轴长度推导出来的，
      // 不能再反过来用它做时间轴长度计算，否则会变成自我引用。
      if (overlay.overlayRole === 'default-background') {
        continue;
      }
      const start = Number.isFinite(overlay.startMs) ? Math.max(0, overlay.startMs) : 0;
      const duration = Number.isFinite(overlay.durationMs) ? Math.max(0, overlay.durationMs) : 0;
      const end = start + duration;
      if (end > overlayMaxEnd) {
        overlayMaxEnd = end;
      }
    }
  }

  return Math.max(MIN_TIMELINE_DURATION_MS, podcastDuration, overlayMaxEnd);
}
