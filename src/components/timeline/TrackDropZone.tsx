import { forwardRef } from 'react';
import styles from '../Timeline.module.css';

export interface TrackDropZoneProps {
  /** 屏幕顺序的 gap 索引:0 = 最顶第一条轨道之前,N = 最底最后一条轨道之后 */
  gapIndex: number;
  /** 拖拽活跃期间 → 展开显示 */
  active: boolean;
  /** 当前 hover 命中此 gap → 高亮 */
  highlighted: boolean;
}

/**
 * 拖拽 overlay 时显示在每条 visual 轨道之间间隙里的 "释放新建轨道" 指示条。
 * 平时高度为 0,拖拽开始后 CSS transition 展开到 28px,hover 命中时高亮。
 */
export const TrackDropZone = forwardRef<HTMLDivElement, TrackDropZoneProps>(
  function TrackDropZone({ gapIndex, active, highlighted }, ref) {
    return (
      <div
        ref={ref}
        className={styles.trackDropZone}
        data-active={active ? 'true' : 'false'}
        data-highlighted={highlighted ? 'true' : 'false'}
        data-gap-index={gapIndex}
      >
        <div className={styles.trackDropZoneLine} />
        <span className={styles.trackDropZoneHint}>释放新建轨道</span>
      </div>
    );
  },
);
