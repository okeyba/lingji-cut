import { AppIcon, type AppIconName } from './AppIcon';
import type { MenuAction } from '../lib/electron-api';
import type { SaveStatus } from '../store/timeline';
import { Badge, Button } from '../ui/primitives';
import styles from './Toolbar.module.css';

interface ToolbarProps {
  compact: boolean;
  page: 'setup' | 'editor';
  projectName: string;
  saveStatus: SaveStatus;
  onCommand: (command: MenuAction) => void;
}

const saveStatusLabelMap: Record<SaveStatus, string> = {
  idle: '未打开工程',
  saving: '保存中',
  saved: '已保存',
  error: '保存失败',
};

const saveStatusMetaMap: Record<SaveStatus, { icon: AppIconName; color: string }> = {
  idle: { icon: 'circle', color: '#64748b' },
  saving: { icon: 'refresh-cw', color: '#38bdf8' },
  saved: { icon: 'circle-check-big', color: '#22c55e' },
  error: { icon: 'alert-circle', color: '#f87171' },
};

export function Toolbar({
  compact,
  page,
  projectName,
  saveStatus,
  onCommand,
}: ToolbarProps) {
  const saveStatusLabel = saveStatusLabelMap[saveStatus];
  const saveStatusMeta = saveStatusMetaMap[saveStatus];
  const visibleProjectName = projectName || (page === 'editor' ? '未命名工程' : '欢迎页');
  const controlHeight = compact ? 34 : 36;
  const controlRadius = compact ? 11 : 12;
  const controlFontSize = 13;
  const chromeSpacerWidth = compact ? 76 : 94;

  return (
    <div
      className={[styles.root, compact ? styles.compact : ''].filter(Boolean).join(' ')}
    >
      <div
        className={styles.spacer}
        style={{ minWidth: chromeSpacerWidth, height: controlHeight }}
      />
      <div
        className={[
          styles.projectChip,
          compact ? styles.projectChipCompact : '',
        ].filter(Boolean).join(' ')}
        style={{
          minWidth: 0,
          maxWidth: compact ? 'min(58vw, 480px)' : 'min(54vw, 560px)',
          height: controlHeight,
        }}
        title={saveStatusLabel}
      >
        <span
          aria-label={saveStatusLabel}
          className={styles.statusIcon}
          style={{ color: saveStatusMeta.color }}
        >
          <AppIcon name={saveStatusMeta.icon} size={14} />
        </span>
        <span className={styles.projectName}>{visibleProjectName}</span>
      </div>
      <div className={styles.actions}>
        {!compact ? <Badge variant={saveStatus === 'error' ? 'danger' : saveStatus === 'saved' ? 'success' : 'neutral'}>{saveStatusLabel}</Badge> : null}
        <Button
          disabled={page !== 'editor'}
          onClick={() => onCommand('export')}
          variant={page === 'editor' ? 'tint' : 'secondary'}
          size={compact ? 'sm' : 'md'}
          style={{ height: controlHeight, borderRadius: controlRadius, fontSize: controlFontSize }}
        >
          导出 MP4
        </Button>
      </div>
    </div>
  );
}
