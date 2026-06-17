import { useState, useEffect, useCallback } from 'react';
import { Bot, RefreshCw, Trash2 } from 'lucide-react';
import type {
  AgentConfigData,
  AgentEntry,
  AgentSkillLoadMode,
  PreflightCheck,
  ResolvedAgentSkill,
} from '../../../electron/acp/types';
import {
  getAgentPresentation,
  listAgentPresentations,
  DEFAULT_AGENT_ID,
} from '../../lib/agent-presentation';
import {
  Badge,
  Button,
  ConfirmDialog,
  Divider,
  Field,
  PillGroup,
  SaveButton,
  Select,
  SettingsPageHeader,
  Textarea,
} from '../../ui';
import type { SelectOption } from '../../ui';
import type { PillGroupItem } from '../../ui/patterns/PillGroup';
import styles from './AgentSettingsTab.module.css';

const AGENT_PRESENTATIONS = listAgentPresentations();

const AGENT_ITEMS: PillGroupItem<string>[] = AGENT_PRESENTATIONS.map((presentation) => ({
  value: presentation.id,
  label: presentation.displayName,
}));

function makeDefaultEntry(agentId: string): AgentEntry {
  const profile = getAgentPresentation(agentId);
  return {
    enabled: profile.id === DEFAULT_AGENT_ID,
    authMode: 'custom_api',
    apiKey: '',
    apiBaseUrl: 'https://api.anthropic.com',
    model: 'claude-sonnet-4-20250514',
    envText: '',
    configJson: '{}',
    version: profile.defaultVersion ?? '0.25.0',
    sortOrder: 0,
    skills: [{ id: 'lingji-video-workflow', enabled: true }],
  };
}

export function AgentSettingsTab() {
  const [config, setConfig] = useState<AgentConfigData | null>(null);
  const [selectedAgentId, setSelectedAgentId] = useState<string>(DEFAULT_AGENT_ID);
  const [apiKey, setApiKey] = useState('');
  const [checks, setChecks] = useState<PreflightCheck[]>([]);
  const [checking, setChecking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [uninstallDialogOpen, setUninstallDialogOpen] = useState(false);
  const [skills, setSkills] = useState<ResolvedAgentSkill[]>([]);

  const profile = getAgentPresentation(selectedAgentId);
  const agent = config?.agents?.[selectedAgentId] ?? makeDefaultEntry(selectedAgentId);

  // 全局当前激活 agent（单选）；缺省回退默认。
  const activeAgentId = config?.activeAgentId ?? DEFAULT_AGENT_ID;
  const isSelectedActive = selectedAgentId === activeAgentId;
  const activeProfile = getAgentPresentation(activeAgentId);

  // Model 下拉选项：来自当前所选 agent 的展示模型列表。
  const modelOptions: SelectOption[] = (profile.models ?? []).map((m) => ({
    value: m.id,
    label: m.label,
  }));
  // 写回值缺省取 presentation.defaultModel；空列表时仍提供默认占位，保证下拉非空。
  const modelValue = agent.model || profile.defaultModel || modelOptions[0]?.value || '';
  if (modelValue && !modelOptions.some((o) => o.value === modelValue)) {
    modelOptions.unshift({ value: modelValue, label: modelValue });
  }

  const loadSkills = useCallback(async (agentId: string) => {
    if (typeof window.agentAPI?.listSkills !== 'function') return;
    try {
      setSkills(await window.agentAPI.listSkills(agentId));
    } catch {
      setSkills([]);
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.agentAPI === 'undefined') return;
    void loadConfig(DEFAULT_AGENT_ID);
    void runChecks(DEFAULT_AGENT_ID);
    void loadSkills(DEFAULT_AGENT_ID);
  }, []);

  const loadConfig = async (agentId: string) => {
    if (typeof window.agentAPI === 'undefined') return;
    const data = await window.agentAPI.getConfig();
    setConfig(data);
    const key = await window.agentAPI.getApiKey(agentId);
    setApiKey(key);
  };

  const runChecks = async (agentId: string) => {
    if (typeof window.agentAPI === 'undefined') return;
    setChecking(true);
    const results = await window.agentAPI.runPreflight(agentId);
    setChecks(results);
    setChecking(false);
  };

  const handleSelectAgent = useCallback(
    (agentId: string) => {
      setSelectedAgentId(agentId);
      if (typeof window.agentAPI === 'undefined') return;
      void window.agentAPI.getApiKey(agentId).then(setApiKey);
      void runChecks(agentId);
      void loadSkills(agentId);
    },
    [loadSkills],
  );

  const updateAgent = useCallback(
    (patch: Partial<AgentEntry>) => {
      if (!config) return;
      setConfig({
        ...config,
        agents: {
          ...config.agents,
          [selectedAgentId]: { ...agent, ...patch },
        },
      });
    },
    [agent, config, selectedAgentId],
  );

  // 切换内置 skill 启用态：写回 config.agents[agentId].skills（按 id merge/replace），
  // 由现有「保存配置」按钮落盘。Task 7 已为默认条目补齐 skills，旧数据兜底默认启用。
  const toggleSkill = useCallback(
    (skillId: string, enabled: boolean) => {
      if (!config) return;
      const current = agent.skills ?? [{ id: skillId, enabled: true }];
      const has = current.some((s) => s.id === skillId);
      const nextSkills = has
        ? current.map((s) => (s.id === skillId ? { ...s, enabled } : s))
        : [...current, { id: skillId, enabled }];
      updateAgent({ skills: nextSkills });
    },
    [agent.skills, config, updateAgent],
  );

  // 将当前所选 agent 设为全局激活（单选）。立即落盘，避免用户漏点「保存配置」
  // 导致新建会话仍用旧的默认 agent（与权限策略的即时保存语义一致）。
  const handleSetActive = useCallback(() => {
    if (!config) return;
    setConfig({ ...config, activeAgentId: selectedAgentId });
    void window.agentAPI?.setActiveAgent?.(selectedAgentId);
  }, [config, selectedAgentId]);

  const handleSave = async () => {
    if (!config) return;
    setSaving(true);
    await window.agentAPI.saveConfig(config);
    // 仅托管型 agent（含 apiKeyEnvVar）才注入 API Key；pi 等无凭证代管。
    if (profile.apiKeyEnvVar && apiKey) {
      await window.agentAPI.setApiKey(selectedAgentId, apiKey);
    }
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleInstall = async () => {
    setBusyAction('install');
    await window.agentAPI.installAgent(agent.version);
    setBusyAction(null);
    await runChecks(selectedAgentId);
  };

  const handleUninstall = async () => {
    setBusyAction('uninstall');
    await window.agentAPI.uninstallAgent();
    setBusyAction(null);
    await runChecks(selectedAgentId);
  };

  if (!config) {
    return <div className={styles.loading}>加载中...</div>;
  }

  // pi 等非托管 agent 忽略 install fixAction（无 npm 托管），仅 managed 显示安装/升级动作。
  const allowInstallAction = profile.managed;

  return (
    <div className={styles.container}>
      <SettingsPageHeader
        title="AI Agent"
        description="ACP 适配器配置"
        leading={<Bot size={24} className={styles.agentIcon} />}
        actions={
          <Badge variant="secondary">当前使用：{activeProfile.displayName}</Badge>
        }
      />

      <div className={styles.agentSelectRow}>
        <PillGroup<string>
          items={AGENT_ITEMS}
          value={selectedAgentId}
          size="sm"
          onChange={handleSelectAgent}
        />
        {isSelectedActive ? (
          <Badge variant="success">已激活</Badge>
        ) : (
          <Button type="button" size="sm" variant="secondary" onClick={handleSetActive}>
            设为当前
          </Button>
        )}
      </div>
      <p className={styles.guideText}>全局只使用一个 agent，新建会话将使用「当前使用」的 agent。</p>

      <section>
        <div className={styles.statusHeader}>
          <h3 className={styles.sectionTitle}>状态检查</h3>
          <Button.Icon
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => runChecks(selectedAgentId)}
            disabled={checking}
            aria-label="刷新状态检查"
          >
            <RefreshCw size={14} className={checking ? styles.spinning : ''} />
          </Button.Icon>
        </div>

        <div className={styles.statusList}>
          {checks.map((check, index) => (
            <div key={`${check.label}-${index}`} className={styles.statusRow}>
              <Badge variant={getStatusVariant(check.status)}>{getStatusLabel(check.status)}</Badge>
              <span className={styles.statusLabel}>{check.label}</span>
              <span className={styles.statusMessage}>{check.message}</span>
              {allowInstallAction ? renderFixAction(check, busyAction, handleInstall) : null}
            </div>
          ))}
        </div>
      </section>

      {profile.managed ? (
        <>
          <Divider label="模型" />
          <Field label="Model">
            <Select
              options={modelOptions}
              value={modelValue}
              placeholder="选择模型"
              onChange={(e) => updateAgent({ model: e.target.value })}
            />
          </Field>
        </>
      ) : (
        <>
          <Divider label="安装与凭证" />
          {profile.installGuide ? (
            <p className={styles.guideText}>{profile.installGuide}</p>
          ) : null}
          <p className={styles.guideText}>
            {profile.displayName} 的模型 provider 凭证在 {profile.requiredBinary ?? 'agent'} 侧配置，本应用不代管。
          </p>
        </>
      )}

      <Divider label="Skills" />
      {skills.length === 0 ? (
        <p className={styles.guideText}>暂无可用内置 skill（种子缺失或复制失败）。</p>
      ) : (
        skills.map((skill) => {
          const cfgEnabled =
            agent.skills?.find((s) => s.id === skill.id)?.enabled ?? skill.enabled;
          const modes = skill.loadModesByAgent[selectedAgentId] ?? [];
          return (
            <Field key={skill.id} label={skill.displayName}>
              <div className={styles.skillRow}>
                <div className={styles.skillMeta}>
                  <span className={styles.skillDesc}>{skill.description}</span>
                  <span className={styles.skillModes}>加载方式：{formatLoadModes(modes)}</span>
                  <span className={styles.skillPath}>{skill.rootPath}</span>
                  <span className={styles.skillStatus}>
                    {skill.status === 'available'
                      ? '可用'
                      : skill.status === 'missing'
                        ? '缺失'
                        : '配置错误'}
                  </span>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={cfgEnabled}
                  aria-label={skill.displayName}
                  className={cfgEnabled ? styles.switchOn : styles.switchOff}
                  onClick={() => toggleSkill(skill.id, !cfgEnabled)}
                >
                  {cfgEnabled ? '启用' : '关闭'}
                </button>
              </div>
            </Field>
          );
        })
      )}

      <Divider label="高级配置" />
      <Field label="环境变量" hint="KEY=VALUE（每行一条）">
        <Textarea
          value={agent.envText}
          onChange={(e) => updateAgent({ envText: e.target.value })}
          placeholder="KEY=VALUE（每行一条）"
          rows={4}
          size="sm"
          resize="vertical"
          className={styles.editorMono}
        />
      </Field>

      <div className={styles.actionsRow}>
        {profile.managed ? (
          <Button
            type="button"
            variant="destructive"
            leftIcon={<Trash2 size={14} />}
            onClick={() => setUninstallDialogOpen(true)}
            disabled={busyAction !== null}
          >
            {busyAction === 'uninstall' ? '卸载中...' : '卸载'}
          </Button>
        ) : null}
        <div className={styles.actionsSpacer} />
        <SaveButton
          onClick={handleSave}
          saving={saving}
          saved={saved}
          disabled={busyAction !== null}
          defaultLabel="保存配置"
        />
      </div>

      <ConfirmDialog
        open={uninstallDialogOpen}
        onOpenChange={setUninstallDialogOpen}
        title="确认卸载 claude-agent-acp？"
        description="卸载后将移除当前 ACP 适配器，可稍后重新安装。"
        confirmText="确认卸载"
        confirmVariant="destructive"
        onConfirm={handleUninstall}
      />
    </div>
  );
}

const LOAD_MODE_LABELS: Record<AgentSkillLoadMode, string> = {
  native: '原生加载',
  directory_access: '目录访问',
  context_file: '上下文文件引导',
  prompt_injection: '$ 显式注入',
};

function formatLoadModes(modes: AgentSkillLoadMode[]): string {
  if (modes.length === 0) return '—';
  return modes.map((m) => LOAD_MODE_LABELS[m]).join(' + ');
}

function getStatusVariant(status: string): 'success' | 'warning' | 'destructive' | 'secondary' {
  switch (status) {
    case 'pass':
      return 'success';
    case 'fail':
      return 'destructive';
    case 'warn':
      return 'warning';
    default:
      return 'secondary';
  }
}

function getStatusLabel(status: string): string {
  switch (status) {
    case 'pass':
      return '通过';
    case 'fail':
      return '失败';
    case 'warn':
      return '警告';
    default:
      return '检查中';
  }
}

function renderFixAction(
  check: PreflightCheck,
  busyAction: string | null,
  onInstall: () => Promise<void>,
) {
  if (check.fixAction !== 'install' && check.fixAction !== 'upgrade') {
    return null;
  }

  const isBusy = busyAction !== null;
  const variant = check.fixAction === 'upgrade' ? 'warning' : 'primary';
  const label = isBusy ? '处理中...' : check.fixAction === 'upgrade' ? '升级' : '安装';

  return (
    <Button type="button" size="sm" variant={variant} disabled={isBusy} onClick={onInstall}>
      {label}
    </Button>
  );
}
