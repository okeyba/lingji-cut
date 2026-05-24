import type { SrtEntry } from '../types';
import {
  DEFAULT_CARD_DURATION_MS,
  getDefaultCardStyle,
  getDefaultTemplate,
  isAICardType,
  isDataContent,
  type AIAnalysisCardError,
  type AIAnalysisResult,
  type AICard,
  type AICardType,
  type AISegmentAnalysis,
  type AISegment,
  type AISegmentComplexityLevel,
  type AISegmentPacingNeed,
  type AISegmentSemanticType,
  type AISegmentVisualType,
  type AISettings,
  type CardStyle,
  type ImageAspectRatio,
  type MediaCardContent,
  type PromptBindingMap,
} from '../types/ai';
import type { MotionCardPayload } from '../types/motion';
import { generateStructuredData, generateText } from './llm';
import { resolvePromptBinding } from './llm/binding-resolver';
import type { PromptKind } from './prompts/types';
import {
  getBuiltinPromptTemplate,
  renderUserPromptWithLock,
  type PromptTemplate,
} from './prompts';
import {
  buildProjectStylePromptBlock,
  projectStylePromptValue,
} from './project-style-prompt';
import { compileMotionSource } from './motion-compiler';
import { MOTION_SANDBOX_REFERENCE } from './motion-runtime';

export interface AnalyzeSrtProgress {
  phase: 'planning' | 'cards' | 'done';
  percent: number;
  message?: string;
  cardIndex?: number;
  cardTotal?: number;
}

/**
 * 把段落 LLM 产出的 image cardPrompt 物化成实际图片资产。
 * 主进程通过 `electron/card-media-handlers.ts` 的 handleGenerateCardImage 提供；
 * Renderer / 测试 mock 也可以注入此函数。
 */
export interface GenerateCardImageInvocation {
  cardId: string;
  prompt: string;
  aspectRatio: ImageAspectRatio;
  segmentId: string;
}

export type GenerateCardImageFn = (
  args: GenerateCardImageInvocation,
) => Promise<MediaCardContent>;

interface AnalyzeSrtOptions {
  maxTokens?: number;
  generateStructuredData?: typeof generateStructuredData;
  generateText?: typeof generateText;
  generateCardImage?: GenerateCardImageFn;
  globalPrompt?: string;
  projectStylePrompt?: string;
  planningTemplate?: PromptTemplate;
  cardTemplate?: PromptTemplate;
  imageTemplate?: PromptTemplate;
  projectBindings?: PromptBindingMap | null;
  onProgress?: (progress: AnalyzeSrtProgress) => void;
}

interface RegenerateCardOptions {
  generateStructuredData?: typeof generateStructuredData;
  generateText?: typeof generateText;
  globalPrompt?: string;
  projectStylePrompt?: string;
  cardPrompt?: string;
  programSummary?: string;
  keywords?: string[];
  cardTemplate?: PromptTemplate;
  imageTemplate?: PromptTemplate;
  projectBindings?: PromptBindingMap | null;
}

interface RegenerateCoverPromptOptions {
  generateStructuredData?: typeof generateStructuredData;
  globalPrompt?: string;
  projectStylePrompt?: string;
  currentPrompt?: string;
  coverTemplate?: PromptTemplate;
  projectBindings?: PromptBindingMap | null;
}

/**
 * 解析指定 PromptKind 的 LLM 绑定。
 *
 * - `projectBindings === null`：无项目级 binding，走 settings.promptBindings / default 回退链
 * - `projectBindings === undefined`：**仅测试 mock 走此路径**。生产路径必须显式传入（null 或 map），
 *   否则会 silently bypass 绑定体系。所有 electron/main.ts IPC 处理器均已显式传入。
 */
function maybeResolveBinding(
  kind: PromptKind,
  settings: AISettings,
  projectBindings: PromptBindingMap | null | undefined,
): ReturnType<typeof resolvePromptBinding> | undefined {
  if (projectBindings === undefined) {
    return undefined;
  }
  return resolvePromptBinding(kind, settings, projectBindings);
}

interface SegmentPlanningResult {
  segments: AISegmentAnalysis[];
  coverPrompts: string[];
  summary: string;
  keywords: string[];
  globalPrompt?: string;
}

const TARGET_PLANNED_SEGMENT_DURATION_MS = 40_000;
const MAX_PLANNED_SEGMENT_DURATION_MS = 60_000;
const MIN_PLANNED_SPLIT_DURATION_MS = 18_000;
const MAX_SEGMENT_EXCERPT_CHARS = 220;

function msToTimestamp(ms: number): string {
  const totalSeconds = Math.floor(ms / 1_000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const millis = ms % 1_000;

  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(millis).padStart(3, '0')}`;
}

function normalizeStyle(type: AICard['type'], style: unknown): CardStyle {
  if (!style || typeof style !== 'object') {
    return getDefaultCardStyle(type);
  }

  const candidate = style as Partial<CardStyle>;
  const defaults = getDefaultCardStyle(type);
  return {
    primaryColor: candidate.primaryColor ?? defaults.primaryColor,
    backgroundColor: candidate.backgroundColor ?? defaults.backgroundColor,
    fontSize: Number.isFinite(candidate.fontSize) ? Number(candidate.fontSize) : defaults.fontSize,
  };
}

function stripSourceCodeFences(raw: string): string {
  const trimmed = raw.trim();
  const fenceMatch = /^```(?:[a-zA-Z]*)\n([\s\S]*?)\n```$/m.exec(trimmed);
  return fenceMatch ? fenceMatch[1].trim() : trimmed;
}

function normalizeMotionContentText(content: unknown, fallback: string): string {
  if (typeof content === 'string' && content.trim()) {
    return content.trim();
  }
  if (isDataContent(content) && content.items.length > 0) {
    return content.items
      .slice(0, 4)
      .map((item) => `${item.label}：${item.value}`)
      .join(' / ');
  }
  return fallback;
}

function escapeMotionString(value: string): string {
  return JSON.stringify(value);
}

function buildFallbackMotionSource(params: {
  title: string;
  content: string;
  primaryColor: string;
  backgroundColor: string;
  fontSize: number;
}): string {
  const { title, content, primaryColor, backgroundColor, fontSize } = params;

  return `const MotionComponent = ({ frame, fps, durationInFrames, width, height }) => {
  const safeDuration = Math.max(1, durationInFrames || 1);
  const progress = Math.min(1, Math.max(0, frame / safeDuration));
  const enter = interpolate(progress, [0, 0.18, 1], [0, 1, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const y = interpolate(progress, [0, 0.18, 1], [28, 0, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const title = ${escapeMotionString(title)};
  const content = ${escapeMotionString(content)};
  const accent = ${escapeMotionString(primaryColor)};
  const background = ${escapeMotionString(backgroundColor)};
  const baseFontSize = Math.max(28, Math.min(${Number.isFinite(fontSize) ? fontSize : 48}, height * 0.08));

  return (
    <AbsoluteFill
      style={{
        width,
        height,
        background,
        color: '#f7f9ff',
        fontFamily: 'Inter, PingFang SC, Microsoft YaHei, sans-serif',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'radial-gradient(circle at 18% 18%, rgba(255,255,255,0.16), transparent 34%), linear-gradient(135deg, rgba(255,255,255,0.07), rgba(255,255,255,0))',
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: width * 0.08,
          right: width * 0.08,
          top: height * 0.18,
          transform: 'translateY(' + y + 'px)',
          opacity: enter,
        }}
      >
        <div
          style={{
            width: Math.max(64, width * 0.1),
            height: 6,
            borderRadius: 999,
            background: accent,
            boxShadow: '0 0 24px ' + accent,
            marginBottom: height * 0.055,
          }}
        />
        <div
          style={{
            fontSize: baseFontSize,
            lineHeight: 1.12,
            fontWeight: 800,
            letterSpacing: 0,
            maxWidth: width * 0.78,
          }}
        >
          {title}
        </div>
        <div
          style={{
            marginTop: height * 0.045,
            maxWidth: width * 0.72,
            fontSize: Math.max(22, baseFontSize * 0.46),
            lineHeight: 1.55,
            color: 'rgba(247,249,255,0.78)',
            whiteSpace: 'pre-wrap',
          }}
        >
          {content}
        </div>
      </div>
      <div
        style={{
          position: 'absolute',
          left: width * 0.08,
          right: width * 0.08,
          bottom: height * 0.1,
          height: 1,
          background: 'linear-gradient(90deg, ' + accent + ', rgba(255,255,255,0.08))',
          opacity: 0.58,
        }}
      />
    </AbsoluteFill>
  );
};`;
}

/**
 * 把 LLM 返回的 motionCard 字段编译成可执行 Motion Card payload。
 * 编译失败直接抛错，由外层链路把"请重新生成"提示给用户。
 */
function buildMotionCardPayloadStrict(
  value: unknown,
  promptFallback: string,
): MotionCardPayload {
  if (!value || typeof value !== 'object') {
    throw new Error('LLM 未返回 motionCard；请重新生成');
  }

  const candidate = value as { sourceCode?: unknown };
  const sourceCodeRaw = typeof candidate.sourceCode === 'string' ? candidate.sourceCode : '';
  const sourceCode = stripSourceCodeFences(sourceCodeRaw);
  if (!sourceCode) {
    throw new Error('LLM 未返回 motionCard.sourceCode；请重新生成');
  }

  const compiled = compileMotionSource(sourceCode);
  if (!compiled.success) {
    throw new Error(`Motion Card 源码编译失败：${compiled.error}；请重新生成`);
  }

  return {
    sourceCode,
    compiledCode: compiled.compiledCode,
    compiledAt: Date.now(),
    prompt: promptFallback,
    retryCount: 0,
  };
}

function buildMotionCardPayloadWithFallback(
  value: unknown,
  promptFallback: string,
  fallback: {
    title: string;
    content: unknown;
    style: CardStyle;
  },
): MotionCardPayload {
  if (value && typeof value === 'object') {
    const candidate = value as { sourceCode?: unknown };
    if (typeof candidate.sourceCode === 'string' && candidate.sourceCode.trim()) {
      return buildMotionCardPayloadStrict(value, promptFallback);
    }
  }

  const sourceCode = buildFallbackMotionSource({
    title: fallback.title,
    content: normalizeMotionContentText(fallback.content, promptFallback || fallback.title),
    primaryColor: fallback.style.primaryColor,
    backgroundColor: fallback.style.backgroundColor,
    fontSize: fallback.style.fontSize,
  });
  const compiled = compileMotionSource(sourceCode);
  if (!compiled.success) {
    throw new Error(`兜底 Motion Card 编译失败：${compiled.error}；请重新生成`);
  }

  return {
    sourceCode,
    compiledCode: compiled.compiledCode,
    compiledAt: Date.now(),
    prompt: promptFallback,
    retryCount: 0,
  };
}

function normalizeSemanticType(value: unknown): AISegmentSemanticType {
  return value === 'data' ||
    value === 'explanation' ||
    value === 'chapter-transition' ||
    value === 'quote'
    ? value
    : 'narration';
}

function normalizeComplexityLevel(value: unknown): AISegmentComplexityLevel {
  return value === 'low' || value === 'high' ? value : 'medium';
}

function normalizePacingNeed(value: unknown): AISegmentPacingNeed {
  return value === 'steady' || value === 'transition' ? value : 'accent';
}

function normalizeVisualType(value: unknown): AISegmentVisualType | undefined {
  if (value === 'image' || value === 'motion') return value;
  return undefined;
}

const ALLOWED_IMAGE_ASPECT_RATIOS: ImageAspectRatio[] = ['16:9', '9:16', '1:1', '4:3', '3:4'];

function normalizeImageAspectRatio(
  value: unknown,
  displayMode: 'fullscreen' | 'pip',
): ImageAspectRatio {
  if (typeof value === 'string') {
    const found = ALLOWED_IMAGE_ASPECT_RATIOS.find((r) => r === value);
    if (found) return found;
  }
  return displayMode === 'pip' ? '1:1' : '16:9';
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
}

function normalizeSegment(rawSegment: unknown, index: number): AISegmentAnalysis | null {
  if (!rawSegment || typeof rawSegment !== 'object') {
    return null;
  }

  const candidate = rawSegment as Record<string, unknown>;
  const startMs = Number(candidate.startMs);
  const endMs = Number(candidate.endMs);
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) {
    return null;
  }

  return {
    id: typeof candidate.id === 'string' && candidate.id.trim() ? candidate.id.trim() : `segment-${index + 1}`,
    title:
      typeof candidate.title === 'string' && candidate.title.trim()
        ? candidate.title.trim()
        : `段落 ${index + 1}`,
    summary:
      typeof candidate.summary === 'string' && candidate.summary.trim()
        ? candidate.summary.trim()
        : `段落 ${index + 1}`,
    startMs,
    endMs,
    transcriptExcerpt:
      typeof candidate.transcriptExcerpt === 'string' && candidate.transcriptExcerpt.trim()
        ? candidate.transcriptExcerpt.trim()
        : undefined,
    semanticType: normalizeSemanticType(candidate.semanticType),
    complexityLevel: normalizeComplexityLevel(candidate.complexityLevel),
    visualizationScore: Number.isFinite(candidate.visualizationScore)
      ? Math.max(0, Math.min(100, Number(candidate.visualizationScore)))
      : 50,
    pacingNeed: normalizePacingNeed(candidate.pacingNeed),
    keywords: normalizeStringArray(candidate.keywords),
    entities: normalizeStringArray(candidate.entities),
    visualType: normalizeVisualType(candidate.visualType),
  };
}

function normalizeCard(
  rawCard: unknown,
  index: number,
  segmentId: string,
  promptFallback?: string,
  expectedVisualType?: AISegmentVisualType,
): AICard | null {
  if (!rawCard || typeof rawCard !== 'object') {
    return null;
  }

  const candidate = rawCard as Record<string, unknown>;
  let cardType: AICardType | null = isAICardType(candidate.type) ? candidate.type : null;
  // 强制对齐分流策略：上游 visualType 优先于 LLM 自报
  if (expectedVisualType === 'image') {
    cardType = 'image';
  } else if (expectedVisualType === 'motion' && cardType === 'image') {
    cardType = 'motion';
  }
  if (!cardType) return null;

  const startMs = Number(candidate.startMs);
  const endMs = Number(candidate.endMs);
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) {
    return null;
  }

  const cardPrompt =
    typeof candidate.cardPrompt === 'string' && candidate.cardPrompt.trim()
      ? candidate.cardPrompt.trim()
      : promptFallback?.trim() || undefined;
  const displayMode: 'fullscreen' | 'pip' = candidate.displayMode === 'pip' ? 'pip' : 'fullscreen';

  const style = normalizeStyle(cardType, candidate.style);
  const baseFields = {
    id:
      typeof candidate.id === 'string' && candidate.id.trim()
        ? candidate.id.trim()
        : `${segmentId}-card-${index + 1}`,
    segmentId:
      typeof candidate.segmentId === 'string' && candidate.segmentId.trim()
        ? candidate.segmentId.trim()
        : segmentId,
    title: typeof candidate.title === 'string' ? candidate.title : `卡片 ${index + 1}`,
    startMs,
    endMs,
    displayDurationMs:
      Number.isFinite(candidate.displayDurationMs) && Number(candidate.displayDurationMs) > 0
        ? Number(candidate.displayDurationMs)
        : DEFAULT_CARD_DURATION_MS,
    displayMode,
    template:
      typeof candidate.template === 'string' && candidate.template
        ? candidate.template
        : getDefaultTemplate(cardType),
    enabled: candidate.enabled !== false,
    style,
    cardPrompt,
  };

  if (cardType === 'image') {
    // 注意：cards.segment 流程不再要求 LLM 直接产出 cardPrompt（文生图提示词）。
    // 真正的中文 prompt 会在 generateCardForSegment 内部追加一次 card.image LLM 调用后回填，
    // 这里允许 cardPrompt 暂为 undefined，下游 materializeImageCard 在生成前会校验非空。
    const aspectRatio = normalizeImageAspectRatio(
      candidate.imageAspectRatio ?? candidate.aspectRatio,
      displayMode,
    );
    const placeholderContent: MediaCardContent = {
      mediaType: 'image',
      assetPath: null,
      aspectRatio,
      prompt: cardPrompt ?? '',
      providerId: null,
      model: null,
      generationStatus: 'pending',
    };
    return {
      ...baseFields,
      type: 'image',
      content: placeholderContent,
      renderMode: 'legacy',
    };
  }

  // motion 路径：优先使用 LLM 源码；若模型漏吐 motionCard，则用结构化文案生成兜底 Motion。
  const content =
    typeof candidate.content === 'string' || isDataContent(candidate.content)
      ? candidate.content
      : '';
  const motionCard = buildMotionCardPayloadWithFallback(candidate.motionCard, cardPrompt ?? '', {
    title: baseFields.title,
    content,
    style,
  });

  return {
    ...baseFields,
    type: cardType,
    content,
    renderMode: 'motion-card',
    motionCard,
  };
}

function normalizeCoverPrompts(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const prompt = value.find(
    (item): item is string => typeof item === 'string' && item.trim().length > 0,
  );
  return prompt ? [prompt.trim()] : [];
}

function parseCoverPromptResult(value: unknown): string[] {
  if (!value || typeof value !== 'object') {
    return [];
  }

  const candidate = value as Record<string, unknown>;
  if (typeof candidate.coverPrompt === 'string' && candidate.coverPrompt.trim()) {
    return [candidate.coverPrompt.trim()];
  }

  return normalizeCoverPrompts(candidate.coverPrompts);
}

export function parseSegmentPlanningResult(value: unknown): SegmentPlanningResult | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const candidate = value as Record<string, unknown>;
  const segments = Array.isArray(candidate.segments)
    ? candidate.segments
        .map(normalizeSegment)
        .filter((segment): segment is AISegmentAnalysis => segment !== null)
    : [];

  if (segments.length === 0) {
    return null;
  }

  return {
    segments,
    coverPrompts: normalizeCoverPrompts(candidate.coverPrompts),
    summary: typeof candidate.summary === 'string' ? candidate.summary : '',
    keywords: normalizeStringArray(candidate.keywords),
    globalPrompt: typeof candidate.globalPrompt === 'string' ? candidate.globalPrompt : undefined,
  };
}

function collectSegmentEntries(entries: SrtEntry[], startMs: number, endMs: number): SrtEntry[] {
  return entries
    .filter((entry) => entry.endMs > startMs && entry.startMs < endMs)
    .sort((a, b) => a.startMs - b.startMs);
}

function buildTranscriptExcerptForRange(
  entries: SrtEntry[],
  startMs: number,
  endMs: number,
  fallback?: string,
): string | undefined {
  const text = collectSegmentEntries(entries, startMs, endMs)
    .map((entry) => entry.text.trim())
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
  const source = text || fallback?.trim();
  if (!source) return undefined;
  return source.length > MAX_SEGMENT_EXCERPT_CHARS
    ? `${source.slice(0, MAX_SEGMENT_EXCERPT_CHARS - 3)}...`
    : source;
}

function findNearestBoundary(
  boundaries: number[],
  idealMs: number,
  lowerMs: number,
  upperMs: number,
): number | null {
  let best: number | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const boundary of boundaries) {
    if (boundary < lowerMs || boundary > upperMs) continue;
    const distance = Math.abs(boundary - idealMs);
    if (distance < bestDistance) {
      best = boundary;
      bestDistance = distance;
    }
  }
  return best;
}

function splitLongPlannedSegment(
  segment: AISegmentAnalysis,
  entries: SrtEntry[],
): AISegmentAnalysis[] {
  const startMs = Math.max(0, Math.round(segment.startMs));
  const endMs = Math.max(startMs, Math.round(segment.endMs));
  const durationMs = endMs - startMs;
  if (durationMs <= MAX_PLANNED_SEGMENT_DURATION_MS) {
    return [{ ...segment, startMs, endMs }];
  }

  const partCount = Math.max(
    2,
    Math.round(durationMs / TARGET_PLANNED_SEGMENT_DURATION_MS),
  );
  const subtitleBoundaries = Array.from(
    new Set(
      collectSegmentEntries(entries, startMs, endMs)
        .map((entry) => Math.round(entry.endMs))
        .filter((boundary) => boundary > startMs && boundary < endMs),
    ),
  ).sort((a, b) => a - b);

  const boundaries = [startMs];
  let previous = startMs;
  for (let i = 1; i < partCount; i += 1) {
    const remainingParts = partCount - i;
    const ideal = startMs + Math.round((durationMs * i) / partCount);
    const lower = Math.max(
      previous + MIN_PLANNED_SPLIT_DURATION_MS,
      endMs - remainingParts * MAX_PLANNED_SEGMENT_DURATION_MS,
    );
    const upper = Math.min(
      previous + MAX_PLANNED_SEGMENT_DURATION_MS,
      endMs - remainingParts * MIN_PLANNED_SPLIT_DURATION_MS,
    );
    const fallbackLower = Math.min(Math.max(previous + 1, lower), endMs - remainingParts);
    const fallbackUpper = Math.max(fallbackLower, Math.min(upper, endMs - remainingParts));
    const boundary =
      findNearestBoundary(subtitleBoundaries, ideal, lower, upper) ??
      Math.min(fallbackUpper, Math.max(fallbackLower, ideal));

    if (boundary <= previous || boundary >= endMs) break;
    boundaries.push(boundary);
    previous = boundary;
  }
  boundaries.push(endMs);

  const ranges = boundaries
    .slice(0, -1)
    .map((start, index) => ({ startMs: start, endMs: boundaries[index + 1] }))
    .filter((range): range is { startMs: number; endMs: number } =>
      Number.isFinite(range.endMs) && range.endMs > range.startMs,
    );

  if (ranges.length <= 1) {
    return [{ ...segment, startMs, endMs }];
  }

  return ranges.map((range, index) => ({
    ...segment,
    id: `${segment.id}-part-${index + 1}`,
    title: `${segment.title}（${index + 1}/${ranges.length}）`,
    summary: `${segment.summary}（第 ${index + 1}/${ranges.length} 小节）`,
    startMs: range.startMs,
    endMs: range.endMs,
    transcriptExcerpt: buildTranscriptExcerptForRange(
      entries,
      range.startMs,
      range.endMs,
      segment.transcriptExcerpt,
    ),
  }));
}

function enforceSegmentDurationBudget(
  planning: SegmentPlanningResult,
  entries: SrtEntry[],
): SegmentPlanningResult {
  const segments = planning.segments.flatMap((segment) =>
    splitLongPlannedSegment(segment, entries),
  );
  return { ...planning, segments };
}

export function buildSrtText(entries: SrtEntry[]): string {
  return entries
    .map((entry) => `[${msToTimestamp(entry.startMs)} --> ${msToTimestamp(entry.endMs)}] ${entry.text}`)
    .join('\n');
}

function truncatePromptValue(value: string, maxLength: number): string {
  const normalized = value.replace(/\s+/g, ' ').trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }
  return `${normalized.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

// 仅截取与 [startMs, endMs] 有重叠的字幕条目，再追加上下 paddingMs 缓冲
// 用于卡片生成时只把"本段及邻接"逐字稿喂给模型，避免每次都注入整篇全文
export function buildSrtTextRange(
  entries: SrtEntry[],
  startMs: number,
  endMs: number,
  paddingMs = 2000,
): string {
  const lo = Math.max(0, startMs - paddingMs);
  const hi = endMs + paddingMs;
  const sliced = entries.filter((entry) => entry.endMs >= lo && entry.startMs <= hi);
  return buildSrtText(sliced);
}

// 节目级浓缩上下文：只给定位用，不复述全文
function buildProgramContext(params: {
  programSummary?: string;
  keywords?: string[];
  segment: AISegment;
  segmentIndex?: number;
  totalSegments?: number;
  prevSegment?: AISegment;
  nextSegment?: AISegment;
}): string {
  const {
    programSummary,
    keywords = [],
    segment,
    segmentIndex,
    totalSegments,
    prevSegment,
    nextSegment,
  } = params;

  const lines: string[] = [];
  lines.push(`节目摘要：${truncatePromptValue(programSummary ?? '', 160) || '无'}`);
  lines.push(`节目关键词：${keywords.length > 0 ? keywords.join('、') : '无'}`);

  if (typeof segmentIndex === 'number' && typeof totalSegments === 'number' && totalSegments > 0) {
    lines.push(`当前段位置：第 ${segmentIndex + 1} 段，共 ${totalSegments} 段`);
  }
  if (prevSegment) {
    lines.push(`上一段标题：${prevSegment.title || '无'}`);
  }
  if (nextSegment) {
    lines.push(`下一段标题：${nextSegment.title || '无'}`);
  }
  return lines.join('\n');
}

export function buildSegmentPlanningPrompt(
  globalPrompt?: string,
  projectStylePrompt?: string,
  template?: PromptTemplate,
): string {
  const tpl = template ?? getBuiltinPromptTemplate('planning.segment');
  const trimmed = globalPrompt?.trim();
  const globalPromptLine = trimmed ? `额外创作要求：${trimmed}` : '';
  return renderUserPromptWithLock('planning.segment', tpl, {
    globalPromptLine,
    projectStylePrompt: projectStylePromptValue(projectStylePrompt),
    projectStylePromptBlock: buildProjectStylePromptBlock(projectStylePrompt),
  });
}

export function buildCoverPromptRegenerationPrompt(
  options: {
    globalPrompt?: string;
    projectStylePrompt?: string;
    currentPrompt?: string;
  } = {},
  template?: PromptTemplate,
): string {
  const tpl = template ?? getBuiltinPromptTemplate('cover.regeneration');
  const globalPrompt = options.globalPrompt?.trim();
  const projectStylePrompt = options.projectStylePrompt?.trim();
  const currentPrompt = options.currentPrompt?.trim();
  return renderUserPromptWithLock('cover.regeneration', tpl, {
    globalPrompt: globalPrompt || '无',
    projectStylePrompt: projectStylePrompt || '无',
    projectStylePromptBlock: buildProjectStylePromptBlock(projectStylePrompt),
    currentPrompt: currentPrompt || '无',
  });
}

export function buildSegmentCardPrompt(
  params: {
    programContext: string;
    segment: AISegment;
    globalPrompt?: string;
    projectStylePrompt?: string;
    cardPrompt?: string;
    currentCard?: AICard;
    programSummary?: string;
    keywords?: string[];
    visualType?: AISegmentVisualType;
  },
  template?: PromptTemplate,
): string {
  const {
    programContext,
    segment,
    globalPrompt,
    projectStylePrompt,
    cardPrompt,
    currentCard,
    programSummary,
    keywords = [],
    visualType,
  } = params;
  const tpl = template ?? getBuiltinPromptTemplate('cards.segment');

  const currentCardSection = currentCard
    ? [
        '当前卡片线索（仅延续风格，不照抄）：',
        `- id: ${currentCard.id}`,
        `- type: ${currentCard.type}`,
        `- title: ${truncatePromptValue(currentCard.title, 40)}`,
        `- content: ${truncatePromptValue(
          typeof currentCard.content === 'string'
            ? currentCard.content
            : JSON.stringify(currentCard.content),
          180,
        )}`,
        `- displayMode: ${currentCard.displayMode}`,
        `- style: ${currentCard.style.primaryColor}/${currentCard.style.backgroundColor}/${currentCard.style.fontSize}`,
      ].join('\n')
    : '当前卡片线索：无';

  return renderUserPromptWithLock('cards.segment', tpl, {
    globalPrompt: truncatePromptValue(globalPrompt ?? '', 240) || '无',
    projectStylePrompt: truncatePromptValue(projectStylePromptValue(projectStylePrompt), 240) || '无',
    projectStylePromptBlock: buildProjectStylePromptBlock(projectStylePrompt),
    programSummary: truncatePromptValue(programSummary ?? '', 180) || '无',
    keywords: keywords.length > 0 ? keywords.join('、') : '无',
    segmentId: segment.id,
    segmentTitle: truncatePromptValue(segment.title, 60),
    segmentSummary: truncatePromptValue(segment.summary, 180),
    segmentStartMs: segment.startMs,
    segmentEndMs: segment.endMs,
    segmentTranscriptExcerpt: truncatePromptValue(segment.transcriptExcerpt ?? '', 260) || '无',
    cardPrompt: truncatePromptValue(cardPrompt ?? '', 240) || '无',
    currentCardSection,
    programContext,
    segmentVisualType: visualType ?? 'motion',
    // 旧版自定义模板可能仍在使用 {{fullTranscript}}；这里给它注入与 programContext
    // 同值的浓缩上下文，避免破坏存量模板，同时不再发送整篇全文。
    fullTranscript: programContext,
    sandboxReference: MOTION_SANDBOX_REFERENCE,
  });
}

/**
 * 渲染 card.image 模板：把段落级 / 节目级 / 当前 image 卡片结构信息注入模板变量。
 * 模板末尾会自动拼接 lockedContract（"只输出一段中文 prompt"）。
 */
export function buildSegmentImagePrompt(
  params: {
    segment: AISegment;
    card: AICard;
    aspectRatio: ImageAspectRatio;
    globalPrompt?: string;
    projectStylePrompt?: string;
    programSummary?: string;
    keywords?: string[];
    cardPromptHint?: string;
  },
  template?: PromptTemplate,
): string {
  const {
    segment,
    card,
    aspectRatio,
    globalPrompt,
    projectStylePrompt,
    programSummary,
    keywords = [],
    cardPromptHint,
  } = params;
  const tpl = template ?? getBuiltinPromptTemplate('card.image');
  const cardContent =
    typeof card.content === 'string' && card.content.trim()
      ? card.content
      : segment.summary;
  return renderUserPromptWithLock('card.image', tpl, {
    globalPrompt: globalPrompt?.trim() || '无',
    projectStylePrompt: projectStylePromptValue(projectStylePrompt),
    projectStylePromptBlock: buildProjectStylePromptBlock(projectStylePrompt),
    programSummary: programSummary?.trim() || '无',
    keywords: keywords.length > 0 ? keywords.join('、') : '无',
    segmentId: segment.id,
    segmentTitle: segment.title,
    segmentSummary: segment.summary,
    segmentExcerpt: segment.transcriptExcerpt || '无',
    cardTitle: card.title || segment.title,
    cardContent,
    displayMode: card.displayMode,
    aspectRatio,
    cardPromptHint: cardPromptHint?.trim() || '无',
  });
}

/**
 * 用 card.image 模板单独请求 LLM，产出**简体中文**文生图 prompt。
 * card.image 的 binding 会同时绑定 LLM + ImageProvider；本函数只用其 LLM 部分。
 */
async function generateImagePromptForSegment(params: {
  segment: AISegment;
  card: AICard;
  settings: AISettings;
  generateText: typeof generateText;
  globalPrompt?: string;
  projectStylePrompt?: string;
  programSummary?: string;
  keywords?: string[];
  cardPromptHint?: string;
  imageTemplate?: PromptTemplate;
  projectBindings?: PromptBindingMap | null | undefined;
}): Promise<string> {
  const {
    segment,
    card,
    settings,
    generateText: requestText,
    globalPrompt,
    projectStylePrompt,
    programSummary,
    keywords,
    cardPromptHint,
    imageTemplate,
    projectBindings,
  } = params;
  if (card.type !== 'image' || !card.content || typeof card.content !== 'object' || !('mediaType' in card.content)) {
    throw new Error('generateImagePromptForSegment: 仅适用于 image 占位卡片');
  }
  const aspectRatio = (card.content as MediaCardContent).aspectRatio;
  const userMessage = buildSegmentImagePrompt(
    {
      segment,
      card,
      aspectRatio,
      globalPrompt,
      projectStylePrompt,
      programSummary,
      keywords,
      cardPromptHint,
    },
    imageTemplate,
  );
  const binding = maybeResolveBinding('card.image', settings, projectBindings);
  // card.image 的 system prompt 完全由模板 user 段承载，传空 system 即可。
  const text = await requestText(settings, '', userMessage, binding);
  const trimmed = text.trim();
  if (!trimmed) {
    throw new Error('card.image LLM 返回空内容；请重新生成');
  }
  return trimmed;
}

export async function planTranscriptSegments(
  entries: SrtEntry[],
  settings: AISettings,
  options: AnalyzeSrtOptions = {},
): Promise<SegmentPlanningResult> {
  const {
    generateStructuredData: requestStructuredData = generateStructuredData,
    globalPrompt,
    projectStylePrompt,
    planningTemplate,
    projectBindings,
  } = options;

  if (entries.length === 0) {
    throw new Error('没有可分析的字幕内容');
  }

  const binding = maybeResolveBinding('planning.segment', settings, projectBindings);
  const payload = await requestStructuredData(
    settings,
    buildSegmentPlanningPrompt(globalPrompt, projectStylePrompt, planningTemplate),
    buildSrtText(entries),
    binding,
    { label: 'planning.segment' },
  );
  const parsed = parseSegmentPlanningResult(payload);
  if (!parsed) {
    throw new Error('LLM 未返回有效的段落规划结果');
  }
  const planned = enforceSegmentDurationBudget(parsed, entries);

  // 观测分流健康度：统计 planning 阶段每段的 visualType（缺失视为 motion 默认）
  const total = planned.segments.length;
  let motionCount = 0;
  let imageCount = 0;
  let unspecifiedCount = 0;
  for (const seg of planned.segments) {
    if (seg.visualType === 'image') imageCount += 1;
    else if (seg.visualType === 'motion') motionCount += 1;
    else unspecifiedCount += 1;
  }
  console.log(
    `[planning.segment] segments=${total} motion=${motionCount} image=${imageCount} unspecified=${unspecifiedCount} (unspecified 默认按 motion 走)`,
  );

  return {
    ...planned,
    globalPrompt: globalPrompt?.trim() || planned.globalPrompt,
  };
}

export async function generateCardForSegment(
  entries: SrtEntry[],
  planning: Pick<SegmentPlanningResult, 'summary' | 'keywords' | 'globalPrompt'>,
  segment: AISegment,
  settings: AISettings,
  options: {
    generateStructuredData?: typeof generateStructuredData;
    generateText?: typeof generateText;
    globalPrompt?: string;
    projectStylePrompt?: string;
    cardPrompt?: string;
    currentCard?: AICard;
    cardTemplate?: PromptTemplate;
    imageTemplate?: PromptTemplate;
    projectBindings?: PromptBindingMap | null;
    segmentIndex?: number;
    totalSegments?: number;
    prevSegment?: AISegment;
    nextSegment?: AISegment;
    visualType?: AISegmentVisualType;
  } = {},
): Promise<AICard> {
  const {
    generateStructuredData: requestStructuredData = generateStructuredData,
    generateText: requestText = generateText,
    globalPrompt,
    projectStylePrompt,
    cardPrompt,
    currentCard,
    cardTemplate,
    imageTemplate,
    projectBindings,
    segmentIndex,
    totalSegments,
    prevSegment,
    nextSegment,
    visualType,
  } = options;

  if (entries.length === 0) {
    throw new Error('没有可用于生成卡片的字幕内容');
  }

  // 只发段内逐字稿（含 ±2s 缓冲），而不是整篇 SRT，显著降低单次请求体积
  const segmentTranscript = buildSrtTextRange(entries, segment.startMs, segment.endMs);
  const programContext = buildProgramContext({
    programSummary: planning.summary,
    keywords: planning.keywords,
    segment,
    segmentIndex,
    totalSegments,
    prevSegment,
    nextSegment,
  });

  const binding = maybeResolveBinding('cards.segment', settings, projectBindings);
  const positionLabel =
    typeof segmentIndex === 'number' && typeof totalSegments === 'number'
      ? `cards.segment#${segmentIndex + 1}/${totalSegments}（${segment.id}）`
      : `cards.segment（${segment.id}）`;
  const payload = await requestStructuredData(
    settings,
    buildSegmentCardPrompt(
      {
        programContext,
        segment,
        globalPrompt: globalPrompt?.trim() || planning.globalPrompt,
        projectStylePrompt,
        cardPrompt,
        currentCard,
        programSummary: planning.summary,
        keywords: planning.keywords,
        visualType,
      },
      cardTemplate,
    ),
    segmentTranscript,
    binding,
    { label: positionLabel },
  );
  const parsed = normalizeCard(payload, 0, segment.id, cardPrompt, visualType);
  if (!parsed) {
    throw new Error('LLM 未返回有效的卡片结果');
  }

  let finalCard: AICard = {
    ...parsed,
    segmentId: segment.id,
    cardPrompt: cardPrompt?.trim() || parsed.cardPrompt,
  };

  // image 卡片：cards.segment 不再直接产 prompt，这里追加一次 card.image LLM 调用，
  // 用配置中心的 card.image 模板生成中文文生图提示词，并回填到 cardPrompt / content.prompt。
  if (finalCard.type === 'image') {
    const generatedPrompt = await generateImagePromptForSegment({
      segment,
      card: finalCard,
      settings,
      generateText: requestText,
      globalPrompt: globalPrompt?.trim() || planning.globalPrompt,
      projectStylePrompt,
      programSummary: planning.summary,
      keywords: planning.keywords,
      cardPromptHint: cardPrompt,
      imageTemplate,
      projectBindings,
    });
    const prevContent = finalCard.content as MediaCardContent;
    finalCard = {
      ...finalCard,
      cardPrompt: generatedPrompt,
      content: {
        ...prevContent,
        prompt: generatedPrompt,
      },
    };
  }

  return finalCard;
}

/**
 * 把一张已 normalize 出来的 image 占位卡片真正物化成图片资产。
 * 失败时直接抛错，由外层并发循环把段记入 cardErrors。
 */
export async function materializeImageCard(
  card: AICard,
  generateCardImage: GenerateCardImageFn,
): Promise<AICard> {
  if (card.type !== 'image') return card;
  const content = card.content;
  if (!content || typeof content !== 'object' || !('mediaType' in content)) {
    throw new Error('image 卡片缺少 MediaCardContent 占位结构');
  }
  const media = content as MediaCardContent;
  const prompt = media.prompt || card.cardPrompt;
  if (!prompt) {
    throw new Error('image 卡片缺少图像 prompt，无法生成');
  }
  const generated = await generateCardImage({
    cardId: card.id,
    prompt,
    aspectRatio: media.aspectRatio,
    segmentId: card.segmentId,
  });
  return {
    ...card,
    content: generated,
  };
}

export async function analyzeSrt(
  entries: SrtEntry[],
  settings: AISettings,
  options: AnalyzeSrtOptions = {},
): Promise<AIAnalysisResult> {
  const {
    generateStructuredData: requestStructuredData = generateStructuredData,
    generateText: requestText = generateText,
    generateCardImage,
    globalPrompt,
    projectStylePrompt,
    planningTemplate,
    cardTemplate,
    imageTemplate,
    projectBindings,
    onProgress,
  } = options;

  onProgress?.({ phase: 'planning', percent: 0, message: '规划分段与封面提示词…' });

  const planning = await planTranscriptSegments(entries, settings, {
    generateStructuredData: requestStructuredData,
    globalPrompt,
    projectStylePrompt,
    planningTemplate,
    projectBindings,
  });

  const total = planning.segments.length;
  onProgress?.({
    phase: 'cards',
    percent: total > 0 ? 30 : 95,
    message: total > 0 ? `生成内容卡片 0/${total}` : '规划完成',
    cardIndex: 0,
    cardTotal: total,
  });

  // 并发池：同时跑 CARD_CONCURRENCY 个段的卡片生成；进度按"完成顺序"累加
  // 单段失败不阻塞其它段——失败段记入 cardErrors，UI 可引导用户对该段单独重生成
  const CARD_CONCURRENCY = 4;
  const cardSlots: (AICard | null)[] = new Array(planning.segments.length).fill(null);
  const cardErrors: AIAnalysisCardError[] = [];
  let done = 0;
  let failed = 0;
  let cursor = 0;

  const runOne = async (): Promise<void> => {
    while (true) {
      const i = cursor;
      cursor += 1;
      if (i >= planning.segments.length) return;
      const segment = planning.segments[i];
      const visualType: AISegmentVisualType = segment.visualType ?? 'motion';
      try {
        let card = await generateCardForSegment(entries, planning, segment, settings, {
          generateStructuredData: requestStructuredData,
          generateText: requestText,
          globalPrompt: planning.globalPrompt,
          projectStylePrompt,
          cardTemplate,
          imageTemplate,
          projectBindings,
          segmentIndex: i,
          totalSegments: total,
          prevSegment: i > 0 ? planning.segments[i - 1] : undefined,
          nextSegment: i + 1 < planning.segments.length ? planning.segments[i + 1] : undefined,
          visualType,
        });
        // image 卡片：LLM 拿到 prompt 后立即调图像 provider 物化资产
        if (card.type === 'image') {
          if (!generateCardImage) {
            throw new Error('image 卡片需要 generateCardImage 注入（主进程未提供）');
          }
          card = await materializeImageCard(card, generateCardImage);
        }
        cardSlots[i] = card;
        done += 1;
      } catch (error) {
        failed += 1;
        cardErrors.push({
          segmentId: segment.id,
          segmentTitle: segment.title,
          segmentIndex: i,
          totalSegments: total,
          message: error instanceof Error ? error.message : String(error),
        });
      }
      const completed = done + failed;
      const percent = Math.min(95, Math.round(30 + (completed / Math.max(1, total)) * 65));
      const message =
        failed > 0
          ? `生成内容卡片 ${completed}/${total}（成功 ${done}，失败 ${failed}）`
          : `生成内容卡片 ${completed}/${total}`;
      onProgress?.({
        phase: 'cards',
        percent,
        message,
        cardIndex: completed,
        cardTotal: total,
      });
    }
  };

  const workerCount = Math.min(CARD_CONCURRENCY, Math.max(1, planning.segments.length));
  await Promise.all(Array.from({ length: workerCount }, () => runOne()));
  const cards: AICard[] = cardSlots.filter((card): card is AICard => card !== null);

  onProgress?.({
    phase: 'done',
    percent: 100,
    message:
      failed > 0 ? `内容分析完成（成功 ${done}，失败 ${failed}）` : '内容分析完成',
  });

  return {
    segments: planning.segments,
    cards,
    coverPrompts: planning.coverPrompts,
    summary: planning.summary,
    keywords: planning.keywords,
    globalPrompt: planning.globalPrompt,
    cardErrors: cardErrors.length > 0 ? cardErrors : undefined,
  };
}

export async function regenerateAICard(
  entries: SrtEntry[],
  card: AICard,
  segment: AISegment,
  settings: AISettings,
  options: RegenerateCardOptions = {},
): Promise<AICard> {
  const {
    generateStructuredData: requestStructuredData = generateStructuredData,
    generateText: requestText = generateText,
    globalPrompt,
    projectStylePrompt,
    cardPrompt = card.cardPrompt,
    programSummary,
    keywords = [],
    cardTemplate,
    imageTemplate,
    projectBindings,
  } = options;

  if (!segment) {
    throw new Error('缺少卡片对应的段落信息');
  }

  const regenerated = await generateCardForSegment(
    entries,
    {
      summary: programSummary ?? '',
      keywords,
      globalPrompt: globalPrompt?.trim() || undefined,
    },
    segment,
    settings,
    {
      generateStructuredData: requestStructuredData,
      generateText: requestText,
      globalPrompt,
      projectStylePrompt,
      cardPrompt,
      currentCard: card,
      cardTemplate,
      imageTemplate,
      projectBindings,
    },
  );

  return {
    ...card,
    ...regenerated,
    id: card.id,
    segmentId: segment.id,
    enabled: card.enabled,
    cardPrompt: cardPrompt?.trim() || undefined,
  };
}

export interface SubtitleCardDraftInput {
  /** 用户二次编辑后的字幕文本（默认来自选中条目拼接） */
  text: string;
  /** 卡片起始毫秒（默认来自首条 startMs） */
  startMs: number;
  /** 卡片结束毫秒（默认来自末条 endMs） */
  endMs: number;
  /** 卡片停留毫秒（默认 = endMs - startMs） */
  displayDurationMs: number;
  /** 卡片类型倾向（user hint，LLM 可自行微调） */
  type: AICardType;
  /** 用户补充指令，可选 */
  promptHint?: string;
}

/**
 * 面向"用户手选字幕 → 单张 Motion Card"的生成入口。
 *
 * 策略：复用 `cards.segment` 管线，把用户草稿组装成合成段落后喂入；
 * normalizeCard 会对返回的 motionCard.sourceCode 做 Babel 编译校验，
 * 编译失败直接抛错让用户重新生成。
 */
export async function generateSingleCardFromSubtitles(
  entries: SrtEntry[],
  draft: SubtitleCardDraftInput,
  settings: AISettings,
  options: {
    globalPrompt?: string;
    projectStylePrompt?: string;
    programSummary?: string;
    keywords?: string[];
    cardTemplate?: PromptTemplate;
    imageTemplate?: PromptTemplate;
    projectBindings?: PromptBindingMap | null;
    generateStructuredData?: typeof generateStructuredData;
    generateText?: typeof generateText;
  } = {},
): Promise<AICard> {
  const trimmedText = draft.text.trim();
  if (trimmedText.length === 0) {
    throw new Error('字幕内容为空，无法生成卡片');
  }
  if (!(draft.startMs < draft.endMs)) {
    throw new Error('时间范围无效');
  }
  if (!Number.isFinite(draft.displayDurationMs) || draft.displayDurationMs <= 0) {
    throw new Error('展示时长无效');
  }
  if (!isAICardType(draft.type)) {
    throw new Error('卡片类型无效');
  }

  const {
    globalPrompt,
    projectStylePrompt,
    programSummary,
    keywords = [],
    cardTemplate,
    imageTemplate,
    projectBindings,
    generateStructuredData: requestStructuredData,
    generateText: requestText,
  } = options;

  const hint = draft.promptHint?.trim();
  const cardPromptLines = [
    `只产出 1 张卡片，renderMode 必须为 "motion-card"，并在 motionCard.sourceCode 里给出可编译的 Remotion JSX 组件。`,
    `卡片类型建议为 "${draft.type}"，可根据内容微调。`,
  ];
  if (hint) {
    cardPromptLines.push(`用户补充：${hint}`);
  }
  const cardPrompt = cardPromptLines.join('\n');

  const syntheticSegment: AISegment = {
    id: `manual-${Date.now()}`,
    title: `手动选段 ${msToTimestamp(draft.startMs)} → ${msToTimestamp(draft.endMs)}`,
    summary: hint || trimmedText.slice(0, 120),
    startMs: draft.startMs,
    endMs: draft.endMs,
    transcriptExcerpt: trimmedText,
  };

  const card = await generateCardForSegment(
    entries.length > 0 ? entries : [],
    {
      summary: programSummary ?? '',
      keywords,
      globalPrompt: globalPrompt?.trim() || undefined,
    },
    syntheticSegment,
    settings,
    {
      generateStructuredData: requestStructuredData,
      generateText: requestText,
      globalPrompt,
      projectStylePrompt,
      cardPrompt,
      cardTemplate,
      imageTemplate,
      projectBindings,
    },
  );

  return {
    ...card,
    segmentId: syntheticSegment.id,
    startMs: draft.startMs,
    endMs: draft.endMs,
    displayDurationMs: draft.displayDurationMs,
    cardPrompt: hint || card.cardPrompt,
  };
}

export async function regenerateCoverPrompt(
  entries: SrtEntry[],
  settings: AISettings,
  options: RegenerateCoverPromptOptions = {},
): Promise<string[]> {
  const {
    generateStructuredData: requestStructuredData = generateStructuredData,
    globalPrompt,
    projectStylePrompt,
    currentPrompt,
    coverTemplate,
    projectBindings,
  } = options;

  if (entries.length === 0) {
    throw new Error('没有可用于生成封面提示词的字幕内容');
  }

  const binding = maybeResolveBinding('cover.regeneration', settings, projectBindings);
  const payload = await requestStructuredData(
    settings,
    buildCoverPromptRegenerationPrompt(
      {
        globalPrompt,
        projectStylePrompt,
        currentPrompt,
      },
      coverTemplate,
    ),
    buildSrtText(entries),
    binding,
  );
  const prompts = parseCoverPromptResult(payload);

  if (prompts.length === 0) {
    throw new Error('LLM 未返回有效的封面提示词');
  }

  return prompts;
}
