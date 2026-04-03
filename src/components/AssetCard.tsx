import type { DragEventHandler } from 'react';
import { formatTime } from '../lib/utils';
import type { AssetItem, AssetType } from '../types';
import { Badge, IconButton } from '../ui/primitives';
import { AssetThumbnail } from './AssetThumbnail';
import styles from './AssetCard.module.css';

interface AssetCardProps {
  asset: AssetItem;
  compact: boolean;
  usageCount: number;
  onDragStart: DragEventHandler<HTMLDivElement>;
  onRemove: (path: string) => void;
}

const TYPE_META: Record<AssetType, { label: string; accent: string; background: string }> = {
  video: {
    label: '视频',
    accent: '#5ad2ff',
    background: 'rgba(90,210,255,0.16)',
  },
  image: {
    label: '图片',
    accent: '#ffbc5e',
    background: 'rgba(255,188,94,0.16)',
  },
  audio: {
    label: '音频',
    accent: '#5fe0ff',
    background: 'rgba(95,224,255,0.18)',
  },
  srt: {
    label: '字幕',
    accent: '#c7b7ff',
    background: 'rgba(199,183,255,0.18)',
  },
};

function getAssetStatus(asset: AssetItem, usageCount: number): string {
  if (asset.locked) {
    return '默认素材';
  }

  if (usageCount > 0) {
    return `轨道使用 ${usageCount} 次`;
  }

  if (asset.type === 'image' || asset.type === 'video') {
    return '可拖到时间轴';
  }

  return '素材已导入';
}

export function AssetCard({ asset, compact, usageCount, onDragStart, onRemove }: AssetCardProps) {
  const theme = TYPE_META[asset.type];
  const statusText = getAssetStatus(asset, usageCount);
  const isDraggable = !asset.locked && (asset.type === 'image' || asset.type === 'video');

  return (
    <div
      draggable={isDraggable}
      onDragStart={onDragStart}
      className={[
        styles.root,
        compact ? styles.compact : styles.regular,
        isDraggable ? styles.draggable : '',
      ].filter(Boolean).join(' ')}
      style={{
        ['--asset-accent' as string]: theme.accent,
        ['--asset-badge-bg' as string]: theme.background,
      }}
    >
      <div className={styles.mediaFrame}>
        <AssetThumbnail asset={asset} />
        <div className={styles.mediaOverlay} />
        <div className={styles.flag}>已添加</div>
        <div className={styles.duration}>{formatTime(asset.durationMs)}</div>
      </div>

      <div className={styles.content}>
        <div className={styles.title}>{asset.name}</div>
        <div className={styles.metaRow}>
          <Badge
            variant="neutral"
            className={styles.typeBadge}
          >
            {theme.label}
          </Badge>
          {asset.locked ? (
            <span className={styles.locked}>锁定</span>
          ) : (
            <IconButton
              aria-label={`删除 ${asset.name}`}
              onClick={() => onRemove(asset.path)}
              variant="subtle"
              size="sm"
              className={styles.removeButton}
            >
              ×
            </IconButton>
          )}
        </div>
        <div className={styles.status}>{statusText}</div>
      </div>
    </div>
  );
}
