import { useCallback, useState } from 'react';
import type { AssetItem, AssetType } from '../types';
import { useTimelineStore } from '../store/timeline';
import { Button, EmptyState } from '../ui/primitives';
import { SearchField } from '../ui/patterns';
import { AssetCard } from './AssetCard';
import styles from './AssetPanel.module.css';

type AssetFilterKey = 'all' | AssetType;

const FILTER_OPTIONS: Array<{ key: AssetFilterKey; label: string }> = [
  { key: 'all', label: '全部' },
  { key: 'image', label: '图片' },
  { key: 'video', label: '视频' },
  { key: 'audio', label: '音频' },
  { key: 'srt', label: '字幕' },
];

function matchesAssetFilter(asset: AssetItem, filter: AssetFilterKey, keyword: string): boolean {
  const normalizedKeyword = keyword.trim().toLowerCase();

  if (filter !== 'all' && asset.type !== filter) {
    return false;
  }

  if (!normalizedKeyword) {
    return true;
  }

  return asset.name.toLowerCase().includes(normalizedKeyword);
}

export function AssetPanel({
  compact,
  railHeight,
  onAddAsset,
}: {
  compact: boolean;
  railHeight?: number;
  onAddAsset?: () => Promise<void>;
}) {
  const { addAsset, assets, removeAsset, timeline } = useTimelineStore();
  const [keyword, setKeyword] = useState('');
  const [activeFilter, setActiveFilter] = useState<AssetFilterKey>('all');

  const handleAddAsset = useCallback(async () => {
    if (onAddAsset) {
      await onAddAsset();
      return;
    }

    const asset = await window.electronAPI.addAsset();
    if (!asset) {
      return;
    }

    addAsset(asset.path, asset.type, asset.durationMs);
  }, [addAsset, onAddAsset]);

  const getAssetUsageCount = useCallback(
    (path: string) => timeline.overlays.filter((overlay) => overlay.assetPath === path).length,
    [timeline.overlays],
  );

  const handleRemoveAsset = useCallback(
    (path: string) => {
      const usageCount = getAssetUsageCount(path);
      if (
        usageCount > 0 &&
        !window.confirm(`该素材已在底部轨道中使用 ${usageCount} 次，删除后会同步移除所有相关轨道块。确认继续吗？`)
      ) {
        return;
      }

      removeAsset(path);
    },
    [getAssetUsageCount, removeAsset],
  );

  const visibleAssets = assets.filter((asset) => matchesAssetFilter(asset, activeFilter, compact ? '' : keyword));

  const emptyMessage = assets.length === 0 ? '还没有素材。先导入图片、视频、音频或字幕文件。' : '没有匹配的素材，试试别的关键词。';

  return (
    <aside
      className={[
        styles.root,
        compact ? styles.compact : styles.regular,
      ].join(' ')}
    >
      <div className={styles.header}>
        <Button onClick={() => void handleAddAsset()} variant="secondary">
          + 导入
        </Button>
        {compact ? (
          <div className={styles.compactSummary}>
            素材库 · {visibleAssets.length} 项
          </div>
        ) : (
          <SearchField
            value={keyword}
            aria-label="搜索素材"
            onChange={(event) => setKeyword(event.target.value)}
            placeholder="搜索文件名"
          />
        )}
      </div>

      {!compact ? (
        <div className={styles.filterRow}>
          <div className={styles.filterList}>
            {FILTER_OPTIONS.map((option) => {
              const isActive = option.key === activeFilter;

              return (
                <Button
                  key={option.key}
                  onClick={() => setActiveFilter(option.key)}
                  variant={isActive ? 'secondary' : 'ghost'}
                  size="sm"
                >
                  {option.label}
                </Button>
              );
            })}
          </div>
          <div className={styles.count}>{visibleAssets.length} 项</div>
        </div>
      ) : null}

      <div
        className={[
          styles.content,
          compact ? styles.contentCompact : styles.contentRegular,
        ].join(' ')}
      >
        {visibleAssets.length === 0 ? (
          <div className={[
            styles.emptyWrap,
            compact ? '' : styles.emptyWrapRegular,
          ].filter(Boolean).join(' ')}>
            <EmptyState title="暂无素材" description={emptyMessage} />
          </div>
        ) : null}

        {visibleAssets.map((asset) => (
          <AssetCard
            key={asset.path}
            asset={asset}
            compact={compact}
            usageCount={getAssetUsageCount(asset.path)}
            onRemove={handleRemoveAsset}
            onDragStart={(event) => {
              if (asset.locked || (asset.type !== 'image' && asset.type !== 'video')) {
                event.preventDefault();
                return;
              }

              event.dataTransfer.effectAllowed = 'copy';
              event.dataTransfer.setData('application/json', JSON.stringify(asset));
            }}
          />
        ))}
      </div>
    </aside>
  );
}
