// @vitest-environment jsdom
//
// ConversationToolbar 测试：展开态渲染 AgentPicker（三家）、选 codex 触发 onSelectAgent、
// 折叠态省略 AgentPicker、新建按钮触发 onCreateConversation。
// 交互用 jsdom + createRoot + act；AgentPicker 可用性通过 mock window.agentAPI.runPreflight 注入。
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { ConversationToolbar } from '../src/components/agent/ConversationToolbar';

// 让 React 在 jsdom 下识别 act() 边界。
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const runPreflight = vi.fn();

beforeEach(() => {
  runPreflight.mockReset();
  // 默认：全部 agent 可用（pass）。
  runPreflight.mockResolvedValue([{ label: 'CLI', status: 'pass', message: 'ok' }]);
  (window as unknown as { agentAPI: { runPreflight: typeof runPreflight } }).agentAPI = {
    runPreflight,
  };
});

afterEach(() => {
  delete (window as unknown as { agentAPI?: unknown }).agentAPI;
});

interface ToolbarProps {
  collapsed?: boolean;
  selectedAgentId?: string;
  onSelectAgent?: (id: string) => void;
  onCreateConversation?: () => void;
  onRefresh?: () => void;
  onToggleCollapse?: () => void;
}

async function mount(props: ToolbarProps) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(
      <ConversationToolbar
        collapsed={props.collapsed}
        selectedAgentId={props.selectedAgentId}
        onSelectAgent={props.onSelectAgent}
        onCreateConversation={props.onCreateConversation ?? (() => undefined)}
        onRefresh={props.onRefresh ?? (() => undefined)}
        onToggleCollapse={props.onToggleCollapse ?? (() => undefined)}
      />,
    );
  });
  // 等待 AgentPicker 挂载时的 preflight Promise 解析。
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
  return { container, root };
}

describe('ConversationToolbar', () => {
  it('renders the AgentPicker with all three agents when expanded', async () => {
    const { container, root } = await mount({
      collapsed: false,
      selectedAgentId: 'claude',
      onSelectAgent: () => undefined,
    });

    expect(container.querySelector('[data-agent-id="claude"]')).not.toBeNull();
    expect(container.querySelector('[data-agent-id="codex"]')).not.toBeNull();
    expect(container.querySelector('[data-agent-id="pi"]')).not.toBeNull();

    act(() => root.unmount());
    container.remove();
  });

  it('calls onSelectAgent with codex when the codex pill is clicked', async () => {
    const onSelectAgent = vi.fn();
    const { container, root } = await mount({
      collapsed: false,
      selectedAgentId: 'claude',
      onSelectAgent,
    });

    const codexButton = container
      .querySelector('[data-agent-id="codex"]')!
      .closest('button')!;
    act(() => {
      codexButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(onSelectAgent).toHaveBeenCalledWith('codex');

    act(() => root.unmount());
    container.remove();
  });

  it('reflects the selected agent via aria-pressed', async () => {
    const { container, root } = await mount({
      collapsed: false,
      selectedAgentId: 'codex',
      onSelectAgent: () => undefined,
    });

    const codexButton = container.querySelector('[data-agent-id="codex"]')!.closest('button')!;
    const claudeButton = container.querySelector('[data-agent-id="claude"]')!.closest('button')!;
    expect(codexButton.getAttribute('aria-pressed')).toBe('true');
    expect(claudeButton.getAttribute('aria-pressed')).toBe('false');

    act(() => root.unmount());
    container.remove();
  });

  it('omits the AgentPicker when collapsed', async () => {
    const { container, root } = await mount({
      collapsed: true,
      selectedAgentId: 'claude',
      onSelectAgent: () => undefined,
    });

    expect(container.querySelector('[data-agent-id="claude"]')).toBeNull();
    // 折叠态仍提供新建按钮。
    expect(container.querySelector('[aria-label="新建会话"]')).not.toBeNull();

    act(() => root.unmount());
    container.remove();
  });

  it('triggers onCreateConversation from the create button', async () => {
    const onCreateConversation = vi.fn();
    const { container, root } = await mount({
      collapsed: false,
      selectedAgentId: 'claude',
      onSelectAgent: () => undefined,
      onCreateConversation,
    });

    const createButton = Array.from(container.querySelectorAll('button')).find((b) =>
      (b.textContent ?? '').includes('新建会话'),
    )!;
    act(() => {
      createButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(onCreateConversation).toHaveBeenCalledTimes(1);

    act(() => root.unmount());
    container.remove();
  });
});
