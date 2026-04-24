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
  type AISettings,
  type CardStyle,
  type PromptBindingMap,
  type WebCardPayload,
} from '../types/ai';
import type { MotionCardPayload } from '../types/motion';
import { generateStructuredData } from './llm';
import { resolvePromptBinding } from './llm/binding-resolver';
import type { PromptKind } from './prompts/types';
import {
  getBuiltinPromptTemplate,
  renderUserPromptWithLock,
  type PromptTemplate,
} from './prompts';

export interface AnalyzeSrtProgress {
  phase: 'planning' | 'cards' | 'done';
  percent: number;
  message?: string;
  cardIndex?: number;
  cardTotal?: number;
}

interface AnalyzeSrtOptions {
  maxTokens?: number;
  generateStructuredData?: typeof generateStructuredData;
  globalPrompt?: string;
  planningTemplate?: PromptTemplate;
  cardTemplate?: PromptTemplate;
  projectBindings?: PromptBindingMap | null;
  onProgress?: (progress: AnalyzeSrtProgress) => void;
}

interface RegenerateCardOptions {
  generateStructuredData?: typeof generateStructuredData;
  globalPrompt?: string;
  cardPrompt?: string;
  programSummary?: string;
  keywords?: string[];
  cardTemplate?: PromptTemplate;
  projectBindings?: PromptBindingMap | null;
}

interface RegenerateCoverPromptOptions {
  generateStructuredData?: typeof generateStructuredData;
  globalPrompt?: string;
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

function isWebCardPayload(value: unknown): value is WebCardPayload {
  return Boolean(
    value &&
      typeof value === 'object' &&
      (('src' in value && typeof (value as { src?: unknown }).src === 'string') ||
        ('srcDoc' in value && typeof (value as { srcDoc?: unknown }).srcDoc === 'string')),
  );
}

function normalizeWebCardPayload(value: unknown): WebCardPayload | undefined {
  if (!isWebCardPayload(value)) {
    return undefined;
  }

  return {
    src: typeof value.src === 'string' ? value.src : undefined,
    srcDoc: typeof value.srcDoc === 'string' ? value.srcDoc : undefined,
    runtimeStatus:
      value.runtimeStatus === 'loading' ||
      value.runtimeStatus === 'ready' ||
      value.runtimeStatus === 'error'
        ? value.runtimeStatus
        : 'idle',
    lastGeneratedAt: Number.isFinite(value.lastGeneratedAt) ? Number(value.lastGeneratedAt) : Date.now(),
    sourceKind:
      value.sourceKind === 'imported-file' || value.sourceKind === 'generated'
        ? value.sourceKind
        : undefined,
    sourceLabel: typeof value.sourceLabel === 'string' ? value.sourceLabel : undefined,
  };
}

function isMotionCardPayload(value: unknown): value is MotionCardPayload {
  return Boolean(
    value &&
      typeof value === 'object' &&
      typeof (value as MotionCardPayload).sourceCode === 'string' &&
      typeof (value as MotionCardPayload).compiledCode === 'string',
  );
}

function normalizeMotionCardPayload(value: unknown, promptFallback: string): MotionCardPayload | undefined {
  if (!isMotionCardPayload(value)) {
    return undefined;
  }

  return {
    sourceCode: value.sourceCode,
    compiledCode: value.compiledCode,
    compiledAt: Number.isFinite(value.compiledAt) ? Number(value.compiledAt) : Date.now(),
    compileError: typeof value.compileError === 'string' ? value.compileError : undefined,
    prompt: typeof value.prompt === 'string' && value.prompt.trim() ? value.prompt.trim() : promptFallback,
    retryCount:
      Number.isFinite(value.retryCount) && Number(value.retryCount) >= 0 ? Number(value.retryCount) : 0,
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
  };
}

function normalizeCard(
  rawCard: unknown,
  index: number,
  segmentId: string,
  promptFallback?: string,
): AICard | null {
  if (!rawCard || typeof rawCard !== 'object') {
    return null;
  }

  const candidate = rawCard as Record<string, unknown>;
  if (!isAICardType(candidate.type)) {
    return null;
  }

  const startMs = Number(candidate.startMs);
  const endMs = Number(candidate.endMs);
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) {
    return null;
  }

  const content =
    typeof candidate.content === 'string' || isDataContent(candidate.content)
      ? candidate.content
      : '';
  const webCard = normalizeWebCardPayload(candidate.webCard);
  const cardPrompt =
    typeof candidate.cardPrompt === 'string' && candidate.cardPrompt.trim()
      ? candidate.cardPrompt.trim()
      : promptFallback?.trim() || undefined;
  const motionCard = normalizeMotionCardPayload(candidate.motionCard, cardPrompt ?? '');
  const renderMode =
    candidate.renderMode === 'motion-card' || motionCard
      ? 'motion-card'
      : candidate.renderMode === 'web-card' || webCard
        ? 'web-card'
        : 'legacy';

  return {
    id:
      typeof candidate.id === 'string' && candidate.id.trim()
        ? candidate.id.trim()
        : `${segmentId}-card-${index + 1}`,
    segmentId:
      typeof candidate.segmentId === 'string' && candidate.segmentId.trim()
        ? candidate.segmentId.trim()
        : segmentId,
    type: candidate.type,
    title: typeof candidate.title === 'string' ? candidate.title : `卡片 ${index + 1}`,
    content,
    startMs,
    endMs,
    displayDurationMs:
      Number.isFinite(candidate.displayDurationMs) && Number(candidate.displayDurationMs) > 0
        ? Number(candidate.displayDurationMs)
        : DEFAULT_CARD_DURATION_MS,
    displayMode: candidate.displayMode === 'pip' ? 'pip' : 'fullscreen',
    template:
      typeof candidate.template === 'string' && candidate.template
        ? candidate.template
        : getDefaultTemplate(candidate.type),
    enabled: candidate.enabled !== false,
    style: normalizeStyle(candidate.type, candidate.style),
    renderMode,
    cardPrompt,
    webCard,
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

export function buildSrtText(entries: SrtEntry[]): string {
  return entries
    .map((entry) => `[${msToTimestamp(entry.startMs)} --> ${msToTimestamp(entry.endMs)}] ${entry.text}`)
    .join('\n');
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
  lines.push(`节目摘要：${programSummary?.trim() || '无'}`);
  lines.push(`节目关键词：${keywords.length > 0 ? keywords.join('、') : '无'}`);

  if (typeof segmentIndex === 'number' && typeof totalSegments === 'number' && totalSegments > 0) {
    lines.push(`当前段位置：第 ${segmentIndex + 1} 段，共 ${totalSegments} 段`);
  }
  lines.push(`当前段标题：${segment.title || '无'}`);
  if (segment.summary) {
    lines.push(`当前段摘要：${segment.summary}`);
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
  template?: PromptTemplate,
): string {
  const tpl = template ?? getBuiltinPromptTemplate('planning.segment');
  const trimmed = globalPrompt?.trim();
  const globalPromptLine = trimmed ? `额外创作要求：${trimmed}` : '';
  return renderUserPromptWithLock('planning.segment', tpl, { globalPromptLine });
}

export function buildCoverPromptRegenerationPrompt(
  options: {
    globalPrompt?: string;
    currentPrompt?: string;
  } = {},
  template?: PromptTemplate,
): string {
  const tpl = template ?? getBuiltinPromptTemplate('cover.regeneration');
  const globalPrompt = options.globalPrompt?.trim();
  const currentPrompt = options.currentPrompt?.trim();
  return renderUserPromptWithLock('cover.regeneration', tpl, {
    globalPrompt: globalPrompt || '无',
    currentPrompt: currentPrompt || '无',
  });
}

export function buildSegmentCardPrompt(
  params: {
    programContext: string;
    segment: AISegment;
    globalPrompt?: string;
    cardPrompt?: string;
    currentCard?: AICard;
    programSummary?: string;
    keywords?: string[];
  },
  template?: PromptTemplate,
): string {
  const {
    programContext,
    segment,
    globalPrompt,
    cardPrompt,
    currentCard,
    programSummary,
    keywords = [],
  } = params;
  const tpl = template ?? getBuiltinPromptTemplate('cards.segment');

  const currentCardSection = currentCard
    ? [
        '当前卡片线索（仅用于延续已有风格和信息结构，不要机械照抄）：',
        `- id: ${currentCard.id}`,
        `- type: ${currentCard.type}`,
        `- title: ${currentCard.title}`,
        `- content: ${
          typeof currentCard.content === 'string'
            ? currentCard.content
            : JSON.stringify(currentCard.content, null, 2)
        }`,
        `- displayMode: ${currentCard.displayMode}`,
        `- template: ${currentCard.template}`,
        `- style.primaryColor: ${currentCard.style.primaryColor}`,
        `- style.backgroundColor: ${currentCard.style.backgroundColor}`,
        `- style.fontSize: ${currentCard.style.fontSize}`,
      ].join('\n')
    : '当前卡片线索：无';

  return renderUserPromptWithLock('cards.segment', tpl, {
    globalPrompt: globalPrompt?.trim() || '无',
    programSummary: programSummary?.trim() || '无',
    keywords: keywords.length > 0 ? keywords.join('、') : '无',
    segmentId: segment.id,
    segmentTitle: segment.title,
    segmentSummary: segment.summary,
    segmentStartMs: segment.startMs,
    segmentEndMs: segment.endMs,
    segmentTranscriptExcerpt: segment.transcriptExcerpt || '无',
    cardPrompt: cardPrompt?.trim() || '无',
    currentCardSection,
    programContext,
    // 旧版自定义模板可能仍在使用 {{fullTranscript}}；这里给它注入与 programContext
    // 同值的浓缩上下文，避免破坏存量模板，同时不再发送整篇全文。
    fullTranscript: programContext,
  });
}

export async function planTranscriptSegments(
  entries: SrtEntry[],
  settings: AISettings,
  options: AnalyzeSrtOptions = {},
): Promise<SegmentPlanningResult> {
  const {
    generateStructuredData: requestStructuredData = generateStructuredData,
    globalPrompt,
    planningTemplate,
    projectBindings,
  } = options;

  if (entries.length === 0) {
    throw new Error('没有可分析的字幕内容');
  }

  const binding = maybeResolveBinding('planning.segment', settings, projectBindings);
  const payload = await requestStructuredData(
    settings,
    buildSegmentPlanningPrompt(globalPrompt, planningTemplate),
    buildSrtText(entries),
    binding,
    { label: 'planning.segment' },
  );
  const parsed = parseSegmentPlanningResult(payload);
  if (!parsed) {
    throw new Error('LLM 未返回有效的段落规划结果');
  }

  return {
    ...parsed,
    globalPrompt: globalPrompt?.trim() || parsed.globalPrompt,
  };
}

export async function generateCardForSegment(
  entries: SrtEntry[],
  planning: Pick<SegmentPlanningResult, 'summary' | 'keywords' | 'globalPrompt'>,
  segment: AISegment,
  settings: AISettings,
  options: {
    generateStructuredData?: typeof generateStructuredData;
    globalPrompt?: string;
    cardPrompt?: string;
    currentCard?: AICard;
    cardTemplate?: PromptTemplate;
    projectBindings?: PromptBindingMap | null;
    segmentIndex?: number;
    totalSegments?: number;
    prevSegment?: AISegment;
    nextSegment?: AISegment;
  } = {},
): Promise<AICard> {
  const {
    generateStructuredData: requestStructuredData = generateStructuredData,
    globalPrompt,
    cardPrompt,
    currentCard,
    cardTemplate,
    projectBindings,
    segmentIndex,
    totalSegments,
    prevSegment,
    nextSegment,
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
        cardPrompt,
        currentCard,
        programSummary: planning.summary,
        keywords: planning.keywords,
      },
      cardTemplate,
    ),
    segmentTranscript,
    binding,
    { label: positionLabel },
  );
  const parsed = normalizeCard(payload, 0, segment.id, cardPrompt);
  if (!parsed) {
    throw new Error('LLM 未返回有效的卡片结果');
  }

  return {
    ...parsed,
    segmentId: segment.id,
    cardPrompt: cardPrompt?.trim() || parsed.cardPrompt,
  };
}

export async function analyzeSrt(
  entries: SrtEntry[],
  settings: AISettings,
  options: AnalyzeSrtOptions = {},
): Promise<AIAnalysisResult> {
  const {
    generateStructuredData: requestStructuredData = generateStructuredData,
    globalPrompt,
    planningTemplate,
    cardTemplate,
    projectBindings,
    onProgress,
  } = options;

  onProgress?.({ phase: 'planning', percent: 0, message: '规划分段与封面提示词…' });

  const planning = await planTranscriptSegments(entries, settings, {
    generateStructuredData: requestStructuredData,
    globalPrompt,
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
      try {
        const card = await generateCardForSegment(entries, planning, segment, settings, {
          generateStructuredData: requestStructuredData,
          globalPrompt: planning.globalPrompt,
          cardTemplate,
          projectBindings,
          segmentIndex: i,
          totalSegments: total,
          prevSegment: i > 0 ? planning.segments[i - 1] : undefined,
          nextSegment: i + 1 < planning.segments.length ? planning.segments[i + 1] : undefined,
        });
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
    globalPrompt,
    cardPrompt = card.cardPrompt,
    programSummary,
    keywords = [],
    cardTemplate,
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
      globalPrompt,
      cardPrompt,
      currentCard: card,
      cardTemplate,
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
 * 面向"用户手选字幕 → 单张 web-card"的生成入口。
 *
 * 策略：复用 `cards.segment` 管线，把用户草稿组装成合成段落后喂入；
 * 通过 cardPrompt 注入"只产出 1 张 web-card + 类型建议 + 用户补充"三条硬约束；
 * 返回前强制要求 renderMode === 'web-card'，否则抛错让用户手动重试。
 */
export async function generateSingleCardFromSubtitles(
  entries: SrtEntry[],
  draft: SubtitleCardDraftInput,
  settings: AISettings,
  options: {
    globalPrompt?: string;
    programSummary?: string;
    keywords?: string[];
    cardTemplate?: PromptTemplate;
    projectBindings?: PromptBindingMap | null;
    generateStructuredData?: typeof generateStructuredData;
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
    programSummary,
    keywords = [],
    cardTemplate,
    projectBindings,
    generateStructuredData: requestStructuredData,
  } = options;

  const hint = draft.promptHint?.trim();
  const cardPromptLines = [
    `只产出 1 张卡片，renderMode 必须为 "web-card"（使用 webCard.srcDoc 返回完整 HTML）。`,
    `卡片类型建议为 "${draft.type}"，可根据内容微调但请保留 web-card 形态。`,
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
      globalPrompt,
      cardPrompt,
      cardTemplate,
      projectBindings,
    },
  );

  if (card.renderMode !== 'web-card') {
    throw new Error('LLM 未按要求产出 web-card，请重试');
  }

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
