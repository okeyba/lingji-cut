import { useCallback, type MouseEvent } from 'react';
import { Badge, Button, Checkbox, Spinner } from '../ui';
import type { AICard } from '../types/ai';
import type { MotionCardPayload } from '../types/motion';
import { AppIcon } from './AppIcon';
import styles from './MotionCardItem.module.css';

type MotionCardStatus = 'generating' | 'ready' | 'error';

type MotionCard = AICard & {
  type?: string;
  motionCard?: MotionCardPayload;
};

interface MotionCardItemProps {
  card: MotionCard;
  status: MotionCardStatus;
  onToggleEnabled: (cardId: string) => void;
  onModify: (cardId: string) => void;
  onDelete: (cardId: string) => void;
  onClick?: (cardId: string) => void;
}

const STATUS_LABELS: Record<MotionCardStatus, string> = {
  generating: '生成中',
  ready: '就绪',
  error: '错误',
};

const STATUS_VARIANTS: Record<MotionCardStatus, 'info' | 'success' | 'destructive'> = {
  generating: 'info',
  ready: 'success',
  error: 'destructive',
};

export function MotionCardItem({
  card,
  status,
  onToggleEnabled,
  onModify,
  onDelete,
  onClick,
}: MotionCardItemProps) {
  const handleRootClick = useCallback(() => {
    onClick?.(card.id);
  }, [card.id, onClick]);

  const handleModifyClick = useCallback(
    (event: MouseEvent<HTMLButtonElement>) => {
      event.stopPropagation();
      onModify(card.id);
    },
    [card.id, onModify],
  );

  const handleDeleteClick = useCallback(
    (event: MouseEvent<HTMLButtonElement>) => {
      event.stopPropagation();
      onDelete(card.id);
    },
    [card.id, onDelete],
  );

  const handleCheckbox = useCallback(() => {
    onToggleEnabled(card.id);
  }, [card.id, onToggleEnabled]);

  const stopPropagation = useCallback((event: MouseEvent<HTMLDivElement>) => {
    event.stopPropagation();
  }, []);

  const duration = Math.max(1, Math.round((card.displayDurationMs ?? 0) / 1000));
  const promptText = card.motionCard?.prompt || String(card.content);
  const errorMessage = card.motionCard?.compileError;
  const isGenerating = status === 'generating';
  const modeLabel = card.displayMode === 'fullscreen' ? '全屏' : 'PiP';

  return (
    <article
      className={styles.card}
      data-enabled={card.enabled}
      data-status={status}
      onClick={handleRootClick}
    >
      <header className={styles.cardHead}>
        <div className={styles.checkboxWrap} onClick={stopPropagation}>
          <Checkbox
            checked={card.enabled}
            onChange={handleCheckbox}
            aria-label={`切换 ${card.title} 是否上轨`}
            size="sm"
          />
        </div>
        <div className={styles.titleBlock}>
          <span className={styles.title}>{card.title}</span>
          <span className={styles.metaRow}>
            <Badge variant="secondary" size="xs">
              {duration}s
            </Badge>
            <Badge variant="glass" size="xs">
              {modeLabel}
            </Badge>
          </span>
        </div>
        <Badge
          variant={STATUS_VARIANTS[status]}
          size="xs"
          className={styles.statusBadge}
        >
          {isGenerating ? <Spinner size={8} /> : null}
          {STATUS_LABELS[status]}
        </Badge>
      </header>

      <p className={styles.prompt}>{promptText}</p>

      {status === 'error' && errorMessage ? (
        <p className={styles.errorHint}>{errorMessage}</p>
      ) : null}

      <footer className={styles.actionRow}>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleModifyClick}
          disabled={isGenerating}
          leftIcon={<AppIcon name="pencil-line" size={11} />}
        >
          修改
        </Button>
        <span className={styles.actionSpacer} />
        <Button
          variant="ghost"
          size="sm"
          onClick={handleDeleteClick}
          className={styles.deleteButton}
          leftIcon={<AppIcon name="trash-2" size={11} />}
        >
          删除
        </Button>
      </footer>
    </article>
  );
}
