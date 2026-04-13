import { Button, EmptyState } from '../ui';
import { MotionCardInspector } from './MotionCardInspector';
import { AICardInspector } from './AICardInspector';
import { AppIcon } from './AppIcon';
import { OverlayInspector } from './OverlayInspector';
import { ProjectOverviewPanel, type ProjectOverviewMeta } from './ProjectOverviewPanel';
import { SubtitleInspector } from './SubtitleInspector';
import { useAICardInspector } from '../hooks/useAICardInspector';
import { useAIStore } from '../store/ai';
import { useTimelineStore } from '../store/timeline';
import styles from './EditorInspector.module.css';
import { useMemo } from 'react';

export type InspectorSelection =
  | { type: 'empty' }
  | { type: 'ai-card'; cardId: string }
  | { type: 'motion-card'; cardId: string }
  | { type: 'overlay'; overlayId: string }
  | { type: 'subtitle-style' };

interface EditorInspectorProps {
  assetCount?: number;
  isProjectMetaLoading?: boolean;
  overlayCount?: number;
  projectDir?: string;
  projectMeta?: ProjectOverviewMeta | null;
  selection: InspectorSelection;
  timelineWidth: number;
  timelineHeight: number;
  timelineFps?: number;
  onClose: () => void;
}

export function EditorInspector({
  assetCount = 0,
  isProjectMetaLoading = false,
  selection,
  overlayCount = 0,
  projectDir = '',
  projectMeta = null,
  timelineHeight,
  timelineFps = 30,
  timelineWidth,
  onClose,
}: EditorInspectorProps) {
  const {
    card,
    cardSequenceLabel,
    deleteCard,
    errorMessage,
    isRegeneratingCard,
    regenerateCard,
    saveCard,
  } = useAICardInspector(selection.type === 'ai-card' ? selection.cardId : null);
  const motionCards = useAIStore((state) => state.motionCards);
  const setMotionCards = useAIStore((state) => state.setMotionCards);
  const timeline = useTimelineStore((state) => state.timeline);

  /* ── eyebrow pill 内容 ── */
  const eyebrowLabel =
    selection.type === 'subtitle-style'
      ? 'SUBTITLE'
      : selection.type === 'ai-card'
      ? 'AI CARD'
      : selection.type === 'motion-card'
      ? 'MOTION CARD'
      : selection.type === 'overlay'
      ? 'OVERLAY'
      : 'INSPECTOR';

  /* ── 右侧索引/状态标签 ── */
  const isSubtitleStyle = selection.type === 'subtitle-style';
  const indexLabel = selection.type === 'ai-card' ? cardSequenceLabel : null;
  const motionCard =
    selection.type === 'motion-card'
      ? motionCards.find((item) => item.id === selection.cardId) ?? null
      : null;
  const isMotionOnTimeline = useMemo(() => {
    if (!selection || selection.type !== 'motion-card') {
      return false;
    }
    return timeline.overlays.some(
      (overlay) =>
        overlay.overlayType === 'ai-card' &&
        overlay.aiCardData?.sourceCardId === selection.cardId,
    );
  }, [selection, timeline.overlays]);
  const motionStatusHint = isMotionOnTimeline ? '已上轨，可在时间轴预览' : '尚未上轨';
  const renderBody = () => {
    if (selection.type === 'subtitle-style') {
      return <SubtitleInspector />;
    }

    if (selection.type === 'ai-card') {
      if (!card) {
        return (
          <div className={styles.emptyWrap}>
            <EmptyState
              title="卡片不存在"
              description="当前 AI 卡片可能已被删除，请重新从左侧卡片列表或时间轴中选择。"
            />
          </div>
        );
      }

      return (
        <AICardInspector
          card={card}
          errorMessage={errorMessage}
          isRegenerating={isRegeneratingCard}
          previewWidth={timelineWidth}
          previewHeight={timelineHeight}
          onDelete={() => {
            deleteCard();
            onClose();
          }}
          onRegenerate={regenerateCard}
          onSave={saveCard}
        />
      );
    }

    if (selection.type === 'motion-card') {
      return (
        <MotionCardInspector
          cardId={selection.cardId}
          title={motionCard?.title}
          prompt={motionCard?.cardPrompt ?? motionCard?.motionCard?.prompt}
          startMs={motionCard?.startMs}
          durationMs={motionCard?.displayDurationMs}
          displayMode={motionCard?.displayMode}
          statusLabel={motionCard ? (isMotionOnTimeline ? '已上轨' : '准备就绪') : undefined}
          statusHint={motionStatusHint}
          motionCard={motionCard?.motionCard ?? null}
          onDelete={() => {
            setMotionCards(motionCards.filter((item) => item.id !== selection.cardId));
            useTimelineStore.getState().removeAICardOverlaysBySourceIds([selection.cardId]);
            onClose();
          }}
        />
        );
      }

    if (selection.type === 'overlay') {
      return (
        <OverlayInspector
          overlayId={selection.overlayId}
          onDelete={() => {
            useTimelineStore.getState().removeOverlay(selection.overlayId);
            onClose();
          }}
        />
      );
    }

    return (
      <ProjectOverviewPanel
        assetCount={assetCount}
        isProjectMetaLoading={isProjectMetaLoading}
        overlayCount={overlayCount}
        projectDir={projectDir}
        projectMeta={projectMeta}
        timelineFps={timelineFps}
        timelineHeight={timelineHeight}
        timelineWidth={timelineWidth}
      />
    );
  };

  return (
    <div
      className={styles.shell}
      data-editor-region="inspector-shell"
    >
      <div className={styles.header}>
        <span
          className={styles.eyebrowPill}
          data-variant={isSubtitleStyle ? 'subtitle' : 'default'}
        >
          {eyebrowLabel}
        </span>

        {isSubtitleStyle ? (
          <>
            <div className={styles.headerSpacer} />
            <span className={styles.headerMeta}>字幕样式</span>
            <Button.Icon
              variant="ghost"
              aria-label="关闭右侧配置区"
              title="关闭右侧配置区"
              onClick={onClose}
              className={styles.closeButton}
            >
              <AppIcon name="x" size={14} />
            </Button.Icon>
          </>
        ) : (
          <div className={styles.headerRight}>
            {indexLabel ? (
              <span className={styles.indexLabel}>{indexLabel}</span>
            ) : null}
            {selection.type !== 'empty' ? (
              <Button.Icon
                variant="ghost"
                aria-label="关闭右侧配置区"
                title="关闭右侧配置区"
                onClick={onClose}
                className={styles.closeButton}
              >
                <AppIcon name="x" size={14} />
              </Button.Icon>
            ) : null}
          </div>
        )}
      </div>

      <div className={styles.body}>{renderBody()}</div>
    </div>
  );
}
