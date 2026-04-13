import { useCallback, useRef, useState } from 'react';
import { ArrowLeft, Bot, Cpu, FileText, MessageSquare, Server, Volume2 } from 'lucide-react';
import { AIConfigTab } from '../components/settings/AIConfigTab';
import { TemplateManagerTab } from '../components/settings/TemplateManagerTab';
import { ReviewCriteriaTab } from '../components/settings/ReviewCriteriaTab';
import { TTSConfigTab } from '../components/settings/TTSConfigTab';
import { AgentSettingsTab } from '../components/settings/AgentSettingsTab';
import { McpSettingsTab } from '../components/settings/McpSettingsTab';
import { Button } from '../ui';
import styles from './Settings.module.css';
import type { SettingsLeaveGuard } from '../components/settings/useSettingsTabGuard';

type SettingsTab = 'ai-config' | 'templates' | 'review' | 'tts' | 'agent' | 'mcp';

const TABS: { id: SettingsTab; label: string; icon: typeof Bot }[] = [
  { id: 'ai-config', label: 'AI 基础配置', icon: Bot },
  { id: 'templates', label: '口播模板管理', icon: FileText },
  { id: 'review', label: '审查规范配置', icon: MessageSquare },
  { id: 'tts', label: 'TTS 语音合成', icon: Volume2 },
  { id: 'agent', label: 'AI Agent', icon: Cpu },
  { id: 'mcp', label: 'MCP 服务', icon: Server },
];

interface SettingsProps {
  onBack: () => void;
}

export function Settings({ onBack }: SettingsProps) {
  const [activeTab, setActiveTab] = useState<SettingsTab>('ai-config');
  const tabLeaveGuardRef = useRef<SettingsLeaveGuard | null>(null);

  const handleProtectedLeave = useCallback(
    async (action: () => void) => {
      if (tabLeaveGuardRef.current) {
        const canLeave = await tabLeaveGuardRef.current();
        if (!canLeave) {
          return;
        }
      }

      action();
    },
    [],
  );

  const renderTab = () => {
    switch (activeTab) {
      case 'ai-config':
        return (
          <AIConfigTab
            onRegisterLeaveGuard={(guard) => {
              tabLeaveGuardRef.current = guard;
            }}
          />
        );
      case 'templates': return <TemplateManagerTab />;
      case 'review':
        return (
          <ReviewCriteriaTab
            onRegisterLeaveGuard={(guard) => {
              tabLeaveGuardRef.current = guard;
            }}
          />
        );
      case 'tts':
        return (
          <TTSConfigTab
            onRegisterLeaveGuard={(guard) => {
              tabLeaveGuardRef.current = guard;
            }}
          />
        );
      case 'agent': return <AgentSettingsTab />;
      case 'mcp': return <McpSettingsTab />;
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.sidebar}>
        <div className={styles.sidebarHeader}>
          <Button.Icon
            type="button"
            onClick={() => {
              void handleProtectedLeave(onBack);
            }}
            variant="ghost"
            size="sm"
            className={styles.backButton}
            aria-label="返回上一级"
          >
            <ArrowLeft size={18} />
          </Button.Icon>
          <span className={styles.sidebarTitle}>系统设置</span>
        </div>
        {TABS.map((tab) => {
          const Icon = tab.icon;
          return (
            <Button
              key={tab.id}
              type="button"
              onClick={() => {
                if (tab.id === activeTab) {
                  return;
                }
                void handleProtectedLeave(() => setActiveTab(tab.id));
              }}
              variant={activeTab === tab.id ? 'accent' : 'ghost'}
              size="sm"
              className={`${styles.tabButton} ${activeTab === tab.id ? styles.tabButtonActive : ''}`}
            >
              <Icon size={16} />
              {tab.label}
            </Button>
          );
        })}
      </div>

      <div className={styles.content}>
        {renderTab()}
      </div>
    </div>
  );
}
