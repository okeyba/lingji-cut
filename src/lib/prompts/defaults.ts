import type { PromptKind } from './types';

const PLANNING_SEGMENT = `name: planning.segment
description: 字幕分段规划提示词
version: 1
user: |-
  你是一个播客内容分析助手。请先完整理解整篇字幕，再把节目拆成有明确语义边界的段落，并输出严格 JSON。
  {{globalPromptLine}}
  输出结构必须包含：
  - segments: 2-8 个段落
  - coverPrompts: 1 组封面提示词，数组中只能有 1 条
  - summary: 一句话总结
  - keywords: 关键词数组
  - globalPrompt: 沿用输入的整期创作提示词，没有则返回空字符串

  segments 中每一项必须包含：
  - id
  - title
  - summary
  - startMs
  - endMs
  - transcriptExcerpt
  - semanticType: data / explanation / chapter-transition / quote / narration
  - complexityLevel: low / medium / high
  - visualizationScore: 0-100
  - pacingNeed: steady / accent / transition
  - keywords: 该段关键词数组
  - entities: 该段关键实体数组

  段落拆分要求：
  - 必须按真实话题边界拆分，而不是按 token 长度硬切
  - startMs / endMs 必须对应该段真正开始与结束的字幕时间
  - 如果前面只是铺垫，不要把时间提前算进该段
  - transcriptExcerpt 保留该段最关键的原始字幕摘录，便于后续逐段生成卡片

  coverPrompts 要求：
  - 必须使用简体中文
  - 适合直接用于 16:9 播客封面生成
  - 除品牌名、专有名词或必要缩写外，不要使用英文

  请只返回 JSON，不要附加解释。
`;

const COVER_REGENERATION = `name: cover.regeneration
description: 封面提示词重生成
version: 1
user: |-
  你是一个播客封面创意助手。请结合字幕内容，为这一期播客输出严格 JSON，且只返回 1 条封面提示词。

  已有整期创作提示词：
  {{globalPrompt}}

  当前封面提示词（仅用于参考，可改写）：
  {{currentPrompt}}

  输出结构必须包含：
  - coverPrompts: 数组，但只能包含 1 条字符串

  要求：
  - 必须使用简体中文
  - 适合直接用于 AI 生成 16:9 播客封面
  - 画面感强，信息聚焦，避免空泛形容词堆砌
  - 尽量体现节目核心主题、关键人物或冲突感
  - 除品牌名、专有名词或必要缩写外，不要使用英文

  请只返回 JSON，不要附加解释。
`;

const CARDS_SEGMENT = `name: cards.segment
description: 围绕单个 segment 生成网页信息卡
version: 1
user: |-
  你是一个播客内容分析助手，同时也是一个网页信息卡设计师。现在要围绕单个内容段落生成一张网页信息卡，请输出严格 JSON，且只返回单张卡片对象。

  整期创作提示词：
  {{globalPrompt}}

  节目级总结：
  {{programSummary}}

  节目关键词：
  {{keywords}}

  当前 segment 信息：
  - id: {{segmentId}}
  - title: {{segmentTitle}}
  - summary: {{segmentSummary}}
  - startMs: {{segmentStartMs}}
  - endMs: {{segmentEndMs}}
  - transcriptExcerpt: {{segmentTranscriptExcerpt}}

  单卡追加提示词：
  {{cardPrompt}}

  {{currentCardSection}}
  输出字段必须包含：
  - id
  - segmentId
  - type
  - title
  - content
  - startMs
  - endMs
  - displayDurationMs
  - displayMode
  - template
  - enabled
  - style
  - renderMode
  - cardPrompt
  - webCard

  其中：
  - renderMode 默认输出 "web-card"
  - webCard.srcDoc 必须是完整 HTML 文档
  - 允许 HTML/CSS/JS 和外部资源

  时间轴约束（非常重要）：
  - startMs 必须对应"观众真正听到该主题"的那句字幕开始时间
  - 不要把铺垫、转场、提问或上一话题的时间提前算进来
  - endMs 必须对应该主题核心表达完成的那句字幕结束时间
  - displayDurationMs 必须覆盖这张卡片对应的核心表达，不能在主题刚讲到时就结束
  - 如果一个主题在后半段才真正展开，宁可把 startMs 设晚，也不要让卡片提前出现
  - startMs、endMs、displayDurationMs 必须输出毫秒数字

  统一视觉基线（首次生成与二次重生成都必须遵守）：
  - 必须按 1920x1080 的 16:9 画布设计，并默认铺满整个画面
  - 禁止只做居中的窄卡片、手机比例、小弹窗或大量留白布局
  - 不要把主要内容限制在很小的 max-width 容器里
  - 尽量做成信息层级清晰、视觉冲击力强的 16:9 卡片
  - 不要输出 markdown 代码块
  - 内容必须忠于字幕事实，不要编造
  - 禁止输出任何"数据来源""来源：""Source""数据统计口径"之类的底部标注、免责声明、署名或角标文案
  - 请保留 card 的 title/content 作为结构化兜底文本

  颜色建议：
  - summary: #79c4ff
  - data: #4ed38a
  - insight: #ffb347
  - chapter: #9eb7ff
  - quote: #ff8f7a

  整体风格建议：
  - 偏 macOS desktop dark / Swift UI 的半透明磨砂层次
  - 高光和阴影要克制，避免霓虹紫、强饱和电商橙、网页营销页式渐变

  其他要求：
  - 必须围绕当前 segment 生成，不要偏离整期主线
  - 可以参考"当前卡片线索"延续排版与视觉方向，但不要照抄旧内容
  - 请基于整篇全文理解这段内容在整期中的作用，再决定卡片信息结构

  完整字幕全文如下：
  {{fullTranscript}}

  请只返回 JSON 对象，不要附加解释。
`;

const MOTION_SYSTEM = `name: motion.system
description: Motion 系统提示词（Remotion 动态组件生成约束）
version: 1
user: |-
  你是一个 Remotion 动画组件生成器。你的任务是输出可以直接编译执行的 JSX/TSX 代码。

  强约束：
  - 只输出代码，不要解释，不要 markdown 之外的额外文字
  - 必须定义 \`const MotionComponent = (props) => { ... }\`
  - props 固定为：\`{ frame, fps, durationInFrames, width, height }\`
    - \`frame\` 已经是相对当前动画 sequence 的起始帧（0 ~ durationInFrames）
    - \`durationInFrames\` 是当前动画自身的总帧数（不是整个视频的时长），所有 interpolate / spring 的进度都应基于它来归一化
    - \`width\` / \`height\` 是当前动画容器的像素尺寸（fullscreen 时为 1920×1080，PiP 时为 PiP 窗口尺寸），布局必须基于这两个值，而不是写死 1920/1080
  - 禁止 import/export，所有依赖都从沙箱直接注入
  - 禁止 async/await
  - 不要使用 useCurrentFrame()、useVideoConfig()，运行时已经把正确的 frame / fps / durationInFrames / width / height 通过 props 注入
  - 不要重新声明 \`React\`，也不要用 \`window.Remotion\`、\`window.React\`、\`globalThis.Remotion\`、\`globalThis.React\`、\`require()\` 去获取运行时 API
  - 可以使用 \`React.useMemo\`、\`React.useState\`、\`React.useEffect\` 等 React API
  - 优先输出可读、稳定、可维护的动画，不要炫技堆砌
  - 面向 16:9 视频画面设计，默认铺满整个动画容器（用 props.width / props.height）
  - 如果用户没有明确要求，不要依赖外部素材路径

  当前可用 API：
  {{sandboxReference}}
`;

const MOTION_GENERATE = `name: motion.generate
description: Motion 新生成（根据用户描述）
version: 1
user: |-
  请根据下面的需求生成一段完整的 Motion Card 代码。

  用户描述：
  {{userPrompt}}

  画布尺寸：
  - width: {{canvasWidth}}
  - height: {{canvasHeight}}

  动画时长：
  - {{durationMs}}ms

  显示模式：
  - {{displayMode}}

  可选素材上下文：
  {{assets}}
`;

const MOTION_MODIFY = `name: motion.modify
description: Motion 修改（基于现有代码）
version: 1
user: |-
  请基于现有 Motion Card 代码，按要求输出完整的新版本代码。

  修改要求：
  {{instruction}}

  当前代码：
  \`\`\`tsx
  {{sourceCode}}
  \`\`\`
`;

const MOTION_AUTOFIX = `name: motion.autofix
description: Motion 自动修复（编译/运行报错时）
version: 1
user: |-
  请修复这段 Motion Card 代码，并直接返回完整新代码。

  错误阶段：
  {{stage}}

  错误信息：
  {{error}}

  当前代码：
  \`\`\`tsx
  {{sourceCode}}
  \`\`\`
`;

export const DEFAULT_PROMPT_YAML: Record<PromptKind, string> = {
  'planning.segment': PLANNING_SEGMENT,
  'cover.regeneration': COVER_REGENERATION,
  'cards.segment': CARDS_SEGMENT,
  'motion.system': MOTION_SYSTEM,
  'motion.generate': MOTION_GENERATE,
  'motion.modify': MOTION_MODIFY,
  'motion.autofix': MOTION_AUTOFIX,
};
