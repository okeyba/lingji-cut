// src/components/StatusBarTaskSummary.tsx
import { useTaskProgressStore } from '../store/task-progress';
import type { TaskCategory } from '../store/task-progress';

const CATEGORY_ICONS: Record<TaskCategory, string> = {
  'ai-write': '🤖',
  'ai-review': '🔍',
  'ai-analyze': '🧠',
  'import': '📥',
  'export': '🎬',
  'tts': '🎙️',
  'cover': '🖼️',
  'io': '📁',
};

export function StatusBarTaskSummary() {
  const primaryTask = useTaskProgressStore((s) => s.primaryTask);
  const activeCount = useTaskProgressStore((s) => s.activeCount);
  const panelOpen = useTaskProgressStore((s) => s.panelOpen);
  const setPanelOpen = useTaskProgressStore((s) => s.setPanelOpen);

  if (!primaryTask) return null;

  const icon = CATEGORY_ICONS[primaryTask.category] ?? '📁';

  let text: string;
  if (primaryTask.status === 'completed') {
    text = `✅ ${primaryTask.label} 完成`;
  } else if (primaryTask.status === 'error') {
    text = `❌ ${primaryTask.label} 失败`;
  } else if (activeCount > 1) {
    const pct = primaryTask.mode === 'determinate' ? ` ${primaryTask.progress}%` : '';
    text = `${icon} ${primaryTask.label}${pct} · +${activeCount - 1}`;
  } else {
    const pct = primaryTask.mode === 'determinate' ? ` ${primaryTask.progress}%` : '';
    text = `${icon} ${primaryTask.label}${pct}`;
  }

  return (
    <span
      onClick={() => setPanelOpen(!panelOpen)}
      style={{ cursor: 'pointer', transition: 'color 0.15s' }}
      title="点击查看任务详情"
    >
      {text}
    </span>
  );
}
