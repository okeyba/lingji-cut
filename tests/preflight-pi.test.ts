import { describe, it, expect } from 'vitest';
import { runPreflight } from '../electron/acp/preflight';

function fakeBM(over: Record<string, unknown> = {}) {
  return {
    getNodeVersion: async () => 'v22.3.0',
    findNpxPath: async () => '/usr/local/bin/npx',
    getInstalledVersion: async () => null,
    getLatestVersion: async () => null,
    resolveBinary: async (n: string) => (n === 'pi' ? '/usr/local/bin/pi' : null),
    ...over,
  } as never;
}
const fakeConfig = {
  load: async () => ({ agents: { 'pi-acp': { authMode: 'subscription' } }, permissionPolicy: 'tiered' }),
  getApiKey: async () => '',
} as never;

describe('runPreflight pi-acp', () => {
  it('pi 在 PATH → pass，且不含 claude-agent-acp 检查项', async () => {
    const checks = await runPreflight(fakeBM(), fakeConfig, 'pi-acp');
    expect(checks.some((c) => c.label === 'pi' && c.status === 'pass')).toBe(true);
    expect(checks.some((c) => c.label === 'claude-agent-acp')).toBe(false);
  });
  it('pi 不在 PATH → fail', async () => {
    const checks = await runPreflight(fakeBM({ resolveBinary: async () => null }), fakeConfig, 'pi-acp');
    const pi = checks.find((c) => c.label === 'pi');
    expect(pi?.status).toBe('fail');
  });
});
