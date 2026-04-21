import styles from './FilterPanel.module.css';
import type { FilterPreset } from '../../lib/cover-editor/contracts';

interface FilterPanelProps {
  preset: FilterPreset;
  adjustments: { brightness: number; contrast: number; saturation: number; temperature: number };
  onPresetChange: (preset: FilterPreset) => void;
  onAdjustmentChange: (
    key: 'brightness' | 'contrast' | 'saturation' | 'temperature',
    value: number,
  ) => void;
}

const PRESETS: Array<{ id: FilterPreset; label: string }> = [
  { id: 'none', label: '原图' },
  { id: 'bw', label: '黑白' },
  { id: 'vivid', label: '鲜艳' },
  { id: 'vintage', label: '复古' },
  { id: 'cool', label: '冷色' },
  { id: 'warm', label: '暖色' },
];

const SLIDERS: Array<{
  key: 'brightness' | 'contrast' | 'saturation' | 'temperature';
  label: string;
}> = [
  { key: 'brightness', label: '亮度' },
  { key: 'contrast', label: '对比度' },
  { key: 'saturation', label: '饱和度' },
  { key: 'temperature', label: '色温' },
];

export function FilterPanel({
  preset,
  adjustments,
  onPresetChange,
  onAdjustmentChange,
}: FilterPanelProps) {
  return (
    <div className={styles.root}>
      <div className={styles.section}>
        <div className={styles.sectionTitle}>滤镜预设</div>
        <div className={styles.presetGrid}>
          {PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              className={preset === p.id ? styles.presetActive : styles.preset}
              onClick={() => onPresetChange(p.id)}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.section}>
        <div className={styles.sectionTitle}>手动调整</div>
        {SLIDERS.map((s) => (
          <label key={s.key} className={styles.slider}>
            <span>{s.label}</span>
            <input
              type="range"
              min={-100}
              max={100}
              value={adjustments[s.key]}
              onChange={(e) => onAdjustmentChange(s.key, Number(e.target.value))}
            />
            <span className={styles.value}>{adjustments[s.key]}</span>
          </label>
        ))}
      </div>
    </div>
  );
}
