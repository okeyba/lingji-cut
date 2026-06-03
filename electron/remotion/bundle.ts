import { bundle } from '@remotion/bundler';

let cachedBundle: { key: string; serveUrl: string } | null = null;

/**
 * 打包 Remotion 合成工程（src/remotion/index.ts）。
 * 卡片在运行时由 CardHost 通过 inputProps.compiledCards 求值，bundle 结构是静态的；
 * 但素材会 materialize 到每次导出的临时 publicDir，故按 entryPoint + publicDir 作缓存键。
 */
export async function getRemotionBundle(entryPoint: string, publicDir?: string): Promise<string> {
  const key = `${entryPoint}::${publicDir ?? ''}`;
  if (cachedBundle && cachedBundle.key === key) {
    return cachedBundle.serveUrl;
  }
  const serveUrl = await bundle({
    entryPoint,
    publicDir,
    webpackOverride: (config) => config,
  });
  cachedBundle = { key, serveUrl };
  return serveUrl;
}
