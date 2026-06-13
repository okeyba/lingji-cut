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
  it('returns checks array with expected labels (legacy id normalized to claude)', async () => {
    const bm = {
      getNodeVersion: vi.fn(async () => 'v22.0.0'),
      findNpxPath: vi.fn(async () => '/usr/local/bin/npx'),
      resolveBinary: vi.fn(async (n: string) => (n === 'claude' ? '/usr/local/bin/claude' : null)),
    } as unknown as BinaryManager;
    const config = {
      load: vi.fn(async () => ({ agents: {} })),
      getApiKey: vi.fn(async () => ''),
    } as unknown as AgentConfig;

    // 传旧键，应归一化到 claude，检测项 label 为 def.bin = 'claude'
    const checks = await runPreflight(bm, config, 'claude-acp');

    const labels = checks.map((c) => c.label);
    expect(labels).toContain('Node.js');
    expect(labels).toContain('npx');
    expect(labels).toContain('claude');
    expect(labels).toContain('API Key');

    // 本机应该有 node 和 npx
    const nodeCheck = checks.find((c) => c.label === 'Node.js');
    expect(nodeCheck?.status).toBe('pass');
    // claude CLI 已在 PATH → pass
    const claudeCheck = checks.find((c) => c.label === 'claude');
    expect(claudeCheck?.status).toBe('pass');
  });
});
