import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  getHyperframesCliCandidates,
  resolveHyperframesCliPath,
} from '../electron/hyperframes-cli';

describe('hyperframes cli path resolution', () => {
  it('prefers app.asar.unpacked in packaged apps', () => {
    const hitPath = path.join(
      '/app/Contents/Resources/app.asar.unpacked',
      'node_modules',
      'hyperframes',
      'dist',
      'cli.js',
    );
    const resolved = resolveHyperframesCliPath({
      appPath: '/app/Contents/Resources/app.asar',
      resourcesPath: '/app/Contents/Resources',
      cwd: '/workspace',
      moduleDir: '/app/Contents/Resources/app.asar/dist-electron',
      existsSync: (candidate) => candidate === hitPath,
    });

    expect(resolved).toBe(hitPath);
  });

  it('falls back to development node_modules', () => {
    const hitPath = path.join(
      '/workspace',
      'node_modules',
      'hyperframes',
      'dist',
      'cli.js',
    );
    const resolved = resolveHyperframesCliPath({
      appPath: '/workspace',
      resourcesPath: '',
      cwd: '/workspace',
      moduleDir: '/workspace/dist-electron',
      existsSync: (candidate) => candidate === hitPath,
    });

    expect(resolved).toBe(hitPath);
  });

  it('deduplicates candidate paths', () => {
    const candidates = getHyperframesCliCandidates({
      appPath: '/workspace',
      resourcesPath: '',
      cwd: '/workspace',
      moduleDir: '/workspace/dist-electron',
      existsSync: () => false,
    });

    expect(new Set(candidates).size).toBe(candidates.length);
  });
});
