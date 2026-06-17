// @vitest-environment jsdom
//
// AgentSettingsTab Skills section 最小渲染测试：
// - 内置 skill 名称与加载方式（中文标签）展示。
// - 切换开关翻转 aria-checked，并把 enabled 写回 config.agents[agentId].skills
//   （由「保存配置」落盘，saveConfig 入参断言）。
//
// 项目未引入 @testing-library/react / jsdom 自动注入，沿用既有
// tests/agent-settings-active.test.tsx 的 createRoot + act 手动渲染约定。
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { ResolvedAgentSkill } from '../electron/acp/types';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// 补 ui 库依赖链可能引用的 window.matchMedia（jsdom 默认不实现）。
if (typeof window !== 'undefined' && typeof window.matchMedia !== 'function') {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as typeof window.matchMedia;
}

const skill: ResolvedAgentSkill = {
  id: 'lingji-video-workflow',
  displayName: '灵机剪影视频工作流',
  description: '工作流说明',
  source: 'builtin',
  rootPath: '/Users/u/.lingji/agent-skills/lingji-video-workflow',
  skillFilePath: '/Users/u/.lingji/agent-skills/lingji-video-workflow/SKILL.md',
  defaultEnabled: true,
  loadModesByAgent: { claude: ['context_file', 'prompt_injection'] },
  enabled: true,
  status: 'available',
};

const getConfig = vi.fn();
const getApiKey = vi.fn(async () => '');
const runPreflight = vi.fn(async () => [] as unknown[]);
const listSkills = vi.fn(async () => [skill]);
const saveConfig = vi.fn(async () => undefined);
const setApiKey = vi.fn(async () => undefined);

function baseConfig() {
  return {
    permissionPolicy: 'tiered',
    activeAgentId: 'claude',
    agents: {
      claude: {
        enabled: true,
        authMode: 'custom_api',
        apiKey: '',
        apiBaseUrl: '',
        model: '',
        envText: '',
        configJson: '{}',
        version: '',
        sortOrder: 0,
        skills: [{ id: 'lingji-video-workflow', enabled: true }],
      },
    },
  };
}

beforeEach(() => {
  getConfig.mockResolvedValue(baseConfig());
  listSkills.mockClear();
  saveConfig.mockClear();
  (window as unknown as { agentAPI: unknown }).agentAPI = {
    getConfig,
    getApiKey,
    runPreflight,
    listSkills,
    saveConfig,
    setApiKey,
  };
});

afterEach(() => {
  delete (window as unknown as { agentAPI?: unknown }).agentAPI;
});

async function mount() {
  const { AgentSettingsTab } = await import('../src/components/settings/AgentSettingsTab');
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(<AgentSettingsTab />);
  });
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
  return { container, root };
}

function clickByText(container: HTMLElement, text: string) {
  const el = Array.from(container.querySelectorAll('button')).find((b) =>
    (b.textContent ?? '').includes(text),
  );
  if (!el) throw new Error(`button not found: ${text}`);
  el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
}

describe('AgentSettingsTab Skills section', () => {
  it('展示内置 skill 名称与加载方式', async () => {
    const { container, root } = await mount();

    expect(listSkills).toHaveBeenCalled();
    const text = container.textContent ?? '';
    expect(text).toContain('灵机剪影视频工作流');
    // 加载方式含「上下文文件引导」与「$ 显式注入」（中文标签 map）
    expect(text).toContain('上下文文件引导');
    expect(text).toContain('显式注入');

    act(() => root.unmount());
    container.remove();
  });

  it('切换开关翻转 aria-checked 并写回 config.skills', async () => {
    const { container, root } = await mount();

    const toggle = container.querySelector('[role="switch"]') as HTMLButtonElement | null;
    expect(toggle).not.toBeNull();
    expect(toggle!.getAttribute('aria-checked')).toBe('true');
    expect(toggle!.getAttribute('aria-label')).toBe('灵机剪影视频工作流');

    await act(async () => {
      toggle!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
    });

    const toggleAfter = container.querySelector('[role="switch"]') as HTMLButtonElement;
    expect(toggleAfter.getAttribute('aria-checked')).toBe('false');

    // 由「保存配置」落盘：saveConfig 入参的 skills enabled=false
    await act(async () => {
      clickByText(container, '保存配置');
      await Promise.resolve();
    });
    const arg = saveConfig.mock.calls.at(-1)![0] as {
      agents: Record<string, { skills?: { id: string; enabled: boolean }[] }>;
    };
    expect(arg.agents.claude.skills).toContainEqual({
      id: 'lingji-video-workflow',
      enabled: false,
    });

    act(() => root.unmount());
    container.remove();
  });
});
