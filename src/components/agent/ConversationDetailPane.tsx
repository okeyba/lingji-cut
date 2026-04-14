import { useMemo, useState } from 'react';
import { Send, Square } from 'lucide-react';
import { m, AnimatePresence } from 'framer-motion';
import { springs, durations, easings } from '../../ui/lib/motion';
import { Button, EmptyState } from '../../ui';
import { useConversationDetail } from '../../hooks/use-conversation-detail';
import { useConnectionLifecycle } from '../../hooks/use-connection-lifecycle';
import { UserMessage } from './UserMessage';
import { TextBlock } from './TextBlock';
import { ThinkingBlock } from './ThinkingBlock';
import { ErrorBlock } from './ErrorBlock';
import { ToolCallBlock } from './ToolCallBlock';

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
  const [draft, setDraft] = useState('');
  const { conversationId, detail, runtime, loading, error } = useConversationDetail();
  const connection = useConnectionLifecycle({
    conversationId: conversationId ?? -1,
    projectDir: projectDir ?? undefined,
    sessionId: detail?.externalId ?? null,
    agentType: detail?.agentType,
    isActive: explicitActivated && conversationId !== null,
    autoConnectOnActive: explicitActivated && conversationId !== null,
  });

  const canSend = Boolean(draft.trim()) && conversationId !== null && projectDir;
  const isPrompting = connection.status === 'prompting';
  const turns = runtime?.turns ?? [];
  const usageLabel = useMemo(() => {
    if (!runtime?.usage || runtime.usage.size <= 0) return null;
    const percent = (runtime.usage.used / runtime.usage.size) * 100;
    return `上下文 ${(Math.max(0, Math.min(100, percent))).toFixed(1)}%`;
  }, [runtime?.usage]);

  async function ensureConnected() {
    if (!conversationId || !projectDir) return;
    if (connection.status === 'connected' || connection.status === 'prompting') return;
    await connection.connect({
      projectDir,
      sessionId: detail?.externalId ?? null,
      agentType: detail?.agentType,
    });
  }

  async function handleSend() {
    if (!canSend || !conversationId) return;
    const text = draft.trim();
    if (!text) return;
    await ensureConnected();
    await connection.send([{ type: 'text', text }]);
    setDraft('');
  }

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

      <div className="px-4 py-3 border-t border-mac-separator shrink-0 flex flex-col gap-2">
        {connection.autoConnectError ? (
          <div className="text-[11px] text-mac-red/70">
            连接失败：{connection.autoConnectError}
          </div>
        ) : null}
        <textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          rows={3}
          placeholder="输入消息，显式进入当前会话并开始对话..."
          className="w-full resize-none bg-mac-elevated text-foreground border border-mac-border rounded-[10px] px-3 py-2.5 text-[13px] leading-normal outline-none focus:border-mac-blue/50 transition-colors"
        />
        <div className="flex items-center justify-between gap-2">
          <div className="text-[11px] text-mac-text-muted/50">
            只有在你显式进入会话后，才会恢复旧 ACP 会话。
          </div>
          <div className="flex items-center gap-2">
            {isPrompting ? (
              <Button variant="outline" size="sm" onClick={() => void connection.cancel()}>
                <Square size={14} />
                停止
              </Button>
            ) : null}
            <Button
              variant="primary"
              size="sm"
              disabled={!canSend}
              onClick={() => void handleSend()}
            >
              <Send size={14} />
              发送
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
