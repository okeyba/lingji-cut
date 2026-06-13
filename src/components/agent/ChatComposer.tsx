/**
 * ChatComposer — 对话输入薄封装。
 *
 * 复用现有 `MessageInput` 的全部能力（文本输入、斜杠命令、@ 文件提及、
 * 附件/图片、模式/配置选择器、取消、发送），不做重写。
 *
 * 唯一新增能力：在「新建会话尚未绑定 agent」场景下，于输入框上方渲染
 * `<AgentPicker/>`，让用户显式选择 Claude / Codex / Pi。
 *
 * 设计取舍：保持对外接口与 MessageInput 完全兼容（透传所有 props），
 * 仅扩展三个与 agent 选择相关的新 prop。被 B8 ChatPane 使用；现有
 * ConversationDetailPane 继续直接使用 MessageInput，互不影响。
 */

import React from 'react';
import { MessageInput, type MessageInputProps } from './MessageInput';
import { AgentPicker } from './AgentPicker';

export interface ChatComposerProps extends MessageInputProps {
  /** 是否在输入框上方显示 agent 选择器（仅新建会话/未绑定 agent 时为 true）。 */
  showAgentPicker?: boolean;
  /** 当前选中的 agent id，透传给 AgentPicker。 */
  selectedAgentId?: string;
  /** agent 选择变更回调。 */
  onAgentChange?: (agentId: string) => void;
}

export function ChatComposer({
  showAgentPicker = false,
  selectedAgentId,
  onAgentChange,
  ...messageInputProps
}: ChatComposerProps): React.ReactElement {
  return (
    <div className="chat-composer flex flex-col gap-2">
      {showAgentPicker && (
        <div className="chat-composer__agent-picker">
          <AgentPicker
            value={selectedAgentId ?? ''}
            onChange={(id) => onAgentChange?.(id)}
          />
        </div>
      )}
      <MessageInput {...messageInputProps} />
    </div>
  );
}
