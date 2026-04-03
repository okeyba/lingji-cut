import { useEffect, useMemo, useState } from 'react';
import {
  buildExportRenderConfig,
  EXPORT_QUALITY_OPTIONS,
  EXPORT_RESOLUTION_OPTIONS,
  type ExportConfig,
  type ExportQuality,
  type ExportResolution,
} from '../lib/export-settings';
import { Badge, Button, ModalShell, SurfaceCard } from '../ui/primitives';
import { SelectionCard } from '../ui/patterns';
import styles from './ExportSettingsModal.module.css';

interface ExportSettingsModalProps {
  visible: boolean;
  timelineWidth: number;
  timelineHeight: number;
  onClose: () => void;
  onConfirm: (payload: { outputPath: string; exportConfig: ExportConfig }) => Promise<void> | void;
}

export function ExportSettingsModal({
  visible,
  timelineWidth,
  timelineHeight,
  onClose,
  onConfirm,
}: ExportSettingsModalProps) {
  const [resolution, setResolution] = useState<ExportResolution>('720p');
  const [quality, setQuality] = useState<ExportQuality>('balanced');
  const [outputPath, setOutputPath] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!visible) {
      return;
    }

    setResolution('720p');
    setQuality('balanced');
    setOutputPath('');
    setIsSubmitting(false);
  }, [visible]);

  const renderConfig = useMemo(
    () =>
      buildExportRenderConfig({
        timelineWidth,
        timelineHeight,
        resolution,
        quality,
      }),
    [quality, resolution, timelineHeight, timelineWidth],
  );

  const handleSelectOutputPath = async () => {
    const savePath = await window.electronAPI.selectOutputPath();
    if (!savePath) {
      return;
    }

    setOutputPath(savePath);
  };

  const handleConfirm = async () => {
    if (!outputPath || isSubmitting) {
      return;
    }

    setIsSubmitting(true);

    try {
      await onConfirm({
        outputPath,
        exportConfig: {
          resolution,
          quality,
        },
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ModalShell
      visible={visible}
      eyebrow="EXPORT"
      title="导出设置"
      description="首轮导出建议先选择较低分辨率和更快档位，快速检查节奏、字幕和画面排布。"
      zIndex={110}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            取消
          </Button>
          <Button
            variant="primary"
            size="lg"
            onClick={() => {
              void handleConfirm();
            }}
            disabled={!outputPath || isSubmitting}
            loading={isSubmitting}
          >
            {isSubmitting ? '准备中...' : '开始导出'}
          </Button>
        </>
      }
    >
      <SurfaceCard variant="subtle" padding="md" className={styles.pathCard}>
        <div className={styles.sectionLabel}>输出路径</div>
        <div className={styles.pathRow}>
          <div
            className={[
              styles.pathValue,
              outputPath ? styles.pathValueFilled : '',
            ].filter(Boolean).join(' ')}
          >
            {outputPath || '还未选择导出位置'}
          </div>
          <Button onClick={() => void handleSelectOutputPath()} variant="secondary">
            选择位置
          </Button>
        </div>
      </SurfaceCard>

      <div className={styles.grid}>
        <div className={styles.column}>
          <div className={styles.sectionLabel}>分辨率</div>
          <div className={styles.column}>
            {EXPORT_RESOLUTION_OPTIONS.map((option) => {
              const dimensions = buildExportRenderConfig({
                timelineWidth,
                timelineHeight,
                resolution: option.value,
                quality,
              });
              const isActive = resolution === option.value;

              return (
                <SelectionCard
                  key={option.value}
                  onClick={() => setResolution(option.value)}
                  selected={isActive}
                  tone="brand"
                  title={option.label}
                  meta={`${dimensions.renderWidth} × ${dimensions.renderHeight}`}
                  description={option.description}
                >
                </SelectionCard>
              );
            })}
          </div>
        </div>

        <div className={styles.column}>
          <div className={styles.sectionLabel}>导出速度</div>
          <div className={styles.column}>
            {EXPORT_QUALITY_OPTIONS.map((option) => {
              const isActive = quality === option.value;

              return (
                <SelectionCard
                  key={option.value}
                  onClick={() => setQuality(option.value)}
                  selected={isActive}
                  tone="warm"
                  title={option.label}
                  meta={
                    buildExportRenderConfig({
                      timelineWidth,
                      timelineHeight,
                      resolution,
                      quality: option.value,
                    }).videoBitrate
                  }
                  description={option.description}
                >
                </SelectionCard>
              );
            })}
          </div>
        </div>
      </div>

      <SurfaceCard variant="subtle" padding="md" style={{ marginTop: 18 }}>
        <div className={styles.sectionLabel}>本次导出摘要</div>
        <div className={styles.summary}>
          <Badge variant="neutral">{renderConfig.renderWidth} × {renderConfig.renderHeight}</Badge>
          <Badge variant="neutral">{renderConfig.videoBitrate}</Badge>
          <Badge variant="neutral">{renderConfig.audioBitrate}</Badge>
          <Badge variant="neutral">{renderConfig.x264Preset}</Badge>
        </div>
      </SurfaceCard>
    </ModalShell>
  );
}
