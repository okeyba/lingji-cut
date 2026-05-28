import { describe, expect, it, vi } from 'vitest';
import { runPreflight } from '../electron/acp/preflight';
import type { BinaryManager } from '../electron/acp/binary-manager';
import type { AgentConfig } from '../electron/acp/config';

vi.mock('electron', () => ({
  safeStorage: {
    isEncryptionAvailable: () => true,
    encryptString: (text: string) => Buffer.from(`enc:${text}`),
    decryptString: (buffer: Buffer) => buffer.toString().replace('enc:', ''),
  },
}));

describe('Preflight', () => {
  it('returns checks array with expected labels', async () => {
    const bm = {
      getNodeVersion: vi.fn(async () => 'v22.0.0'),
      findNpxPath: vi.fn(async () => '/usr/local/bin/npx'),
      getInstalledVersion: vi.fn(async () => '1.0.0'),
      getLatestVersion: vi.fn(async () => '1.0.0'),
    } as unknown as BinaryManager;
    const config = {
      load: vi.fn(async () => ({ agents: {} })),
      getApiKey: vi.fn(async () => null),
    } as unknown as AgentConfig;

    const checks = await runPreflight(bm, config, 'claude-acp');

    const labels = checks.map((c) => c.label);
    expect(labels).toContain('Node.js');
    expect(labels).toContain('npx');
    expect(labels).toContain('claude-agent-acp');
    expect(labels).toContain('API Key');

    // 本机应该有 node 和 npx
    const nodeCheck = checks.find((c) => c.label === 'Node.js');
    expect(nodeCheck?.status).toBe('pass');
  });
});
