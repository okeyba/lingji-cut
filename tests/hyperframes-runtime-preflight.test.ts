import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { runHyperframesRuntimePreflight } from '../electron/hyperframes-runtime-preflight';

describe('hyperframes runtime preflight', () => {
  it('reports all packaged runtime paths when they are present', () => {
    const root = '/app/Contents/Resources/app.asar.unpacked';
    const paths = new Set([
      path.join(root, 'node_modules', 'hyperframes', 'dist', 'cli.js'),
      path.join(root, 'node_modules', 'gsap', 'dist', 'gsap.min.js'),
      path.join(root, 'node_modules', 'ffmpeg-static', 'ffmpeg'),
      path.join(root, 'node_modules', 'ffprobe-static', 'bin', 'darwin', 'arm64', 'ffprobe'),
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    ]);

    const result = runHyperframesRuntimePreflight({
      appPath: '/app/Contents/Resources/app.asar',
      resourcesPath: '/app/Contents/Resources',
      cwd: '/workspace',
      moduleDir: '/app/Contents/Resources/app.asar/dist-electron',
      platform: 'darwin',
      arch: 'arm64',
      env: {},
      homeDir: '/Users/demo',
      existsSync: (candidate) => paths.has(candidate),
      readdirSync: () => [],
    });

    expect(result.ok).toBe(true);
    expect(Object.fromEntries(result.checks.map((check) => [check.key, check.ok]))).toEqual({
      hyperframesCli: true,
      gsap: true,
      ffmpeg: true,
      ffprobe: true,
      chrome: true,
    });
  });

  it('fails clearly when Chrome is missing', () => {
    const root = '/app/Contents/Resources/app.asar.unpacked';
    const paths = new Set([
      path.join(root, 'node_modules', 'hyperframes', 'dist', 'cli.js'),
      path.join(root, 'node_modules', 'gsap', 'dist', 'gsap.min.js'),
      path.join(root, 'node_modules', 'ffmpeg-static', 'ffmpeg'),
      path.join(root, 'node_modules', 'ffprobe-static', 'bin', 'darwin', 'arm64', 'ffprobe'),
    ]);

    const result = runHyperframesRuntimePreflight({
      appPath: '/app/Contents/Resources/app.asar',
      resourcesPath: '/app/Contents/Resources',
      cwd: '/workspace',
      moduleDir: '/app/Contents/Resources/app.asar/dist-electron',
      platform: 'darwin',
      arch: 'arm64',
      env: {},
      homeDir: '/Users/demo',
      existsSync: (candidate) => paths.has(candidate),
      readdirSync: () => [],
    });

    expect(result.ok).toBe(false);
    expect(result.checks.find((check) => check.key === 'chrome')).toMatchObject({
      ok: false,
      path: null,
      message: '未找到 Chrome/Chromium 或 chrome-headless-shell',
    });
  });

  it('reports staged Windows FFmpeg vendor paths when packaging for Windows', () => {
    const root = 'C:/app/resources/app.asar.unpacked';
    const paths = new Set([
      path.join(root, 'node_modules', 'hyperframes', 'dist', 'cli.js'),
      path.join(root, 'node_modules', 'gsap', 'dist', 'gsap.min.js'),
      path.join(root, 'vendor', 'ffmpeg', 'win32', 'x64', 'ffmpeg.exe'),
      path.join(root, 'node_modules', 'ffprobe-static', 'bin', 'win32', 'x64', 'ffprobe.exe'),
      path.join('C:/Program Files', 'Google', 'Chrome', 'Application', 'chrome.exe'),
    ]);

    const result = runHyperframesRuntimePreflight({
      appPath: 'C:/app/resources/app.asar',
      resourcesPath: 'C:/app/resources',
      cwd: 'C:/workspace',
      moduleDir: 'C:/app/resources/app.asar/dist-electron',
      platform: 'win32',
      arch: 'x64',
      env: { PROGRAMFILES: 'C:/Program Files' },
      homeDir: 'C:/Users/demo',
      existsSync: (candidate) => paths.has(candidate),
      readdirSync: () => [],
    });

    expect(result.ok).toBe(true);
    expect(result.checks.find((check) => check.key === 'ffmpeg')?.path).toBe(
      path.join(root, 'vendor', 'ffmpeg', 'win32', 'x64', 'ffmpeg.exe'),
    );
  });
});
