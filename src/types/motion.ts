export interface MotionCardPayload {
  /** HyperFrames 片段：HTML + CSS + GSAP 脚本，直接插入卡片容器。 */
  html: string;
  compiledAt: number;
  compileError?: string;
  prompt: string;
  retryCount: number;
}

export type MotionTemplateKey =
  | 'kpi-countup'
  | 'bar-chart-reveal'
  | 'ranking-stack'
  | 'before-after-compare'
  | 'step-flow-explainer'
  | 'chapter-stinger';

export interface MotionSubtitleCue {
  startMs: number;
  endMs: number;
  text: string;
  relativeStartFrame: number;
  relativeEndFrame: number;
}

export interface MotionAssetInfo {
  name: string;
  type: 'image' | 'video' | 'audio' | 'other';
  path?: string;
}

export interface MotionCanvasSize {
  width: number;
  height: number;
}

export interface MotionCompileSuccess {
  success: true;
  html: string;
}

export interface MotionCompileFailure {
  success: false;
  error: string;
}

export type MotionCompileResult = MotionCompileSuccess | MotionCompileFailure;

export interface MotionCardResult {
  success: boolean;
  html?: string;
  error?: string;
  retryCount: number;
}

export interface MotionGenerateParams {
  prompt: string;
  durationMs?: number;
  displayMode?: 'fullscreen' | 'pip';
  canvasSize?: MotionCanvasSize;
  assets?: MotionAssetInfo[];
}

export interface MotionModifyParams {
  html: string;
  instruction: string;
}
