import { MOTION_SANDBOX_REFERENCE } from './motion-runtime';
import type { MotionAssetInfo, MotionCanvasSize, MotionGenerateParams } from '../types/motion';

const DEFAULT_CANVAS_SIZE: MotionCanvasSize = {
  width: 1920,
  height: 1080,
};

function formatAssets(assets?: MotionAssetInfo[]): string {
  if (!assets || assets.length === 0) {
    return '无';
  }

  return assets
    .map((asset) => `- ${asset.name} (${asset.type})${asset.path ? ` -> ${asset.path}` : ''}`)
    .join('\n');
}

export function extractMotionCode(rawText: string): string {
  const trimmed = rawText.trim();
  const fencedMatch = trimmed.match(/```(?:tsx|ts|jsx|js)?\n?([\s\S]*?)```/i);
  return fencedMatch?.[1]?.trim() || trimmed;
}

export function buildMotionSystemPrompt(): string {
  return `你是一个 Remotion 动画组件生成器。你的任务是输出可以直接编译执行的 JSX/TSX 代码。

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
${MOTION_SANDBOX_REFERENCE}
`;
}

export function buildMotionGenerateUserPrompt(params: MotionGenerateParams): string {
  const canvasSize = params.canvasSize ?? DEFAULT_CANVAS_SIZE;
  const durationMs = params.durationMs ?? 5_000;

  return `请根据下面的需求生成一段完整的 Motion Card 代码。

用户描述：
${params.prompt.trim()}

画布尺寸：
- width: ${canvasSize.width}
- height: ${canvasSize.height}

动画时长：
- ${durationMs}ms

显示模式：
- ${params.displayMode ?? 'fullscreen'}

可选素材上下文：
${formatAssets(params.assets)}
`;
}

export function buildMotionModifyUserPrompt(params: {
  sourceCode: string;
  instruction: string;
}): string {
  return `请基于现有 Motion Card 代码，按要求输出完整的新版本代码。

修改要求：
${params.instruction.trim()}

当前代码：
\`\`\`tsx
${params.sourceCode.trim()}
\`\`\`
`;
}

export function buildMotionAutoFixUserPrompt(params: {
  sourceCode: string;
  error: string;
  stage?: 'compile' | 'runtime';
}): string {
  return `请修复这段 Motion Card 代码，并直接返回完整新代码。

错误阶段：
${params.stage ?? 'compile'}

错误信息：
${params.error.trim()}

当前代码：
\`\`\`tsx
${params.sourceCode.trim()}
\`\`\`
`;
}

export { DEFAULT_CANVAS_SIZE };
