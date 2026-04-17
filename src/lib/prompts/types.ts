export const PROMPT_KINDS = [
  'planning.segment',
  'cover.regeneration',
  'cards.segment',
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

export interface PromptKindMeta {
  kind: PromptKind;
  label: string;
  description: string;
  group: 'ai-analysis' | 'motion';
  variables: { name: string; description: string }[];
}

export const PROMPT_KIND_META: Record<PromptKind, PromptKindMeta> = {
  'planning.segment': {
    kind: 'planning.segment',
    label: '字幕分段规划',
    description: '整篇字幕拆分为多个语义段落，并给出 1 条封面提示词、总结、关键词',
    group: 'ai-analysis',
    variables: [
      { name: 'globalPromptLine', description: '额外创作要求行；有值时形如"额外创作要求：xxx"，无值为空字符串' },
    ],
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
