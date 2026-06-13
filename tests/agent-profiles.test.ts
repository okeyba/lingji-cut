import { describe, it, expect } from 'vitest';
import { getAgentProfile, listAgentProfiles, DEFAULT_AGENT_ID } from '../electron/acp/agent-profiles';

describe('agent-profiles', () => {
  it('claude-acp 是 managed，含 npm 包名与凭证 env 映射', () => {
    const p = getAgentProfile('claude-acp');
    expect(p.managed).toBe(true);
    expect(p.npmPackage).toBe('@agentclientprotocol/claude-agent-acp');
    expect(p.apiKeyEnvVar).toBe('ANTHROPIC_API_KEY');
  });
  it('pi-acp 是 unmanaged，npx 启动，不注入凭证', () => {
    const p = getAgentProfile('pi-acp');
    expect(p.managed).toBe(false);
    expect(p.unmanagedSpawn).toEqual({ command: 'npx', args: ['-y', 'pi-acp'] });
    expect(p.requiredBinary).toBe('pi');
    expect(p.apiKeyEnvVar).toBeUndefined();
  });
  it('未知 id 回退默认 claude-acp', () => {
    expect(getAgentProfile('nope').id).toBe('claude-acp');
    expect(DEFAULT_AGENT_ID).toBe('claude-acp');
  });
  it('listAgentProfiles 含两个内置 agent', () => {
    expect(listAgentProfiles().map((p) => p.id).sort()).toEqual(['claude-acp', 'pi-acp']);
  });
});
