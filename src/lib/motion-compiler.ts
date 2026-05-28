import type { MotionCompileResult } from '../types/motion';

const MODULE_SYNTAX_PATTERN = /^\s*(import|export)\s/m;
const ASYNC_SYNTAX_PATTERN = /\basync\b|\bawait\b/;
const SCRIPT_PATTERN = /<script[\s\S]*?>[\s\S]*?<\/script>/i;
const GSAP_PATTERN = /\bgsap\./;

function stripHtmlFences(source: string): string {
  return source
    .trim()
    .replace(/^```(?:html)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
}

function validateMotionHtml(html: string): string | null {
  const trimmed = html.trim();
  if (!trimmed) return 'Motion Card HTML 不能为空';
  if (MODULE_SYNTAX_PATTERN.test(trimmed)) {
    return 'Motion Card 不支持 import/export，请输出可直接插入的 HTML + CSS + GSAP';
  }
  if (ASYNC_SYNTAX_PATTERN.test(trimmed)) {
    return 'Motion Card 不支持 async/await，请保持时间线同步构建';
  }
  if (!SCRIPT_PATTERN.test(trimmed) || !GSAP_PATTERN.test(trimmed)) {
    return 'Motion Card 必须包含同步 <script> 并使用 gsap 构建动画';
  }
  return null;
}

export function compileMotionSource(sourceHtml: string): MotionCompileResult {
  const html = stripHtmlFences(sourceHtml);
  const validationError = validateMotionHtml(html);
  if (validationError) {
    return { success: false, error: validationError };
  }
  return {
    success: true,
    html,
  };
}
