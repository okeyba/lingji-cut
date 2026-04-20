import type { PromptKind } from './types';

const PLANNING_SEGMENT = `name: planning.segment
description: 字幕分段规划提示词
version: 2
user: |-
  你是一个播客内容分析助手。请先完整理解整篇字幕，再把节目拆成有明确语义边界的段落。
  {{globalPromptLine}}

  段落拆分要求：
  - 必须按真实话题边界拆分，而不是按 token 长度硬切
  - startMs / endMs 必须对应该段真正开始与结束的字幕时间
  - 如果前面只是铺垫，不要把时间提前算进该段
  - transcriptExcerpt 保留该段最关键的原始字幕摘录，便于后续逐段生成卡片

  coverPrompts 要求（数组中只能且必须 1 条字符串）：
  - 必须使用简体中文；除品牌名、专有名词或必要缩写外，不要出现英文
  - 单条长度 120-200 字（过短画面随机，过长模型会忽略细节）
  - 必须按 主体 → 行为 → 环境 → 画面风格 → 美学词 → 质量词 → 画面文字标题及排版 的顺序组织，权重随位置递减
  - 主体 / 行为 / 环境 用连贯自然语言描述正在发生什么；画面风格 / 美学词 / 质量词 用独立词组串联，禁止展开成句
  - 美学词需覆盖 色彩、灯光光影、景别、构图 四类中至少 3 类，每类 1-2 个独立词组
  - 使用中文逗号"，"或分号"；"分隔要素，禁止使用换行 / 斜杠 / 特殊符号
  - 必须输出画面文字标题：先从整期内容提炼一条 8-14 个汉字的节目标题，用中文引号""…""精确包裹（如""深夜电台·声音档案""），保证 AI 生图的文字准确率
  - 文字排版必须给出具体约束，至少包含：字体族（如 思源黑体 / 苹方 / 站酷高端黑，优先现代中文无衬线，避免花体）、字重（Regular / Medium / Bold，默认 Bold）、字号占画面高度比例（6%-12%）、主文字颜色（给十六进制色值并与背景形成明显对比）、描边 / 阴影 / 光晕 / 渐变中任选 1-2 种、排版位置（顶部居中 / 顶部左对齐 / 居中下沉 / 底部居中 / 左侧竖排 等，避免遮挡主体）
  - 画面中禁止出现多余文字（副标题、署名、水印、logo、日期）与拼写错误；仅保留 1 条标题
  - 面向 16:9 播客封面：主体居中突出、信息聚焦，紧扣节目核心主题 / 关键人物 / 冲突感
  - 避免"美丽、震撼、惊艳"等空泛形容词与营销式堆砌
`;

const COVER_REGENERATION = `name: cover.regeneration
description: 封面提示词重生成
version: 4
user: |-
  你是一个专业的文生图提示词工程师，熟悉播客选题与视觉传达。
  请结合本期字幕内容，为这一期播客生成 1 条可直接用于 AI 生图的 16:9 封面提示词。

  已有整期创作提示词：
  {{globalPrompt}}

  当前封面提示词（仅用于参考，可改写）：
  {{currentPrompt}}

  【提示词结构规范】
  单条提示词必须按以下 7 个维度、严格按序组织，用中文逗号"，"或分号"；"串联，整体长度 120-200 字：

  1. 主体（自然语言）
     - 角色 / 外貌 / 服装 / 材质 / 形态 / 数量
     - 示例要素：一位戴黑框眼镜的年轻女主持人；一台复古收音机；一束插在玻璃瓶里的干花
  2. 行为（自然语言）
     - 动作 / 神态 / 状态 / 互动
     - 示例要素：专注地面对麦克风讲述；侧头聆听并露出沉思表情；双手环抱咖啡杯凝视窗外
  3. 环境（自然语言）
     - 场景 / 时间 / 天气 / 氛围 / 道具细节
     - 示例要素：午夜的城市录音室，暖黄台灯与散落的书本营造静谧氛围
  4. 画面风格（独立词组，选 1 种为主）
     - 写实摄影 / 艺术插画 / 新海诚风格 / 水粉插画 / 赛博朋克 / 极简线条 / 3D 渲染 / 水墨风 / 中式怪诞 等
  5. 美学词（独立词组，四类至少覆盖 3 类，每类 1-2 个）
     - 色彩：莫兰迪色系 / 冷色调 / 暖色调 / 金箔岩彩 / 高饱和度 / 低饱和复古色 / 黑金撞色 等
     - 灯光光影：自然光 / 逆光 / 侧逆光 / 夕阳 / 柔和光 / 体积光 / 电影级布光 / 霓虹光 等
     - 景别：特写 / 近景 / 中景 / 远景 / 全身照 / 俯视视角 / 低角度 等
     - 构图：中心构图 / 三分构图 / 对角线构图 / 对称构图 / 黄金比例 / 框架式构图 等
  6. 质量词（独立词组，选 2-3 个）
     - 8K 高清 / 细腻纹理 / 丰富层次 / 电影质感 / 大师构图 / 胶片颗粒感 / 超高分辨率 等
  7. 画面文字标题及排版（必须包含，由以下两段组成）
     - 7.1 标题文本：先从整期字幕中提炼 1 条 8-14 个汉字的节目标题（若节目已有固定栏目名 / IP 名，优先复用），用中文引号""…""精确包裹。例如：画面顶部居中呈现标题""深夜电台·声音档案""
     - 7.2 排版约束（独立词组串联，不要展开成句），每条必选：
       · 字体族：优先现代中文无衬线字体，如 思源黑体 / 苹方 / 站酷高端黑 / 方正兰亭黑 / 阿里巴巴普惠体；避免花体、手写体、衬线字体，保证辨识度
       · 字重：Regular / Medium / Bold / Black，大标题默认 Bold 或 Black
       · 字号：以"占画面高度百分比"表达，主标题建议 8%-14%，副元素不超过 5%
       · 主文字颜色：给具体十六进制色值（如 #FDEDC8、#0A84FF、#111111），必须与背景形成明显明度对比
       · 描边 / 阴影 / 光效：从 2px 深色描边 / 柔和投影 / 外发光 / 细腻渐变 / 彩色高光 中选 1-2 种叠加
       · 排版位置：顶部居中 / 顶部左对齐 / 居中下沉 / 底部居中 / 左侧竖排 等，必须避免遮挡主体面部或视觉焦点

  【强制规则】
  - 主体 / 行为 / 环境 必须是可读的自然语言句子，清晰交代"谁、在做什么、在哪里"
  - 画面风格 / 美学词 / 质量词 / 排版约束 必须是独立词组，用中文逗号串联，禁止写成句子、禁止用形容词+名词的长修饰
  - 越靠前权重越高，严格按 主体 → 行为 → 环境 → 风格 → 美学 → 质量 → 文字标题与排版 的顺序排布，不得颠倒
  - 整体长度 120-200 字，必要时可先省略次要细节，保证核心主体与文字标题约束完整
  - 使用中文逗号"，"或分号"；"分隔要素，禁止使用换行、斜杠 /、括号堆叠或其它特殊符号
  - 必须使用简体中文；除品牌名、专有名词、字体族名或必要缩写外，不要出现英文
  - 文字标题必须用中文引号""…""精确包裹，保证 AI 生图的文字准确率
  - 画面中只允许出现 1 条标题文字，禁止副标题、期号、署名、水印、logo、日期、二维码等多余元素
  - 标题内容必须紧扣本期核心主题、关键人物或冲突感，不使用"美丽、震撼、惊艳、极致"等空泛形容词
  - 排版位置必须避免遮挡主体面部或画面焦点；标题颜色必须与背景色形成明度对比，禁止浅底浅字或深底深字
  - 面向 16:9 播客封面：主体居中、画面聚焦、信息层级清晰，避免小弹窗 / 窄画幅 / 大量留白构图
  - 禁止出现裸露、暴力、政治敏感、品牌侵权等违规元素

  【参考示例】（仅示范格式与颗粒度，不要照抄内容）
  一位戴黑框眼镜的年轻女主持人身着米色针织衫，专注地对着复古银色麦克风讲述并微微前倾，身处深夜录音室中，暖黄台灯在木质桌面投下柔和光斑，桌上散落着打开的笔记本与一杯冒热气的咖啡，写实摄影风格，莫兰迪暖色调，侧逆光，中景，三分构图，8K 高清，电影质感，细腻纹理，画面顶部居中呈现标题""深夜电台·声音档案""，思源黑体，Bold，字号约占画面高度 10%，主色 #FDEDC8 暖米金，2px 深棕色描边，柔和外发光，顶部居中排版不遮挡主持人面部
`;

const CARDS_SEGMENT = `name: cards.segment
description: 围绕单个 segment 生成网页信息卡
version: 2
user: |-
  你是一个播客内容分析助手，同时也是一个网页信息卡设计师。现在要围绕单个内容段落生成一张网页信息卡。

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

  时间轴约束（非常重要）：
  - startMs 必须对应"观众真正听到该主题"的那句字幕开始时间
  - 不要把铺垫、转场、提问或上一话题的时间提前算进来
  - endMs 必须对应该主题核心表达完成的那句字幕结束时间
  - displayDurationMs 必须覆盖这张卡片对应的核心表达，不能在主题刚讲到时就结束
  - 如果一个主题在后半段才真正展开，宁可把 startMs 设晚，也不要让卡片提前出现

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
`;

const SCRIPT_REVIEW = `name: script.review
description: 口播稿 AI 审查提示词
version: 2
system: |-
  你是一位专业的口播稿审查编辑。请审查用户提供的口播稿，从以下维度给出批注：

  1. **事实准确性**（severity: error）：数据是否有来源、表述是否可能有误
  2. **表达流畅性**（severity: warning）：是否有书面化表达、长句、不适合口播的措辞
  3. **逻辑连贯性**（severity: warning）：段落过渡是否自然、论述是否有跳跃
  4. **口语化程度**（severity: info）：可以更口语化的表达建议

  业务规则：
  - 批注数量控制在 3~8 条，聚焦最重要的问题
  - 不要对标题格式（# ## 等）做批注
user: |-
  请审查下面这篇口播稿：

  {{scriptText}}
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
  'script.review': SCRIPT_REVIEW,
  'motion.system': MOTION_SYSTEM,
  'motion.generate': MOTION_GENERATE,
  'motion.modify': MOTION_MODIFY,
  'motion.autofix': MOTION_AUTOFIX,
};
