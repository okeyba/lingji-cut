import { Badge, Button, EmptyState, PanelHeader } from '../ui';
import type { AICardDisplayMode } from '../types/ai';
import styles from './MotionCardInspector.module.css';

export interface MotionCardPayload {
  sourceCode?: string;
  compiledCode?: string;
  compiledAt?: number;
  compileError?: string;
  prompt?: string;
  retryCount?: number;
}

export interface MotionCardInspectorProps {
  cardId: string;
  title?: string;
  prompt?: string;
  startMs?: number;
  durationMs?: number;
  displayMode?: AICardDisplayMode;
  statusLabel?: string;
  statusHint?: string;
  motionCard?: MotionCardPayload | null;
  onDelete: () => void;
}

const formatMs = (value?: number): string =>
  value == null ? '未知' : `${(value / 1_000).toFixed(1)}s`;

const formatTimestamp = (value?: number): string =>
  value ? new Date(value).toLocaleString() : '暂无';

export function MotionCardInspector({
  cardId,
  title,
  prompt,
  startMs,
  durationMs,
  displayMode,
  statusLabel,
  statusHint,
  motionCard,
  onDelete,
}: MotionCardInspectorProps) {
  const hasContent = Boolean(title || prompt || motionCard || durationMs != null || startMs != null);
  const statusText = statusLabel ?? (motionCard?.compileError ? '编译失败' : '准备就绪');
  const statusVariant = statusText.includes('失败')
    ? 'destructive'
    : statusText.includes('上轨')
      ? 'success'
      : 'secondary';
  const compiledAtText = formatTimestamp(motionCard?.compiledAt);
  const durationText = formatMs(durationMs);
  const startText = formatMs(startMs);

  return (
    <div className={styles.root}>
      {hasContent ? (
        <>
          <PanelHeader
            title={title ?? 'Motion Card'}
            description={cardId}
            meta={
              <Badge variant={statusVariant} size="xs" className={styles.statusBadge}>
                {statusText}
              </Badge>
            }
          />

          <div className={styles.section}>
            <span className={styles.sectionTitle}>描述与状态</span>
            <div className={`${styles.row} ${styles.rowMultiline}`}>
              <span className={styles.rowLabel}>提示词</span>
              <span className={styles.rowValue}>{prompt ?? '暂无描述'}</span>
            </div>
            {motionCard?.compileError ? (
              <div className={styles.hint}>{motionCard.compileError}</div>
            ) : null}
          </div>

          <div className={styles.section}>
            <span className={styles.sectionTitle}>运行参数</span>
            <div className={styles.row}>
              <span className={styles.rowLabel}>显示模式</span>
              <span className={styles.rowValue}>{displayMode ?? '未知'}</span>
            </div>
            <div className={styles.row}>
              <span className={styles.rowLabel}>时长</span>
              <span className={styles.rowValue}>{durationText}</span>
            </div>
            <div className={styles.row}>
              <span className={styles.rowLabel}>起始位置</span>
              <span className={styles.rowValue}>{startText}</span>
            </div>
            <div className={styles.row}>
              <span className={styles.rowLabel}>编译时间</span>
              <span className={styles.rowValue}>{compiledAtText}</span>
            </div>
            {motionCard?.retryCount != null ? (
              <div className={styles.row}>
                <span className={styles.rowLabel}>修复次数</span>
                <span className={styles.rowValue}>{motionCard.retryCount}</span>
              </div>
            ) : null}
          </div>
          {statusHint ? <div className={styles.hint}>{statusHint}</div> : null}
        </>
      ) : (
        <div className={styles.emptyWrap}>
          <EmptyState
            title="动画信息不可用"
            description="当前动画可能还在生成中或已被移除。"
          />
        </div>
      )}

      <div className={styles.actions}>
        <Button variant="destructive" size="sm" onClick={onDelete}>
          删除动画
        </Button>
      </div>
    </div>
  );
}
