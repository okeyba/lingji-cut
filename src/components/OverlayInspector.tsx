import { useCallback } from 'react';
import { getFileNameFromPath } from '../lib/utils';
import { useTimelineStore } from '../store/timeline';
import type { OverlayMotion } from '../types';
import { Button } from '../ui';
import { TextInspector } from './TextInspector';
import styles from './OverlayInspector.module.css';

const ENTER_OPTIONS: Array<OverlayMotion['enter']> = [
  'none',
  'fadeIn',
  'slideInLeft',
  'slideInRight',
  'slideInUp',
  'slideInDown',
  'scaleIn',
  'bounceIn',
];

const EXIT_OPTIONS: Array<OverlayMotion['exit']> = [
  'none',
  'fadeOut',
  'slideOutLeft',
  'slideOutRight',
  'slideOutUp',
  'slideOutDown',
  'scaleOut',
  'bounceOut',
];

const LOOP_OPTIONS: Array<OverlayMotion['loop']> = ['none', 'pulse', 'float', 'flicker'];

interface OverlayInspectorProps {
  overlayId: string;
  onDelete: () => void;
}

export function OverlayInspector({ overlayId, onDelete }: OverlayInspectorProps) {
  const timeline = useTimelineStore((state) => state.timeline);
  const updateOverlay = useTimelineStore((state) => state.updateOverlay);
  const overlay = timeline.overlays.find((item) => item.id === overlayId);

  const updateMotion = useCallback(
    (updates: Partial<OverlayMotion>) => {
      if (!overlay?.motion) {
        return;
      }

      updateOverlay(overlayId, {
        motion: {
          ...overlay.motion,
          ...updates,
        },
      });
    },
    [overlay, overlayId, updateOverlay],
  );

  if (!overlay) {
    return <div className={styles.empty}>图层不存在</div>;
  }

  if (overlay.type === 'text') {
    return <TextInspector overlayId={overlayId} onDelete={onDelete} />;
  }

  return (
    <div className={styles.root}>
      <section className={styles.section}>
        <div className={styles.sectionTitle}>基础</div>
        <div className={styles.fieldGrid}>
          <div className={styles.field}>
            <span className={styles.label}>类型</span>
            <span className={styles.value}>{overlay.type === 'video' ? '视频' : '图片'}</span>
          </div>
          <div className={styles.field}>
            <span className={styles.label}>轨道</span>
            <span className={styles.value}>{overlay.trackId}</span>
          </div>
          <div className={[styles.field, styles.fieldWide].join(' ')}>
            <span className={styles.label}>素材</span>
            <span className={styles.value}>{getFileNameFromPath(overlay.assetPath)}</span>
          </div>
          <div className={styles.field}>
            <span className={styles.label}>开始时间</span>
            <span className={styles.value}>{overlay.startMs} ms</span>
          </div>
          <div className={styles.field}>
            <span className={styles.label}>时长</span>
            <span className={styles.value}>{overlay.durationMs} ms</span>
          </div>
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionTitle}>动画</div>
        <div className={styles.fieldGrid}>
          <label className={styles.field}>
            <span className={styles.label}>入场</span>
            <select
              className={styles.select}
              value={overlay.motion?.enter ?? 'none'}
              onChange={(event) => updateMotion({ enter: event.target.value as OverlayMotion['enter'] })}
            >
              {ENTER_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          <label className={styles.field}>
            <span className={styles.label}>出场</span>
            <select
              className={styles.select}
              value={overlay.motion?.exit ?? 'none'}
              onChange={(event) => updateMotion({ exit: event.target.value as OverlayMotion['exit'] })}
            >
              {EXIT_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          <label className={styles.field}>
            <span className={styles.label}>循环</span>
            <select
              className={styles.select}
              value={overlay.motion?.loop ?? 'none'}
              onChange={(event) => updateMotion({ loop: event.target.value as OverlayMotion['loop'] })}
            >
              {LOOP_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          <label className={styles.field}>
            <span className={styles.label}>入场时长</span>
            <input
              className={styles.numberInput}
              type="number"
              min={100}
              step={100}
              value={overlay.motion?.enterDurationMs ?? 400}
              onChange={(event) => updateMotion({ enterDurationMs: Number(event.target.value) })}
            />
          </label>
          <label className={styles.field}>
            <span className={styles.label}>出场时长</span>
            <input
              className={styles.numberInput}
              type="number"
              min={100}
              step={100}
              value={overlay.motion?.exitDurationMs ?? 400}
              onChange={(event) => updateMotion({ exitDurationMs: Number(event.target.value) })}
            />
          </label>
        </div>
        <div className={styles.helper}>媒体图层现在和文字图层共用同一套入场 / 循环 / 出场动画模型。</div>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionTitle}>位置</div>
        <div className={styles.fieldGrid}>
          <div className={styles.field}>
            <span className={styles.label}>X</span>
            <span className={styles.value}>{overlay.position.x}</span>
          </div>
          <div className={styles.field}>
            <span className={styles.label}>Y</span>
            <span className={styles.value}>{overlay.position.y}</span>
          </div>
          <div className={styles.field}>
            <span className={styles.label}>宽度</span>
            <span className={styles.value}>{overlay.position.width}</span>
          </div>
          <div className={styles.field}>
            <span className={styles.label}>高度</span>
            <span className={styles.value}>{overlay.position.height}</span>
          </div>
        </div>
      </section>

      <Button variant="destructive" className={styles.deleteButton} onClick={onDelete}>
        删除图层
      </Button>
    </div>
  );
}
