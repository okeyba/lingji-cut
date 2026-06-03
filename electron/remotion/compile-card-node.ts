import { transform } from 'esbuild';

export interface CompiledCard {
  overlayId: string;
  js?: string;
  error?: string;
}

/**
 * 把单段 Motion Card TSX 编译为 CJS 模块字符串。
 * react / react/jsx-runtime / remotion 设为运行时注入（不打包），
 * 由渲染侧 / 导出侧的 require 垫片提供，保证与宿主共享同一 React + Remotion 实例，
 * useCurrentFrame 等 hooks 才能在 Remotion 渲染上下文内正常工作。
 */
export async function compileCardTsx(overlayId: string, tsx: string): Promise<CompiledCard> {
  const source = (tsx ?? '').trim();
  if (!source) return { overlayId, error: 'Motion Card TSX 为空' };
  try {
    const result = await transform(source, {
      loader: 'tsx',
      format: 'cjs',
      jsx: 'automatic',
      target: 'es2020',
      sourcemap: false,
      logLevel: 'silent',
    });
    return { overlayId, js: result.code };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { overlayId, error: message };
  }
}

/** 批量编译，返回 overlayId → 编译后 JS 的映射（失败项记录 error 但不抛）。 */
export async function compileCards(
  cards: { overlayId: string; tsx: string }[],
): Promise<Record<string, string>> {
  const compiled = await Promise.all(cards.map((c) => compileCardTsx(c.overlayId, c.tsx)));
  const map: Record<string, string> = {};
  for (const c of compiled) {
    if (c.js) map[c.overlayId] = c.js;
  }
  return map;
}
