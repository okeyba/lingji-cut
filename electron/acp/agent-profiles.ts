export interface AgentProfile {
  id: string;
  displayName: string;
  managed: boolean;
  npmPackage?: string;
  binName?: string;
  unmanagedSpawn?: { command: string; args: string[] };
  requiredBinary?: string;
  apiKeyEnvVar?: string;
  baseUrlEnvVar?: string;
  defaultVersion?: string;
  installGuide?: string;
}

export const DEFAULT_AGENT_ID = 'claude-acp';

const PROFILES: Record<string, AgentProfile> = {
  'claude-acp': {
    id: 'claude-acp',
    displayName: 'Claude Code',
    managed: true,
    npmPackage: '@agentclientprotocol/claude-agent-acp',
    binName: 'claude-agent-acp',
    apiKeyEnvVar: 'ANTHROPIC_API_KEY',
    baseUrlEnvVar: 'ANTHROPIC_BASE_URL',
    defaultVersion: '0.25.0',
  },
  'pi-acp': {
    id: 'pi-acp',
    displayName: 'Pi',
    managed: false,
    unmanagedSpawn: { command: 'npx', args: ['-y', 'pi-acp'] },
    requiredBinary: 'pi',
    installGuide:
      'Pi 通过 `npx -y pi-acp` 适配器启动，需先在系统安装 `pi` 命令并配置好模型 provider 凭证（见 https://pi.dev）。本应用不代管 pi 安装与凭证。',
  },
};

export function getAgentProfile(id: string | undefined | null): AgentProfile {
  return (id && PROFILES[id]) || PROFILES[DEFAULT_AGENT_ID];
}

export function listAgentProfiles(): AgentProfile[] {
  return Object.values(PROFILES);
}
