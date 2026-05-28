import { describe, expect, it } from 'vitest';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const {
  buildWindowsPackagerOptions,
  createIcoFromPng,
  normalizePackageArch,
  resolvePackageArch,
  windowsFfmpegPackages,
} = require('../scripts/package-windows.cjs');

describe('package windows helpers', () => {
  it('normalizes Node architectures to Electron packager architectures', () => {
    expect(normalizePackageArch('x64')).toBe('x64');
    expect(normalizePackageArch('ia32')).toBe('ia32');
    expect(normalizePackageArch('arm64')).toBeNull();
    expect(normalizePackageArch('x86')).toBeNull();
  });

  it('defaults cross-platform Windows packages to x64 on non-Windows hosts', () => {
    expect(resolvePackageArch({ hostPlatform: 'darwin', hostArch: 'arm64' })).toBe('x64');
    expect(resolvePackageArch({ hostPlatform: 'linux', hostArch: 'arm64' })).toBe('x64');
    expect(resolvePackageArch({ hostPlatform: 'win32', hostArch: 'ia32' })).toBe('ia32');
    expect(resolvePackageArch({ requestedArch: 'ia32', hostPlatform: 'darwin', hostArch: 'arm64' })).toBe(
      'ia32',
    );
  });

  it('pins Windows FFmpeg vendor packages for supported architectures', () => {
    expect(windowsFfmpegPackages.x64).toMatchObject({
      name: '@ffmpeg-installer/win32-x64',
      version: '4.1.0',
    });
    expect(windowsFfmpegPackages.ia32).toMatchObject({
      name: '@ffmpeg-installer/win32-ia32',
      version: '4.1.0',
    });
    expect(windowsFfmpegPackages.arm64).toBeUndefined();
  });

  it('builds win32 packager options with Windows icon and asar unpack rules', () => {
    const options = buildWindowsPackagerOptions({
      appName: 'Lingji',
      arch: 'x64',
      iconPath: 'F:/repo/build/icon.ico',
      releaseDir: 'F:/repo/release',
      stageDir: 'F:/repo/.tmp/package-stage/win32-x64',
      existsSync: () => true,
    });

    expect(options.platform).toBe('win32');
    expect(options.arch).toBe('x64');
    expect(options.name).toBe('Lingji');
    expect(options.icon).toBe('F:/repo/build/icon.ico');
    expect(options.asar).toEqual({
      unpackDir: '{vendor/ffmpeg,node_modules/hyperframes,node_modules/@hyperframes,node_modules/@puppeteer,node_modules/puppeteer-core,node_modules/sharp,node_modules/onnxruntime-node,node_modules/gsap,node_modules/ffmpeg-static,node_modules/ffprobe-static}',
    });
  });

  it('wraps a PNG buffer in a valid single-image ICO container', () => {
    const pngBuffer = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
      0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
      0x00, 0x00, 0x02, 0x00, 0x00, 0x00, 0x02, 0x00,
    ]);

    const icoBuffer = createIcoFromPng(pngBuffer);

    expect(icoBuffer.readUInt16LE(0)).toBe(0);
    expect(icoBuffer.readUInt16LE(2)).toBe(1);
    expect(icoBuffer.readUInt16LE(4)).toBe(1);
    expect(icoBuffer[6]).toBe(0);
    expect(icoBuffer[7]).toBe(0);
    expect(icoBuffer.readUInt32LE(14)).toBe(pngBuffer.length);
    expect(icoBuffer.readUInt32LE(18)).toBe(22);
    expect(icoBuffer.subarray(22)).toEqual(pngBuffer);
  });
});
