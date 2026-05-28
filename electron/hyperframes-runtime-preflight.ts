import { existsSync, readdirSync } from 'node:fs';
import os from 'node:os';
import { resolveHyperframesCliPath } from './hyperframes-cli';
import {
  resolveChromePath,
  resolveFfmpegPath,
  resolveFfprobePath,
  resolveGsapPath,
  type RuntimeBinaryResolutionOptions,
} from './runtime-binaries';

export interface HyperframesRuntimePreflightOptions
  extends RuntimeBinaryResolutionOptions {
  existsSync: (candidate: string) => boolean;
  readdirSync: (candidate: string) => string[];
}

export interface HyperframesRuntimePreflightCheck {
  key: 'hyperframesCli' | 'gsap' | 'ffmpeg' | 'ffprobe' | 'chrome';
  ok: boolean;
  path: string | null;
  source?: string;
  message?: string;
}

export interface HyperframesRuntimePreflightResult {
  ok: boolean;
  checks: HyperframesRuntimePreflightCheck[];
}

function checkPath(
  key: HyperframesRuntimePreflightCheck['key'],
  path: string | null,
  missingMessage: string,
): HyperframesRuntimePreflightCheck {
  return {
    key,
    ok: Boolean(path),
    path,
    message: path ? undefined : missingMessage,
  };
}

export function runHyperframesRuntimePreflight(
  options: HyperframesRuntimePreflightOptions,
): HyperframesRuntimePreflightResult {
  let hyperframesCliPath: string | null = null;
  try {
    hyperframesCliPath = resolveHyperframesCliPath(options);
  } catch {
    hyperframesCliPath = null;
  }

  const gsapPath = resolveGsapPath(options);
  const ffmpegPath = resolveFfmpegPath(options);
  const ffprobePath = resolveFfprobePath(options);
  const chrome = resolveChromePath(options);

  const checks: HyperframesRuntimePreflightCheck[] = [
    checkPath('hyperframesCli', hyperframesCliPath, '未找到 HyperFrames CLI'),
    checkPath('gsap', gsapPath, '未找到本地 GSAP runtime'),
    checkPath('ffmpeg', ffmpegPath, '未找到 FFmpeg 静态二进制'),
    checkPath('ffprobe', ffprobePath, '未找到 FFprobe 静态二进制'),
    {
      key: 'chrome',
      ok: Boolean(chrome),
      path: chrome?.executablePath ?? null,
      source: chrome?.source,
      message: chrome ? undefined : '未找到 Chrome/Chromium 或 chrome-headless-shell',
    },
  ];

  return {
    ok: checks.every((check) => check.ok),
    checks,
  };
}

export function runCurrentHyperframesRuntimePreflight(args: {
  appPath: string;
  resourcesPath: string;
  cwd: string;
  moduleDir: string;
}): HyperframesRuntimePreflightResult {
  return runHyperframesRuntimePreflight({
    ...args,
    platform: process.platform,
    arch: process.arch,
    env: process.env,
    homeDir: os.homedir(),
    existsSync,
    readdirSync,
  });
}
