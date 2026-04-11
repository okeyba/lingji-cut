import { useTaskProgressStore } from '../store/task-progress';
import { Progress } from '../ui';
import styles from './AppStatusBar.module.css';

export function StatusBarProgressLine() {
  const primaryTask = useTaskProgressStore((s) => s.primaryTask);

  if (!primaryTask || primaryTask.status !== 'active') return null;

  const isIndeterminate = primaryTask.mode !== 'determinate';

  return (
    <div className={styles.progressLine}>
      <Progress
        value={primaryTask.progress}
        size="sm"
        variant="default"
        indeterminate={isIndeterminate}
      />
    </div>
  );
}
