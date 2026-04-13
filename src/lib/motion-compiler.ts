import * as Babel from '@babel/standalone';
import type { MotionCompileResult } from '../types/motion';

const MODULE_SYNTAX_PATTERN = /^\s*(import|export)\s/m;
const ASYNC_SYNTAX_PATTERN = /\basync\b|\bawait\b/;
const MOTION_COMPONENT_PATTERN = /\b(?:const|let|var|function)\s+MotionComponent\b/;

function validateMotionSource(sourceCode: string): string | null {
  const trimmed = sourceCode.trim();

  if (!trimmed) {
    return 'Motion Card 源码不能为空';
  }

  if (MODULE_SYNTAX_PATTERN.test(trimmed)) {
    return 'Motion Card 不支持 import/export，请直接使用沙箱注入的 API';
  }

  if (ASYNC_SYNTAX_PATTERN.test(trimmed)) {
    return 'Motion Card 不支持 async/await，请保持逐帧渲染同步';
  }

  if (!MOTION_COMPONENT_PATTERN.test(trimmed)) {
    return '必须定义名为 MotionComponent 的组件';
  }

  return null;
}

export function compileMotionSource(sourceCode: string): MotionCompileResult {
  const validationError = validateMotionSource(sourceCode);
  if (validationError) {
    return {
      success: false,
      error: validationError,
    };
  }

  try {
    const result = Babel.transform(sourceCode, {
      filename: 'motion-card.tsx',
      sourceType: 'script',
      presets: [
        ['react', { runtime: 'classic' }],
        ['typescript', { allExtensions: true, isTSX: true }],
      ],
    });

    const compiledCode = result.code?.trim();
    if (!compiledCode) {
      return {
        success: false,
        error: 'Motion Card 编译失败：Babel 未返回可执行代码',
      };
    }

    return {
      success: true,
      compiledCode,
    };
  } catch (error) {
    return {
      success: false,
      error: `Motion Card 编译失败：${error instanceof Error ? error.message : String(error)}`,
    };
  }
}
