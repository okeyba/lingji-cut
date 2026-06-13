import type { PreflightCheck } from './types';
import { BinaryManager } from './binary-manager';
import type { AgentConfig } from './config';
import { getAgentProfile } from './agent-profiles';

export async function runPreflight(
  binaryManager: BinaryManager,
  config: AgentConfig,
  agentId: string,
): Promise<PreflightCheck[]> {
  const checks: PreflightCheck[] = [];
  const profile = getAgentProfile(agentId);

  // 1. Node.js
  const nodeVersion = await binaryManager.getNodeVersion();
  if (nodeVersion) {
    checks.push({ label: 'Node.js', status: 'pass', message: nodeVersion });
  } else {
    checks.push({
      label: 'Node.js',
      status: 'fail',
      message: '未安装 Node.js',
      fixAction: 'install',
    });
  }

  // 2. npx
  const npxPath = await binaryManager.findNpxPath();
  if (npxPath) {
    checks.push({ label: 'npx', status: 'pass', message: npxPath });
  } else {
    checks.push({
      label: 'npx',
      status: 'fail',
      message: '未找到 npx',
      fixAction: 'install',
    });
  }

  if (profile.managed) {
    // managed（claude）：npm 托管的 agent 安装状态 + API Key
    const agentLabel = profile.binName || 'claude-agent-acp';

    // 3. Agent 安装状态
    const installedVersion = await binaryManager.getInstalledVersion();
    const latestVersion = await binaryManager.getLatestVersion();

    if (installedVersion) {
      if (latestVersion && installedVersion !== latestVersion) {
        checks.push({
          label: agentLabel,
          status: 'warn',
          message: `已安装 ${installedVersion}，最新 ${latestVersion}`,
          fixAction: 'upgrade',
        });
      } else {
        checks.push({
          label: agentLabel,
          status: 'pass',
          message: `v${installedVersion}`,
        });
      }
    } else {
      checks.push({
        label: agentLabel,
        status: 'fail',
        message: '未安装',
        fixAction: 'install',
      });
    }

    // 4. API Key
    const configData = await config.load();
    const agentEntry = configData.agents[agentId];
    if (agentEntry?.authMode === 'subscription') {
      checks.push({ label: 'API Key', status: 'pass', message: '使用官方订阅' });
    } else {
      const apiKey = await config.getApiKey(agentId);
      if (apiKey) {
        checks.push({ label: 'API Key', status: 'pass', message: '已配置' });
      } else {
        checks.push({
          label: 'API Key',
          status: 'warn',
          message: '未设置 API Key',
        });
      }
    }
  } else {
    // unmanaged（pi）：仅检查 requiredBinary 是否在 PATH，不代管 npm 安装与凭证
    if (profile.requiredBinary) {
      const resolved = await binaryManager.resolveBinary(profile.requiredBinary);
      if (resolved) {
        checks.push({ label: profile.requiredBinary, status: 'pass', message: resolved });
      } else {
        checks.push({
          label: profile.requiredBinary,
          status: 'fail',
          message: profile.installGuide ?? `未找到 ${profile.requiredBinary}，请先安装`,
          fixAction: 'install',
        });
      }
    }
  }

  return checks;
}
