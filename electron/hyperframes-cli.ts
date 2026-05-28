import path from 'node:path';

export interface HyperframesCliResolutionOptions {
  appPath: string;
  resourcesPath: string;
  cwd: string;
  moduleDir: string;
  existsSync: (candidate: string) => boolean;
}

const HYPERFRAMES_CLI_RELATIVE_PATH = path.join(
  'node_modules',
  'hyperframes',
  'dist',
  'cli.js',
);

function appAsarUnpackedPath(appPath: string): string | null {
  if (!appPath.includes('app.asar')) return null;
  return appPath.replace(/app\.asar(?:[/\\].*)?$/, 'app.asar.unpacked');
}

export function getHyperframesCliCandidates(
  options: HyperframesCliResolutionOptions,
): string[] {
  const candidates: string[] = [];
  const unpackedAppPath = appAsarUnpackedPath(options.appPath);
  if (unpackedAppPath) {
    candidates.push(path.join(unpackedAppPath, HYPERFRAMES_CLI_RELATIVE_PATH));
  }
  if (options.resourcesPath) {
    candidates.push(
      path.join(options.resourcesPath, 'app.asar.unpacked', HYPERFRAMES_CLI_RELATIVE_PATH),
    );
  }
  candidates.push(path.join(options.appPath, HYPERFRAMES_CLI_RELATIVE_PATH));
  candidates.push(path.join(options.cwd, HYPERFRAMES_CLI_RELATIVE_PATH));
  candidates.push(path.resolve(options.moduleDir, '..', HYPERFRAMES_CLI_RELATIVE_PATH));
  return Array.from(new Set(candidates));
}

export function resolveHyperframesCliPath(
  options: HyperframesCliResolutionOptions,
): string {
  const hit = getHyperframesCliCandidates(options).find((candidate) =>
    options.existsSync(candidate),
  );
  if (!hit) {
    throw new Error('未找到 HyperFrames CLI，请确认 hyperframes 已安装并随应用打包');
  }
  return hit;
}
