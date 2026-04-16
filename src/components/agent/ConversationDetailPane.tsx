import { useMemo, useCallback } from 'react';
import { ShieldCheck } from 'lucide-react';
import { m, AnimatePresence } from 'framer-motion';
import { springs, durations, easings } from '../../ui/lib/motion';
import { Button, EmptyState } from '../../ui';
import { useConversationDetail } from '../../hooks/use-conversation-detail';
import { useConnectionLifecycle } from '../../hooks/use-connection-lifecycle';
import type { PendingPermission } from '../../types/conversation';
import type { PromptInputBlock } from '../../../electron/acp/types';
import { UserMessage } from './UserMessage';
import { TextBlock } from './TextBlock';
import { ThinkingBlock } from './ThinkingBlock';
import { ErrorBlock } from './ErrorBlock';
import { ToolCallBlock } from './ToolCallBlock';
import { MessageInput } from './MessageInput';

/** 从 ACP 传来的 toolCall 负载里尽力提取可读描述 */
function describeToolCall(toolCall: unknown): { title: string; detail?: string } {
  if (!toolCall || typeof toolCall !== 'object') {
    return { title: '未知工具调用' };
  }
  const tc = toolCall as Record<string, unknown>;
  const title =
    (typeof tc.title === 'string' && tc.title) ||
    (typeof tc.name === 'string' && tc.name) ||
    (typeof tc.toolName === 'string' && tc.toolName) ||
    '待授权工具';
  const rawInput = tc.rawInput ?? tc.input;
  let detail: string | undefined;
  if (typeof rawInput === 'string') {
    detail = rawInput;
  } else if (rawInput && typeof rawInput === 'object') {
    try {
      detail = JSON.stringify(rawInput);
    } catch {
      detail = undefined;
    }
  }
  if (detail && detail.length > 160) {
    detail = `${detail.slice(0, 160)}…`;
  }
  return { title, detail };
}

/** 将 ACP 权限选项 kind 映射到按钮 variant */
function variantForKind(kind: string): 'primary' | 'outline' | 'destructive' | 'ghost' {
  if (kind === 'allow_once' || kind === 'allow_always') return 'primary';
  if (kind === 'reject_always') return 'destructive';
  if (kind === 'reject_once') return 'outline';
  return 'ghost';
}

interface PermissionPromptProps {
  pending: PendingPermission;
  onRespond: (optionId: string) => void;
}

function PermissionPrompt({ pending, onRespond }: PermissionPromptProps) {
  const { title, detail } = describeToolCall(pending.toolCall);
  return (
    <div className="mx-4 mt-2 rounded-[10px] border border-mac-blue/40 bg-mac-blue/10 px-3 py-2.5">
      <div className="flex items-center gap-2 text-[12px] font-semibold text-white">
        <ShieldCheck size={14} className="text-mac-blue" />
        <span>需要你授权工具调用</span>
      </div>
      <div className="mt-1 text-[11px] text-mac-text-muted/80 break-all">
        {title}
      </div>
      {detail ? (
        <div className="mt-1 text-[11px] text-mac-text-muted/50 font-mono break-all">
          {detail}
        </div>
      ) : null}
      <div className="mt-2 flex flex-wrap gap-2">
        {pending.options.length === 0 ? (
          <div className="text-[11px] text-mac-text-muted/60">没有可用的授权选项</div>
        ) : (
          pending.options.map((option) => (
            <Button
              key={option.optionId}
              size="sm"
              variant={variantForKind(option.kind)}
              onClick={() => onRespond(option.optionId)}
            >
              {option.name}
            </Button>
          ))
        )}
      </div>
    </div>
  );
}

interface ConversationDetailPaneProps {
  projectDir: string | null;
  explicitActivated: boolean;
}

function formatConnectionStatus(status: string): string {
  switch (status) {
    case 'disconnected':
      return '未连接';
    case 'connecting':
      return '连接中...';
    case 'connected':
      return '已连接';
    case 'prompting':
      return '思考中...';
    case 'error':
      return '连接失败';
    default:
      return status;
  }
}

export function ConversationDetailPane({
  projectDir,
  explicitActivated,
}: ConversationDetailPaneProps) {
  const { conversationId, detail, runtime, loading, error } = useConversationDetail();
  const connection = useConnectionLifecycle({
    conversationId: conversationId ?? -1,
    projectDir: projectDir ?? undefined,
    sessionId: detail?.externalId ?? null,
    agentType: detail?.agentType,
    isActive: explicitActivated && conversationId !== null,
    autoConnectOnActive: explicitActivated && conversationId !== null,
  });

  const isPrompting = connection.status === 'prompting';
  const turns = runtime?.turns ?? [];
  const usageLabel = useMemo(() => {
    if (!runtime?.usage || runtime.usage.size <= 0) return null;
    const percent = (runtime.usage.used / runtime.usage.size) * 100;
    return `上下文 ${(Math.max(0, Math.min(100, percent))).toFixed(1)}%`;
  }, [runtime?.usage]);

  const ensureConnected = useCallback(async () => {
    if (!conversationId || !projectDir) return;
    if (connection.status === 'connected' || connection.status === 'prompting') return;
    await connection.connect({
      projectDir,
      sessionId: detail?.externalId ?? null,
      agentType: detail?.agentType,
    });
  }, [conversationId, projectDir, connection, detail]);

  const handleSend = useCallback(async (blocks: PromptInputBlock[]) => {
    if (!conversationId || !projectDir) return;
    await ensureConnected();
    await connection.send(blocks);
  }, [conversationId, projectDir, ensureConnected, connection]);

  if (conversationId === null) {
    return (
      <div className="flex-1 flex items-center justify-center px-6">
        <EmptyState
          title="尚未选择会话"
          description="先创建一个会话，或者从左侧选择一个已有会话。"
        />
      </div>
    );
  }

  if (loading && !detail) {
    return (
      <div className="flex-1 flex items-center justify-center text-sm text-mac-text-muted/60">
        正在加载会话详情...
      </div>
    );
  }

  if (error && !detail) {
    return (
      <div className="flex-1 flex items-center justify-center text-sm text-mac-red/70 px-6 text-center">
        会话详情加载失败：{error}
      </div>
    );
  }

  return (
    <div className="flex-1 min-w-0 min-h-0 flex flex-col">
      <div className="px-4 py-3 border-b border-mac-separator shrink-0">
        <div className="text-sm font-semibold text-white truncate">
          {detail?.title ?? `会话 ${conversationId}`}
        </div>
        <div className="mt-1 flex items-center gap-3 text-[11px] text-mac-text-muted/60">
          <span>{formatConnectionStatus(connection.status)}</span>
          {detail?.externalId ? <span>可恢复历史会话</span> : <span>新会话</span>}
          {usageLabel ? <span>{usageLabel}</span> : null}
        </div>
        {!explicitActivated ? (
          <div className="mt-2 text-[11px] text-mac-text-muted/50">
            当前仅展示会话内容。点击左侧会话或发送消息后，才会建立 ACP 连接。
          </div>
        ) : null}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4 flex flex-col gap-3">
        {turns.length === 0 ? (
          <EmptyState
            title="暂无消息"
            description="这个会话还没有消息。可以直接在下方输入，或点击左侧其他会话查看。"
          />
        ) : null}
        <AnimatePresence initial={false}>
        {turns.map((turn) => {
          if (turn.role === 'user') {
            const text = turn.blocks
              .filter((block) => block.type === 'text')
              .map((block) => block.text)
              .join('\n');
            return (
              <m.div
                key={String(turn.id)}
                layout="position"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0, transition: springs.smooth }}
                exit={{
                  opacity: 0,
                  y: -4,
                  transition: { duration: durations.fast, ease: easings.apple },
                }}
              >
                <UserMessage content={text} />
              </m.div>
            );
          }

          return (
            <m.div
              key={String(turn.id)}
              layout="position"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0, transition: springs.smooth }}
              exit={{
                opacity: 0,
                y: -4,
                transition: { duration: durations.fast, ease: easings.apple },
              }}
              className="flex flex-col gap-2 max-w-[95%]"
            >
              {turn.blocks.map((block, index) => {
                switch (block.type) {
                  case 'text':
                    return <TextBlock key={index} text={block.text} />;
                  case 'thinking':
                    return <ThinkingBlock key={index} text={block.text} />;
                  case 'error':
                    return <ErrorBlock key={index} message={block.message} />;
                  case 'tool_call':
                    return (
                      <ToolCallBlock
                        key={index}
                        block={{
                          type: 'tool_call',
                          toolCallId: block.toolCallId,
                          title: block.title,
                          kind: block.kind,
                          status: block.status,
                          rawInput: block.rawInput,
                          rawOutput: block.rawOutput,
                        }}
                      />
                    );
                  default:
                    return null;
                }
              })}
            </m.div>
          );
        })}
        </AnimatePresence>
      </div>

      {connection.pendingPermission ? (
        <PermissionPrompt
          pending={connection.pendingPermission}
          onRespond={(optionId) =>
            void connection.respondPermission(
              connection.pendingPermission!.requestId,
              optionId,
            )
          }
        />
      ) : null}

      <div className="px-3 py-3 border-t border-mac-separator shrink-0 flex flex-col gap-1.5">
        {connection.autoConnectError ? (
          <div className="text-[11px] text-mac-red/70 px-1">
            连接失败：{connection.autoConnectError}
          </div>
        ) : null}
        <MessageInput
          onSend={(blocks) => void handleSend(blocks)}
          onCancel={isPrompting ? () => void connection.cancel() : undefined}
          disabled={conversationId === null || !projectDir}
          isPrompting={isPrompting}
          autoFocus={explicitActivated && conversationId !== null}
          placeholder={
            isPrompting
              ? 'Agent 正在思考中，按 Enter 追加消息…'
              : '输入消息开始对话… 可粘贴或拖拽文件'
          }
          projectDir={projectDir}
          availableCommands={connection.availableCommands}
          configOptions={connection.configOptions}
          onConfigOptionChange={(configId, valueId) =>
            void connection.setConfigOption(configId, valueId)
          }
          availableModes={connection.availableModes}
          currentModeId={connection.currentModeId}
          onModeChange={(modeId) => void connection.setMode(modeId)}
        />
        {!explicitActivated ? (
          <div className="text-[10px] text-mac-text-muted/40 px-1">
            发送消息后自动建立 ACP 连接
          </div>
        ) : null}
      </div>
    </div>
  );
}
