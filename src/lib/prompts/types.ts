export const PROMPT_KINDS = [
  'planning.segment',
  'cover.regeneration',
  'cards.segment',
  'script.review',
  'motion.system',
  'motion.generate',
  'motion.modify',
  'motion.autofix',
] as const;

export type PromptKind = (typeof PROMPT_KINDS)[number];

export function isPromptKind(value: unknown): value is PromptKind {
  return typeof value === 'string' && (PROMPT_KINDS as readonly string[]).includes(value);
}

export type PromptScope = 'builtin' | 'global' | 'project';

export interface PromptTemplate {
  name: string;
  description?: string;
  version?: number;
  system?: string;
  user: string;
}

export interface EffectivePromptTemplate extends PromptTemplate {
  sourceScope: PromptScope;
}

export interface LockedContract {
  /** 拼接位置；当前统一用 user-tail，保留扩展性 */
  position: 'user-tail';
  /** 实际拼进 prompt 的文本 */
  content: string;
  /** 给用户的说明，解释为何不可编辑 */
  reason: string;
}

export interface PromptKindMeta {
  kind: PromptKind;
  label: string;
  description: string;
  group: 'ai-analysis' | 'script' | 'motion';
  variables: { name: string; description: string }[];
  /** 业务契约段：每次请求自动拼接，UI 只读展示 */
  lockedContract?: LockedContract;
}

const LOCKED_PLANNING_SEGMENT = `【系统契约 · 不可修改】
输出必须是严格 JSON，且只返回 JSON，不要附加解释。

顶层结构必须包含：
- segments: 2-8 个段落
- coverPrompts: 数组，且只能包含 1 条字符串
- summary: 一句话总结
- keywords: 关键词数组
- globalPrompt: 沿用输入的整期创作提示词，没有则返回空字符串

segments 中每一项必须包含：
- id
- title
- summary
- startMs (number, 毫秒)
- endMs (number, 毫秒)
- transcriptExcerpt
- semanticType: data | explanation | chapter-transition | quote | narration
- complexityLevel: low | medium | high
- visualizationScore: 0-100
- pacingNeed: steady | accent | transition
- keywords: 该段关键词数组
- entities: 该段关键实体数组`;

const LOCKED_COVER_REGENERATION = `【系统契约 · 不可修改】
输出必须是严格 JSON，且只返回 JSON，不要附加解释。

顶层结构必须包含：
- coverPrompts: 数组，且只能包含 1 条字符串`;

const LOCKED_CARDS_SEGMENT = `【系统契约 · 不可修改】
输出必须是严格 JSON 对象，且只返回 JSON，不要附加解释。

字段必须包含：
id, segmentId, type, title, content, startMs, endMs, displayDurationMs,
displayMode, template, enabled, style, renderMode, cardPrompt, webCard

约束：
- renderMode 默认输出 "web-card"
- webCard.srcDoc 必须是完整 HTML 文档（允许 HTML/CSS/JS 和外部资源）
- startMs / endMs / displayDurationMs 必须输出毫秒数字`;

const LOCKED_SCRIPT_REVIEW = `【系统契约 · 不可修改】
请以严格 JSON 格式返回审查结果，且只返回 JSON：
{
  "annotations": [
    {
      "originalText": "需要标注的原文片段（必须是稿件中的精确子串）",
      "issue": "问题描述",
      "suggestion": "修改建议（替换后的完整文本）",
      "severity": "error | warning | info"
    }
  ]
}

字段约束：
- originalText 必须是稿件中能精确匹配的子串
- severity 必须是 error | warning | info 之一
- suggestion 必须是可以直接替换 originalText 的完整文本`;

export const PROMPT_KIND_META: Record<PromptKind, PromptKindMeta> = {
  'planning.segment': {
    kind: 'planning.segment',
    label: '字幕分段规划',
    description: '整篇字幕拆分为多个语义段落，并给出 1 条封面提示词、总结、关键词',
    group: 'ai-analysis',
    variables: [
      { name: 'globalPromptLine', description: '额外创作要求行；有值时形如"额外创作要求：xxx"，无值为空字符串' },
    ],
    lockedContract: {
      position: 'user-tail',
      content: LOCKED_PLANNING_SEGMENT,
      reason: '业务侧按此 schema 解析分段数据、封面提示词、关键词；修改会导致分析结果无法落库。',
    },
  },
  'cover.regeneration': {
    kind: 'cover.regeneration',
    label: '封面提示词重生成',
    description: '根据字幕与现有提示词重生成单条 16:9 播客封面提示词',
    group: 'ai-analysis',
    variables: [
      { name: 'globalPrompt', description: '整期创作提示词（为空填"无"）' },
      { name: 'currentPrompt', description: '当前封面提示词（为空填"无"）' },
    ],
    lockedContract: {
      position: 'user-tail',
      content: LOCKED_COVER_REGENERATION,
      reason: '业务侧从 JSON.coverPrompts[0] 读取提示词；修改会导致封面重生成无法解析。',
    },
  },
  'cards.segment': {
    kind: 'cards.segment',
    label: '段落信息卡片生成',
    description: '围绕单个 segment 生成一张结构化网页信息卡（基于全文上下文）',
    group: 'ai-analysis',
    variables: [
      { name: 'globalPrompt', description: '整期创作提示词' },
      { name: 'programSummary', description: '节目级总结' },
      { name: 'keywords', description: '节目关键词（顿号分隔）' },
      { name: 'segmentId', description: 'segment id' },
      { name: 'segmentTitle', description: 'segment 标题' },
      { name: 'segmentSummary', description: 'segment 摘要' },
      { name: 'segmentStartMs', description: 'segment 起始毫秒' },
      { name: 'segmentEndMs', description: 'segment 结束毫秒' },
      { name: 'segmentTranscriptExcerpt', description: 'segment 原始摘录' },
      { name: 'cardPrompt', description: '单卡追加提示词' },
      { name: 'currentCardSection', description: '当前卡片线索多行块（由调用方构造）' },
      { name: 'fullTranscript', description: '完整字幕全文（带时间戳）' },
    ],
    lockedContract: {
      position: 'user-tail',
      content: LOCKED_CARDS_SEGMENT,
      reason: '业务侧按此结构创建 AICard（含 webCard.srcDoc、时间轴字段）；修改会破坏卡片渲染与时间轴。',
    },
  },
  'script.review': {
    kind: 'script.review',
    label: '文稿 AI 审查',
    description: '口播稿审稿提示词。模型返回 annotations JSON（originalText/issue/suggestion/severity）',
    group: 'script',
    variables: [
      { name: 'scriptText', description: '待审查的完整口播稿正文' },
    ],
    lockedContract: {
      position: 'user-tail',
      content: LOCKED_SCRIPT_REVIEW,
      reason: '业务侧按 annotations[] 定位批注；修改会让审查结果无法在编辑器中展示。',
    },
  },
  'motion.system': {
    kind: 'motion.system',
    label: 'Motion 系统提示词',
    description: '动态 Remotion 组件生成的系统约束',
    group: 'motion',
    variables: [
      { name: 'sandboxReference', description: '沙箱可用 API 清单' },
    ],
  },
  'motion.generate': {
    kind: 'motion.generate',
    label: 'Motion 生成',
    description: '根据用户描述生成全新 Motion Card 代码',
    group: 'motion',
    variables: [
      { name: 'userPrompt', description: '用户描述' },
      { name: 'canvasWidth', description: '画布宽度 px' },
      { name: 'canvasHeight', description: '画布高度 px' },
      { name: 'durationMs', description: '动画时长毫秒' },
      { name: 'displayMode', description: 'fullscreen | pip' },
      { name: 'assets', description: '可选素材列表（为空填"无"）' },
    ],
  },
  'motion.modify': {
    kind: 'motion.modify',
    label: 'Motion 修改',
    description: '基于现有源码按需求输出新版本 Motion Card 代码',
    group: 'motion',
    variables: [
      { name: 'instruction', description: '修改要求' },
      { name: 'sourceCode', description: '当前源码' },
    ],
  },
  'motion.autofix': {
    kind: 'motion.autofix',
    label: 'Motion 自动修复',
    description: '当 Motion 代码编译或运行失败时的自动修复提示词',
    group: 'motion',
    variables: [
      { name: 'stage', description: 'compile | runtime' },
      { name: 'error', description: '错误信息' },
      { name: 'sourceCode', description: '当前源码' },
    ],
  },
};
