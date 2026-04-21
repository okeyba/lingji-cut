import type { ReactNode } from 'react';
import { Button } from '../../ui';
import { AppIcon } from '../AppIcon';
import styles from './Inspector.module.css';
import type { CoverTextOverlay } from '../../lib/cover-editor/contracts';

interface InspectorProps {
  selectedText: CoverTextOverlay | null;
  onUpdateText: (patch: Partial<CoverTextOverlay>) => void;
  onRemoveText: () => void;
  fontFamilyPicker: ReactNode;
}

export function Inspector({
  selectedText,
  onUpdateText,
  onRemoveText,
  fontFamilyPicker,
}: InspectorProps) {
  if (!selectedText) {
    return (
      <aside className={styles.panel}>
        <div className={styles.empty}>在画布上选择文字以编辑属性</div>
      </aside>
    );
  }

  return (
    <aside className={styles.panel}>
      <div className={styles.header}>文字属性</div>

      <label className={styles.row}>
        <span>内容</span>
        <input
          className={styles.input}
          value={selectedText.text}
          onChange={(e) => onUpdateText({ text: e.target.value })}
        />
      </label>

      <label className={styles.row}>
        <span>字体</span>
        {fontFamilyPicker}
      </label>

      <label className={styles.row}>
        <span>字号</span>
        <input
          type="number"
          min={8}
          max={200}
          className={styles.input}
          value={selectedText.fontSize}
          onChange={(e) => onUpdateText({ fontSize: Number(e.target.value) || 48 })}
        />
      </label>

      <label className={styles.row}>
        <span>颜色</span>
        <input
          type="color"
          value={selectedText.color}
          onChange={(e) => onUpdateText({ color: e.target.value })}
        />
      </label>

      <label className={styles.row}>
        <span>描边</span>
        <input
          type="color"
          value={selectedText.strokeColor ?? '#000000'}
          onChange={(e) => onUpdateText({ strokeColor: e.target.value })}
        />
        <input
          type="number"
          min={0}
          max={20}
          className={styles.input}
          value={selectedText.strokeWidth ?? 0}
          onChange={(e) => onUpdateText({ strokeWidth: Number(e.target.value) })}
        />
      </label>

      <div className={styles.row}>
        <span>对齐</span>
        <div className={styles.alignGroup}>
          {(['left', 'center', 'right'] as const).map((a) => (
            <Button.Icon
              key={a}
              variant={selectedText.align === a ? 'primary' : 'ghost'}
              onClick={() => onUpdateText({ align: a })}
              aria-label={`对齐${a}`}
            >
              <AppIcon name={`align-${a}`} size={14} />
            </Button.Icon>
          ))}
        </div>
      </div>

      {/* Button 组件无 "danger" variant，使用项目约定的 "destructive" */}
      <Button
        variant="destructive"
        size="sm"
        onClick={onRemoveText}
        className={styles.danger}
        leftIcon={<AppIcon name="trash-2" size={12} />}
      >
        删除图层
      </Button>
    </aside>
  );
}
