import { useEffect, useState } from 'react';
import { Server, X } from 'lucide-react';
import { useAgentStore } from '../../store/agent';
import { Button } from '../../ui';

export function AgentHeader() {
  // 注意：status 由 AcpConnectionsProvider 将 active 会话状态镜像进来，
  // AgentHeader 本身挂在 provider 作用域之外，只能通过 store 读全局镜像值。
  const status = useAgentStore((s) => s.status);
  const toggleSidebar = useAgentStore((s) => s.toggleSidebar);

  const [mcpStatus, setMcpStatus] = useState<{ running: boolean; url: string } | null>(null);

  useEffect(() => {
    if (!window.mcpAPI) return;
    window.mcpAPI.getStatus().then((s) => setMcpStatus({ running: s.running, url: s.url }));
  }, [status]); // status 变化时刷新 MCP 状态展示

  const statusColor =
    status === 'connected' || status === 'prompting'
      ? '#32D74B'
      : status === 'connecting'
        ? '#FFD60A'
        : status === 'error'
          ? '#FF453A'
          : '#636366';

  return (
    <div className="flex flex-col border-b border-mac-separator shrink-0">
      <div className="flex items-center gap-2 px-3 py-2.5">
        <div
          className="w-2 h-2 rounded-full shrink-0"
          style={{ background: statusColor }}
        />
        <span className="text-[13px] font-semibold flex-1">Claude Code</span>

        <Button variant="ghost" size="sm" iconOnly onClick={toggleSidebar} title="关闭面板">
          <X size={14} />
        </Button>
      </div>

      {/* MCP 服务状态 */}
      {mcpStatus && (
        <div className="flex items-center gap-1.5 px-3 pb-2 text-[11px]" style={{ color: '#8E8E93' }}>
          <Server size={11} style={{ color: mcpStatus.running ? '#32D74B' : '#636366' }} />
          <span>MCP</span>
          <span
            className="rounded px-1 py-0.5 font-mono text-[10px]"
            style={{
              background: mcpStatus.running ? 'rgba(50,215,75,0.12)' : 'rgba(99,99,102,0.12)',
              color: mcpStatus.running ? '#32D74B' : '#636366',
            }}
          >
            {mcpStatus.running ? '运行中' : '已停止'}
          </span>
          {mcpStatus.running && (
            <span className="font-mono text-[10px] truncate" style={{ color: '#636366' }}>
              {mcpStatus.url}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
